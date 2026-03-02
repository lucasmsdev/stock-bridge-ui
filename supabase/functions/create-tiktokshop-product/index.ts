import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// HMAC-SHA256 signature helper for TikTok Shop API
async function generateSign(
  path: string,
  params: Record<string, string>,
  appSecret: string
): Promise<string> {
  const sortedKeys = Object.keys(params).sort();
  const paramString = sortedKeys.map(key => `${key}${params[key]}`).join('');
  const baseString = `${appSecret}${path}${paramString}${appSecret}`;
  
  const encoder = new TextEncoder();
  const keyData = encoder.encode(appSecret);
  const messageData = encoder.encode(baseString);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify JWT and get user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { product_id, integration_id } = body;

    if (!product_id || !integration_id) {
      return new Response(
        JSON.stringify({ error: 'product_id and integration_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's organization_id
    const { data: userOrg } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    const organizationId = userOrg?.organization_id || null;

    // Get integration
    const { data: integration, error: intError } = await supabase
      .from('integrations')
      .select('*')
      .eq('id', integration_id)
      .eq('user_id', user.id)
      .eq('platform', 'tiktokshop')
      .single();

    if (intError || !integration) {
      return new Response(
        JSON.stringify({ error: 'TikTok Shop integration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get product from database
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

    // Decrypt access token
    const { data: accessToken, error: decryptError } = await supabase.rpc('decrypt_token', {
      encrypted_token: integration.encrypted_access_token
    });

    if (decryptError || !accessToken) {
      return new Response(
        JSON.stringify({ error: 'Failed to decrypt access token. Reconnect your TikTok Shop account.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const appKey = Deno.env.get('TIKTOK_SHOP_APP_KEY')!;
    const appSecret = Deno.env.get('TIKTOK_SHOP_APP_SECRET')!;
    const shopCipher = integration.selling_partner_id;

    // Build product payload for TikTok Shop API
    const productPayload = {
      title: product.name,
      description: product.description || product.name,
      skus: [{
        seller_sku: product.sku,
        price: {
          sale_price: String(Math.round((product.selling_price || 0) * 100)), // Price in cents
          currency: 'BRL',
        },
        stock_infos: [{
          available_stock: product.stock || 0,
        }],
      }],
    };

    // Add images if available
    if (product.images && Array.isArray(product.images) && product.images.length > 0) {
      (productPayload as any).main_images = product.images.slice(0, 9).map((url: string) => ({
        uri: url,
      }));
    }

    // Generate signature for the API call
    const path = '/api/products';
    const timestamp = Math.floor(Date.now() / 1000);
    const queryParams: Record<string, string> = {
      app_key: appKey,
      timestamp: timestamp.toString(),
      shop_cipher: shopCipher,
    };

    const sign = await generateSign(path, queryParams, appSecret);

    // Create product on TikTok Shop
    const createUrl = `https://open-api.tiktokglobalshop.com${path}?app_key=${appKey}&timestamp=${timestamp}&sign=${sign}&shop_cipher=${shopCipher}&access_token=${accessToken}`;

    console.log('🛍️ Creating product on TikTok Shop:', product.name);

    const createResponse = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(productPayload),
    });

    const createResult = await createResponse.json();

    if (createResult.code !== 0) {
      console.error('TikTok Shop create product failed:', createResult);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create product on TikTok Shop',
          details: createResult.message || createResult.msg || 'Unknown error'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tiktokProductId = createResult.data?.product_id;
    console.log('✅ Product created on TikTok Shop:', tiktokProductId);

    // Save listing in product_listings
    if (tiktokProductId) {
      const { error: listingError } = await supabase
        .from('product_listings')
        .upsert({
          user_id: user.id,
          organization_id: organizationId,
          product_id: product.id,
          platform: 'tiktokshop',
          platform_product_id: tiktokProductId,
          integration_id: integration.id,
          sync_status: 'active',
          last_sync_at: new Date().toISOString(),
        }, {
          onConflict: 'product_id,integration_id',
        });

      if (listingError) {
        console.warn('⚠️ Error saving product listing:', listingError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        product_id: tiktokProductId,
        message: `Produto "${product.name}" criado no TikTok Shop com sucesso.`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in create-tiktokshop-product:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});