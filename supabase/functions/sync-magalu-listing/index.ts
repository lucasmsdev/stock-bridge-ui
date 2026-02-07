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

    const body = await req.json();
    const { product_id, listing_id } = body;

    if (!product_id || !listing_id) {
      return new Response(
        JSON.stringify({ error: 'product_id and listing_id are required' }),
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

    // Get listing with integration
    const { data: listing, error: listingError } = await supabase
      .from('product_listings')
      .select('*, integrations(*)')
      .eq('id', listing_id)
      .eq('platform', 'magalu')
      .single();

    if (listingError || !listing) {
      return new Response(
        JSON.stringify({ error: 'Listing not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decrypt access token
    const { data: accessToken, error: decryptError } = await supabase.rpc('decrypt_token', {
      encrypted_token: listing.integrations.encrypted_access_token
    });

    if (decryptError || !accessToken) {
      return new Response(
        JSON.stringify({ error: 'Failed to decrypt access token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sku = listing.platform_product_id;
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    const results = {
      price_updated: false,
      stock_updated: false,
      errors: [] as string[],
    };

    // Update price on Magalu
    if (product.selling_price != null) {
      try {
        console.log(`💰 Atualizando preço do SKU ${sku} no Magalu: R$${product.selling_price}`);
        const priceResponse = await fetch(`https://api.magalu.com/seller/v1/portfolios/prices`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            sku: sku,
            price: product.selling_price,
          }),
        });

        if (priceResponse.ok) {
          results.price_updated = true;
          console.log('✅ Preço atualizado com sucesso no Magalu');
        } else {
          const errorText = await priceResponse.text();
          console.error('❌ Erro ao atualizar preço no Magalu:', errorText);
          results.errors.push(`Preço: ${priceResponse.status} - ${errorText}`);
        }
      } catch (err: any) {
        console.error('❌ Erro ao atualizar preço:', err);
        results.errors.push(`Preço: ${err.message}`);
      }
    }

    // Update stock on Magalu
    try {
      console.log(`📦 Atualizando estoque do SKU ${sku} no Magalu: ${product.stock}`);
      const stockResponse = await fetch(`https://api.magalu.com/seller/v1/portfolios/stocks`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          sku: sku,
          quantity: product.stock || 0,
        }),
      });

      if (stockResponse.ok) {
        results.stock_updated = true;
        console.log('✅ Estoque atualizado com sucesso no Magalu');
      } else {
        const errorText = await stockResponse.text();
        console.error('❌ Erro ao atualizar estoque no Magalu:', errorText);
        results.errors.push(`Estoque: ${stockResponse.status} - ${errorText}`);
      }
    } catch (err: any) {
      console.error('❌ Erro ao atualizar estoque:', err);
      results.errors.push(`Estoque: ${err.message}`);
    }

    // Update sync status
    const syncStatus = results.errors.length === 0 ? 'active' : 'error';
    await supabase
      .from('product_listings')
      .update({
        sync_status: syncStatus,
        sync_error: results.errors.length > 0 ? results.errors.join('; ') : null,
        last_sync_at: new Date().toISOString(),
      })
      .eq('id', listing_id);

    return new Response(
      JSON.stringify({
        success: results.errors.length === 0,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Unexpected error in sync-magalu-listing:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
