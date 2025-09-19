import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get the user from the request
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      console.error('Authentication error:', userError);
      return new Response(
        JSON.stringify({ error: 'User not authenticated' }), 
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Authenticated user:', user.id);

    // Get user's plan and current product count to check SKU limits
    const { data: userProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('plan, role')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      console.error('Profile not found:', profileError);
      return new Response(
        JSON.stringify({ error: 'User profile not found' }), 
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Count current products for this user
    const { count: currentProductCount, error: countError } = await supabaseClient
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (countError) {
      console.error('Error counting products:', countError);
      return new Response(
        JSON.stringify({ error: 'Failed to check current product count' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Define SKU limits per plan
    const skuLimits = {
      'estrategista': 500,
      'competidor': 2000,
      'dominador': 10000,
      'admin': Infinity // Admins don't have limits
    };

    const userPlan = userProfile.role === 'admin' ? 'admin' : userProfile.plan;
    const limit = skuLimits[userPlan] || skuLimits['estrategista'];

    // Check if user has reached their SKU limit
    if (currentProductCount >= limit) {
      console.log(`User has reached SKU limit. Current: ${currentProductCount}, Limit: ${limit}, Plan: ${userPlan}`);
      return new Response(
        JSON.stringify({ 
          error: 'Limite de SKUs atingido. Faça um upgrade do seu plano para importar mais produtos.',
          current_count: currentProductCount,
          limit: limit,
          plan: userPlan
        }), 
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`SKU check passed. Current: ${currentProductCount}, Limit: ${limit}, Plan: ${userPlan}`);

    const { platform } = await req.json();

    if (!platform) {
      return new Response(
        JSON.stringify({ error: 'Platform is required' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get the integration for this user and platform
    const { data: integration, error: integrationError } = await supabaseClient
      .from('integrations')
      .select('access_token')
      .eq('user_id', user.id)
      .eq('platform', platform)
      .single();

    if (integrationError || !integration || !integration.access_token) {
      console.error('Integration not found or no access token:', integrationError);
      return new Response(
        JSON.stringify({ error: 'Integration not found or not properly configured' }), 
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Found integration for platform:', platform);

    let productsToInsert = [];

    if (platform === 'mercadolivre') {
      try {
        // Step 1: Get user info to obtain user ID
        const userInfoResponse = await fetch(`https://api.mercadolibre.com/users/me`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${integration.access_token}`,
          },
        });

        if (!userInfoResponse.ok) {
          const errorText = await userInfoResponse.text();
          console.error('Error fetching user info:', errorText);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch user info from Mercado Livre' }), 
            { 
              status: 500, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        const userInfo = await userInfoResponse.json();
        const mlUserId = userInfo.id;
        console.log(`Buscando anúncios para o vendedor ML ID: ${mlUserId}`);

        // Step 2: Get list of product IDs first
        const listResponse = await fetch(`https://api.mercadolibre.com/users/${mlUserId}/items/search?limit=100`, {
          headers: {
            'Authorization': `Bearer ${integration.access_token}`,
          },
        });

        if (!listResponse.ok) {
          const errorBody = await listResponse.text();
          console.error('Erro ao buscar lista de produtos:', errorBody);
          return new Response(
            JSON.stringify({ error: `Falha ao buscar lista de produtos: ${listResponse.statusText}` }), 
            { 
              status: 500, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        const listData = await listResponse.json();
        const itemIds = listData.results;

        if (!itemIds || itemIds.length === 0) {
          console.log('Nenhum produto encontrado para este usuário.');
          return new Response(
            JSON.stringify({ message: 'Nenhum produto encontrado na sua conta do Mercado Livre', count: 0 }), 
            { 
              status: 200, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        console.log(`Encontrados ${itemIds.length} produtos. Buscando detalhes completos...`);

        // Step 3: Get complete details for all items (up to 20 at a time)  
        const detailsUrl = `https://api.mercadolibre.com/items?ids=${itemIds.slice(0, 20).join(',')}`;
        console.log(`Chamando API de detalhes: ${detailsUrl}`);

        const detailsResponse = await fetch(detailsUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${integration.access_token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!detailsResponse.ok) {
          const errorBody = await detailsResponse.text();
          console.error('Erro ao buscar detalhes dos produtos:', errorBody);
          return new Response(
            JSON.stringify({ error: `Falha ao buscar detalhes dos produtos: ${detailsResponse.statusText}` }), 
            { 
              status: 500, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        const detailsData = await detailsResponse.json();

        // **LOG DE DEPURAÇÃO: RESPOSTA CRUA DA API DE DETALHES**
        console.log('--- RESPOSTA CRUA DA API DE DETALHES ---');
        console.log(JSON.stringify(detailsData, null, 2));
        console.log('---------------------------------------');

        // Step 4: Map the detailed results to our database format
        productsToInsert = detailsData
          .filter(item => item.code === 200 && item.body) // Only successful responses
          .map(itemDetail => {
            const item = itemDetail.body;
            
            // **LOG DE DEPURAÇÃO: ITEM INDIVIDUAL**
            console.log('🔍 Processando item detalhado:', {
              id: item.id,
              title: item.title,
              price: item.price,
              price_type: typeof item.price,
              seller_custom_field: item.seller_custom_field,
              available_quantity: item.available_quantity
            });

            // Process price to ensure it's a valid number
            let selling_price = null;
            if (item.price !== undefined && item.price !== null) {
              if (typeof item.price === 'string') {
                const cleanPrice = item.price.replace(/[^\d.,]/g, '').replace(',', '.');
                selling_price = parseFloat(cleanPrice);
              } else if (typeof item.price === 'number') {
                selling_price = item.price;
              }
              
              if (isNaN(selling_price) || selling_price <= 0) {
                console.warn('⚠️ Preço inválido detectado:', item.price, '-> definindo como null');
                selling_price = null;
              } else {
                console.log('✅ Preço válido:', selling_price);
              }
            }

            return {
              user_id: user.id,
              name: item.title,
              sku: String(item.seller_custom_field || item.id), // Ensure SKU is always string
              stock: item.available_quantity || 0,
              selling_price: selling_price,
              image_url: item.thumbnail ? item.thumbnail.replace('http://', 'https://') : null,
            };
          });

        // **LOG DE DEPURAÇÃO: DADOS FINAIS**
        console.log('--- DADOS PRONTOS PARA O UPSERT ---');
        console.log(JSON.stringify(productsToInsert, null, 2));
        console.log('-----------------------------------');

        console.log(`Mapeados ${productsToInsert.length} produtos para o upsert com preços.`);
        if (productsToInsert.length > 0) {
          console.log('Exemplo de produto mapeado:', productsToInsert[0]);
        }

      } catch (error) {
        console.error('Erro fatal no bloco de importação de produtos do Mercado Livre:', error);
        return new Response(
          JSON.stringify({ error: 'Erro interno ao processar produtos do Mercado Livre' }), 
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

    } else if (platform === 'shopify') {
      // Get shop domain from integration
      const { data: shopifyIntegration, error: shopifyError } = await supabaseClient
        .from('integrations')
        .select('shop_domain')
        .eq('user_id', user.id)
        .eq('platform', 'shopify')
        .single();

      if (shopifyError || !shopifyIntegration?.shop_domain) {
        console.error('Shopify shop domain not found:', shopifyError);
        return new Response(
          JSON.stringify({ error: 'Shopify shop domain not configured' }), 
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const shopifyDomain = shopifyIntegration.shop_domain;
      console.log('Fetching products from Shopify shop:', shopifyDomain);

      // Step 1: Get products from Shopify
      const productsResponse = await fetch(`https://${shopifyDomain}.myshopify.com/admin/api/2023-10/products.json`, {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': integration.access_token,
          'Content-Type': 'application/json',
        },
      });

      if (!productsResponse.ok) {
        const errorText = await productsResponse.text();
        console.error('Error fetching Shopify products:', errorText);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch products from Shopify' }), 
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const productsData = await productsResponse.json();
      const products = productsData.products || [];

      if (products.length === 0) {
        console.log('No products found in Shopify store');
        return new Response(
          JSON.stringify({ message: 'No products found in your Shopify store', count: 0 }), 
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      console.log(`Found ${products.length} products to import from Shopify`);

      // Step 2: Map Shopify products to our format
      for (const product of products) {
        // Shopify products can have multiple variants
        for (const variant of product.variants || []) {
          const productData = {
            user_id: user.id,
            name: `${product.title}${variant.title !== 'Default Title' ? ` - ${variant.title}` : ''}`,
            sku: variant.sku || variant.id.toString(),
            stock: variant.inventory_quantity || 0,
            selling_price: variant.price ? parseFloat(variant.price) : null,
            image_url: product.image?.src || null,
          };

          productsToInsert.push(productData);
        }
      }
    }

    if (productsToInsert.length === 0) {
      console.log('No valid products to insert');
      return new Response(
        JSON.stringify({ message: 'No valid products found to import', count: 0 }), 
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Prepared ${productsToInsert.length} products for insertion`);

    // Step 5: Upsert products into database
    const { data: insertedProducts, error: insertError } = await supabaseClient
      .from('products')
      .upsert(productsToInsert, { 
        onConflict: 'user_id, sku',
        ignoreDuplicates: false 
      })
      .select();

    if (insertError) {
      console.error('Error inserting products:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save products to database' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Successfully imported ${productsToInsert.length} products`);

    return new Response(
      JSON.stringify({ 
        message: 'Products imported successfully', 
        count: productsToInsert.length 
      }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error in import-products function:', error);
    console.error('Error details:', error.message);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});