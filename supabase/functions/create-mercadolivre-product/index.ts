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
      .eq('platform', 'mercadolivre')
      .single()

    if (integrationError || !integration) {
      return new Response(
        JSON.stringify({ error: 'Integration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Prepare Mercado Livre payload
    const mlPayload: any = {
      title: productData.name.substring(0, 60), // ML max title length
      price: productData.selling_price,
      currency_id: 'BRL',
      available_quantity: productData.stock || 0,
      buying_mode: 'buy_it_now',
      condition: productData.condition || 'new',
      listing_type_id: productData.listing_type_id || 'gold_special',
    }

    // Add category if provided
    if (productData.category_id) {
      mlPayload.category_id = productData.category_id
    }

    // Add description
    if (productData.description) {
      mlPayload.description = {
        plain_text: productData.description
      }
    }

    // Add pictures
    if (productData.images && productData.images.length > 0) {
      mlPayload.pictures = productData.images.map((url: string) => ({ source: url }))
    }

    // Add shipping info
    if (productData.weight) {
      mlPayload.shipping = {
        mode: 'me2',
        free_shipping: productData.free_shipping || false,
        dimensions: productData.dimensions ? 
          `${productData.dimensions.length}x${productData.dimensions.width}x${productData.dimensions.height},${productData.weight}` : 
          null
      }
    }

    console.log('Creating Mercado Livre product:', mlPayload)

    // Create product on Mercado Livre
    const mlResponse = await fetch('https://api.mercadolibre.com/items', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${integration.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mlPayload)
    })

    const mlData = await mlResponse.json()

    if (!mlResponse.ok) {
      console.error('Mercado Livre API error:', mlData)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create product on Mercado Livre', 
          details: mlData.message || mlData.error 
        }),
        { status: mlResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Save listing in database
    const { data: listing, error: listingError } = await supabaseClient
      .from('product_listings')
      .insert({
        user_id: user.id,
        product_id,
        platform: 'mercadolivre',
        integration_id,
        platform_product_id: mlData.id,
        platform_url: mlData.permalink,
        sync_status: 'active',
        last_sync_at: new Date().toISOString(),
        platform_metadata: mlData
      })
      .select()
      .single()

    if (listingError) {
      console.error('Error saving listing:', listingError)
      // Product was created on ML but failed to save in DB
      // Consider deleting from ML or implementing retry logic
    }

    return new Response(
      JSON.stringify({
        success: true,
        platform_product_id: mlData.id,
        platform_url: mlData.permalink,
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
