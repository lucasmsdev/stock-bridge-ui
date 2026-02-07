import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify JWT
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's organization_id
    const { data: userOrg } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    const organizationId = userOrg?.organization_id || null;

    const body = await req.json();
    const { product_id, integration_id } = body;

    if (!product_id || !integration_id) {
      return new Response(
        JSON.stringify({ error: 'product_id and integration_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get product data
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', product_id)
      .eq('user_id', user.id)
      .single();

    if (productError || !product) {
      return new Response(
        JSON.stringify({ error: 'Product not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get integration
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('*')
      .eq('id', integration_id)
      .eq('platform', 'magalu')
      .eq('user_id', user.id)
      .single();

    if (integrationError || !integration) {
      return new Response(
        JSON.stringify({ error: 'Magalu integration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decrypt access token
    const { data: accessToken, error: decryptError } = await supabase.rpc('decrypt_token', {
      encrypted_token: integration.encrypted_access_token
    });

    if (decryptError || !accessToken) {
      return new Response(
        JSON.stringify({ error: 'Failed to decrypt access token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    const results = {
      sku_created: false,
      price_set: false,
      stock_set: false,
      errors: [] as string[],
    };

    // Step 1: Create SKU on Magalu portfolio
    try {
      console.log(`📦 Criando SKU ${product.sku} no portfólio Magalu...`);

      const skuPayload: any = {
        sku: product.sku,
        title: product.name,
      };

      if (product.description) skuPayload.description = product.description;
      if (product.brand) skuPayload.brand = product.brand;
      if (product.ean) skuPayload.ean = product.ean;

      // Add images if available
      if (product.images && Array.isArray(product.images) && product.images.length > 0) {
        skuPayload.images = product.images.map((url: string, index: number) => ({
          url,
          order: index + 1,
        }));
      } else if (product.image_url) {
        skuPayload.images = [{ url: product.image_url, order: 1 }];
      }

      // Add dimensions if available
      if (product.dimensions) {
        const dims = typeof product.dimensions === 'string' ? JSON.parse(product.dimensions) : product.dimensions;
        if (dims.height) skuPayload.height = dims.height;
        if (dims.width) skuPayload.width = dims.width;
        if (dims.length) skuPayload.length = dims.length;
      }
      if (product.weight) skuPayload.weight = product.weight;

      const createResponse = await fetch('https://api.magalu.com/seller/v1/portfolios/skus', {
        method: 'POST',
        headers,
        body: JSON.stringify(skuPayload),
      });

      if (createResponse.ok || createResponse.status === 201) {
        results.sku_created = true;
        console.log('✅ SKU criado com sucesso no Magalu');
      } else {
        const errorText = await createResponse.text();
        console.error('❌ Erro ao criar SKU no Magalu:', errorText);
        results.errors.push(`SKU: ${createResponse.status} - ${errorText}`);
      }
    } catch (err: any) {
      console.error('❌ Erro ao criar SKU:', err);
      results.errors.push(`SKU: ${err.message}`);
    }

    // Step 2: Set price
    if (product.selling_price != null) {
      try {
        console.log(`💰 Definindo preço do SKU ${product.sku}: R$${product.selling_price}`);
        const priceResponse = await fetch('https://api.magalu.com/seller/v1/portfolios/prices', {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            sku: product.sku,
            price: product.selling_price,
          }),
        });

        if (priceResponse.ok) {
          results.price_set = true;
          console.log('✅ Preço definido com sucesso');
        } else {
          const errorText = await priceResponse.text();
          console.error('❌ Erro ao definir preço:', errorText);
          results.errors.push(`Preço: ${priceResponse.status} - ${errorText}`);
        }
      } catch (err: any) {
        results.errors.push(`Preço: ${err.message}`);
      }
    }

    // Step 3: Set stock
    try {
      console.log(`📦 Definindo estoque do SKU ${product.sku}: ${product.stock}`);
      const stockResponse = await fetch('https://api.magalu.com/seller/v1/portfolios/stocks', {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          sku: product.sku,
          quantity: product.stock || 0,
        }),
      });

      if (stockResponse.ok) {
        results.stock_set = true;
        console.log('✅ Estoque definido com sucesso');
      } else {
        const errorText = await stockResponse.text();
        console.error('❌ Erro ao definir estoque:', errorText);
        results.errors.push(`Estoque: ${stockResponse.status} - ${errorText}`);
      }
    } catch (err: any) {
      results.errors.push(`Estoque: ${err.message}`);
    }

    // Step 4: Create product_listing record
    if (results.sku_created) {
      const { error: listingError } = await supabase
        .from('product_listings')
        .upsert({
          user_id: user.id,
          organization_id: organizationId,
          product_id: product.id,
          platform: 'magalu',
          platform_product_id: product.sku,
          integration_id: integration.id,
          sync_status: results.errors.length === 0 ? 'active' : 'error',
          sync_error: results.errors.length > 0 ? results.errors.join('; ') : null,
          last_sync_at: new Date().toISOString(),
        }, {
          onConflict: 'product_id,integration_id',
        });

      if (listingError) {
        console.warn('⚠️ Erro ao criar registro em product_listings:', listingError);
      }
    }

    return new Response(
      JSON.stringify({
        success: results.sku_created,
        results,
      }),
      { status: results.sku_created ? 200 : 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Unexpected error in create-magalu-product:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
