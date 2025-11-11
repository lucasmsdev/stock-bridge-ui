import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Get integration details
    const { data: integration, error: integrationError } = await supabaseClient
      .from('integrations')
      .select('*')
      .eq('id', integration_id)
      .eq('user_id', user.id)
      .eq('platform', 'shopify')
      .single()

    if (integrationError || !integration) {
      return new Response(
        JSON.stringify({ error: 'Integration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Prepare Shopify payload
    const shopifyPayload: any = {
      product: {
        title: productData.name,
        body_html: productData.description || '',
        vendor: productData.brand || '',
        product_type: productData.category || '',
        status: 'active',
        variants: [
          {
            option1: 'Default',
            price: productData.selling_price?.toString() || '0',
            sku: productData.sku,
            inventory_quantity: productData.stock || 0,
            inventory_management: 'shopify',
            weight: productData.weight || 0,
            weight_unit: 'g',
          }
        ]
      }
    }

    // Add images
    if (productData.images && productData.images.length > 0) {
      shopifyPayload.product.images = productData.images.map((url: string) => ({ src: url }))
    }

    console.log('Creating Shopify product:', shopifyPayload)

    // Create product on Shopify
    const shopifyResponse = await fetch(
      `https://${integration.shop_domain}/admin/api/2024-01/products.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': integration.access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(shopifyPayload)
      }
    )

    const shopifyData = await shopifyResponse.json()

    if (!shopifyResponse.ok) {
      console.error('Shopify API error:', shopifyData)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create product on Shopify', 
          details: shopifyData.errors || shopifyData.error 
        }),
        { status: shopifyResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const productUrl = `https://${integration.shop_domain}/admin/products/${shopifyData.product.id}`

    // Save listing in database
    const { data: listing, error: listingError } = await supabaseClient
      .from('product_listings')
      .insert({
        user_id: user.id,
        product_id,
        platform: 'shopify',
        integration_id,
        platform_product_id: shopifyData.product.id.toString(),
        platform_variant_id: shopifyData.product.variants?.[0]?.id?.toString(),
        platform_url: productUrl,
        sync_status: 'active',
        last_sync_at: new Date().toISOString(),
        platform_metadata: shopifyData.product
      })
      .select()
      .single()

    if (listingError) {
      console.error('Error saving listing:', listingError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        platform_product_id: shopifyData.product.id.toString(),
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
