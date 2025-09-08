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
      console.log('Mercado Livre User ID:', mlUserId);

      // Step 2: Get user items IDs using the actual user ID
      const itemsResponse = await fetch(`https://api.mercadolibre.com/users/${mlUserId}/items/search`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${integration.access_token}`,
        },
      });

      if (!itemsResponse.ok) {
        const errorText = await itemsResponse.text();
        console.error('Error fetching user items:', errorText);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch items from Mercado Livre' }), 
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const itemsData = await itemsResponse.json();
      const itemIds = itemsData.results;

      if (!itemIds || itemIds.length === 0) {
        console.log('No items found for user');
        return new Response(
          JSON.stringify({ message: 'No products found in your Mercado Livre account', count: 0 }), 
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      console.log(`Found ${itemIds.length} items to import`);

      // Step 3: Get detailed information for all items
      const idsString = itemIds.join(',');
      const detailsResponse = await fetch(`https://api.mercadolibre.com/items?ids=${idsString}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${integration.access_token}`,
        },
      });

      if (!detailsResponse.ok) {
        const errorText = await detailsResponse.text();
        console.error('Error fetching item details:', errorText);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch item details from Mercado Livre' }), 
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const detailsData = await detailsResponse.json();
      console.log(`Retrieved details for ${detailsData.length} items`);

      // Step 4: Map and prepare products for insertion
      for (const itemResponse of detailsData) {
        if (itemResponse.code === 200 && itemResponse.body) {
          const item = itemResponse.body;
          
          // Extract product data
          const product = {
            user_id: user.id,
            name: item.title,
            sku: item.seller_sku || item.id,
            stock: item.available_quantity || 0,
            image_url: item.thumbnail || null,
          };

          productsToInsert.push(product);
        }
      }

    } else if (platform === 'shopify') {
      // Extract shop domain from access token metadata or require it as parameter
      const shopifyDomain = integration.shop_domain; // We'll need to store this during auth
      
      if (!shopifyDomain) {
        console.error('Shopify shop domain not found');
        return new Response(
          JSON.stringify({ error: 'Shopify shop domain not configured' }), 
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

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

    return new Response(
      JSON.stringify({ error: 'Platform not supported yet' }), 
      { 
        status: 400, 
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