import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper to generate Shopee API signature
function generateShopeeSign(path: string, timestamp: number, accessToken: string, shopId: string, partnerKey: string): string {
  const baseString = `${partnerKey}${path}${timestamp}${accessToken}${shopId}`
  
  // Use Web Crypto API for HMAC-SHA256
  const encoder = new TextEncoder()
  const keyData = encoder.encode(partnerKey)
  const data = encoder.encode(baseString)
  
  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  ).then(key => 
    crypto.subtle.sign('HMAC', key, data)
  ).then(signature => 
    Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  )
}

serve(async (req) => {
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
    )

    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { product_id, integration_id, productData } = await req.json()

    if (!product_id || !integration_id || !productData) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get integration details with encrypted token
    const { data: integration, error: integrationError } = await supabaseClient
      .from('integrations')
      .select('encrypted_access_token, platform_metadata, selling_partner_id')
      .eq('id', integration_id)
      .eq('user_id', user.id)
      .eq('platform', 'shopee')
      .single()

    if (integrationError || !integration) {
      return new Response(
        JSON.stringify({ error: 'Integration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Decrypt access token
    const { data: accessToken, error: decryptError } = await supabaseClient.rpc('decrypt_token', {
      encrypted_token: integration.encrypted_access_token
    });

    if (decryptError || !accessToken) {
      console.error('Failed to decrypt token:', decryptError);
      return new Response(
        JSON.stringify({ error: 'Erro ao descriptografar token de acesso' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Shopee credentials from environment
    const partnerId = Deno.env.get('SHOPEE_PARTNER_ID')
    const partnerKey = Deno.env.get('SHOPEE_PARTNER_KEY')

    if (!partnerId || !partnerKey) {
      return new Response(
        JSON.stringify({ error: 'Shopee credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extract shop_id from integration metadata
    const shopId = integration.platform_metadata?.shop_id || integration.selling_partner_id

    if (!shopId) {
      return new Response(
        JSON.stringify({ error: 'Shop ID not found in integration' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Prepare Shopee API call
    const path = '/api/v2/product/add_item'
    const timestamp = Math.floor(Date.now() / 1000)
    const sign = await generateShopeeSign(path, timestamp, accessToken, shopId, partnerKey)

    // Prepare Shopee payload
    const shopeePayload: any = {
      item_name: productData.name.substring(0, 100), // Shopee max length
      description: productData.description || productData.name,
      original_price: productData.selling_price,
      normal_stock: productData.stock || 0,
      item_status: 'NORMAL',
      weight: productData.weight ? productData.weight / 1000 : 0.1, // Convert g to kg, default 0.1kg
    }

    // Add category if provided
    if (productData.category_id) {
      shopeePayload.category_id = productData.category_id
    }

    // Add brand if provided
    if (productData.brand) {
      shopeePayload.brand = {
        brand_id: 0,
        original_brand_name: productData.brand
      }
    }

    // Add dimensions
    if (productData.dimensions) {
      shopeePayload.dimension = {
        package_length: Math.ceil(productData.dimensions.length || 10),
        package_width: Math.ceil(productData.dimensions.width || 10),
        package_height: Math.ceil(productData.dimensions.height || 5)
      }
    }

    // Add images
    if (productData.images && productData.images.length > 0) {
      shopeePayload.image = {
        image_url_list: productData.images.slice(0, 9) // Shopee max 9 images
      }
    }

    // Add logistic (default to standard shipping)
    shopeePayload.logistic_info = [
      {
        enabled: true,
        shipping_fee: 0,
        is_free: true
      }
    ]

    console.log('Creating Shopee product:', shopeePayload)

    // Create product on Shopee
    const shopeeUrl = `https://partner.shopeemobile.com${path}?partner_id=${partnerId}&timestamp=${timestamp}&access_token=${accessToken}&shop_id=${shopId}&sign=${sign}`
    
    const shopeeResponse = await fetch(shopeeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(shopeePayload)
    })

    const shopeeData = await shopeeResponse.json()

    if (!shopeeResponse.ok || shopeeData.error) {
      console.error('Shopee API error:', shopeeData)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create product on Shopee', 
          details: shopeeData.message || shopeeData.error 
        }),
        { status: shopeeResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const itemId = shopeeData.response?.item_id

    if (!itemId) {
      return new Response(
        JSON.stringify({ error: 'No item_id returned from Shopee' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Construct product URL (may vary by region)
    const productUrl = `https://shopee.com.br/product/${shopId}/${itemId}`

    // Save listing in database
    const { data: listing, error: listingError } = await supabaseClient
      .from('product_listings')
      .insert({
        user_id: user.id,
        product_id,
        platform: 'shopee',
        integration_id,
        platform_product_id: itemId.toString(),
        platform_url: productUrl,
        sync_status: 'active',
        last_sync_at: new Date().toISOString(),
        platform_metadata: shopeeData.response
      })
      .select()
      .single()

    if (listingError) {
      console.error('Error saving listing:', listingError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        platform_product_id: itemId.toString(),
        platform_url: productUrl,
        listing_id: listing?.id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
