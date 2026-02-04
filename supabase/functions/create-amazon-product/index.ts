import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Amazon SP-API endpoint
const AMAZON_API_ENDPOINT = 'https://sellingpartnerapi-na.amazon.com'

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
      .select('encrypted_refresh_token, selling_partner_id, marketplace_id')
      .eq('id', integration_id)
      .eq('user_id', user.id)
      .eq('platform', 'amazon')
      .single()

    if (integrationError || !integration) {
      return new Response(
        JSON.stringify({ error: 'Integration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Decrypt refresh token
    const { data: refreshToken, error: decryptError } = await supabaseClient.rpc('decrypt_token', {
      encrypted_token: integration.encrypted_refresh_token
    });

    if (decryptError || !refreshToken) {
      console.error('Failed to decrypt refresh token:', decryptError);
      return new Response(
        JSON.stringify({ error: 'Erro ao descriptografar refresh token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Amazon credentials
    const clientId = Deno.env.get('AMAZON_CLIENT_ID')
    const clientSecret = Deno.env.get('AMAZON_CLIENT_SECRET')

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: 'Amazon credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get marketplace ID
    const marketplaceId = integration.marketplace_id || 'ATVPDKIKX0DER' // US marketplace

    // First, we need to get a fresh access token
    const tokenResponse = await fetch('https://api.amazon.com/auth/o2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      })
    })

    const tokenData = await tokenResponse.json()

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error('Error refreshing Amazon token:', tokenData)
      return new Response(
        JSON.stringify({ error: 'Failed to refresh Amazon access token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const accessToken = tokenData.access_token

    // Prepare Amazon SP-API payload using Listings Items API 2021-08-01
    const sellerSku = productData.sku
    
    // Map generic category to Amazon product_type
    const productTypeMapping: Record<string, string> = {
      'electronics': 'ELECTRONIC_DEVICE',
      'eletronicos': 'ELECTRONIC_DEVICE',
      'clothing': 'SHIRT',
      'roupas': 'SHIRT',
      'home': 'HOME',
      'casa': 'HOME',
      'toys': 'TOY',
      'brinquedos': 'TOY',
      'sports': 'SPORTING_GOODS',
      'esportes': 'SPORTING_GOODS',
      'books': 'BOOK',
      'livros': 'BOOK',
      'beauty': 'BEAUTY',
      'beleza': 'BEAUTY',
      'default': 'PRODUCT'
    }

    const categoryKey = productData.category?.toLowerCase() || 'default'
    const productType = productData.amazon_product_type || 
                        productTypeMapping[categoryKey] || 
                        productTypeMapping['default']

    // Build bullet points from description
    const bulletPoints = []
    if (productData.description) {
      const lines = productData.description.split('\n').filter((line: string) => line.trim())
      bulletPoints.push(...lines.slice(0, 5).map((line: string) => line.substring(0, 500)))
    }
    if (bulletPoints.length === 0) {
      bulletPoints.push(productData.name)
    }

    // Prepare basic attributes that work for most product types
    const amazonPayload = {
      productType: productType,
      requirements: 'LISTING',
      attributes: {
        condition_type: [
          {
            value: productData.condition === 'new' ? 'new_new' : 'used_like_new',
            marketplace_id: marketplaceId
          }
        ],
        item_name: [
          {
            value: productData.name.substring(0, 200), // Amazon limit
            language_tag: 'pt_BR',
            marketplace_id: marketplaceId
          }
        ],
        bullet_point: bulletPoints.map((point: string) => ({
          value: point,
          language_tag: 'pt_BR',
          marketplace_id: marketplaceId
        })),
        externally_assigned_product_identifier: [
          {
            marketplace_id: marketplaceId,
            type: 'sku',
            value: sellerSku
          }
        ]
      }
    }

    // Add brand (required for most categories)
    if (productData.brand) {
      amazonPayload.attributes.brand = [
        {
          value: productData.brand,
          marketplace_id: marketplaceId
        }
      ]
    }

    // Add manufacturer info (optional but recommended)
    if (productData.brand) {
      amazonPayload.attributes.manufacturer = [
        {
          value: productData.brand,
          marketplace_id: marketplaceId
        }
      ]
    }

    // Add pricing
    if (productData.selling_price) {
      amazonPayload.attributes.purchasable_offer = [
        {
          marketplace_id: marketplaceId,
          currency: 'BRL',
          our_price: [
            {
              schedule: [
                {
                  value_with_tax: parseFloat(productData.selling_price.toString())
                }
              ]
            }
          ]
        }
      ]
    }

    // Add images
    if (productData.images && productData.images.length > 0) {
      amazonPayload.attributes.main_product_image_locator = [
        {
          media_location: productData.images[0],
          marketplace_id: marketplaceId
        }
      ]

      // Add up to 8 additional images
      if (productData.images.length > 1) {
        const additionalImages = productData.images.slice(1, 9)
        additionalImages.forEach((url: string, index: number) => {
          const key = `other_product_image_locator_${index + 1}`
          amazonPayload.attributes[key] = [
            {
              media_location: url,
              marketplace_id: marketplaceId
            }
          ]
        })
      }
    }

    // Add fulfillment and inventory
    if (productData.stock !== undefined) {
      amazonPayload.attributes.fulfillment_availability = [
        {
          fulfillment_channel_code: 'DEFAULT',
          quantity: parseInt(productData.stock.toString()),
          marketplace_id: marketplaceId
        }
      ]
    }

    // Add product description (optional)
    if (productData.description) {
      amazonPayload.attributes.product_description = [
        {
          value: productData.description.substring(0, 2000),
          language_tag: 'pt_BR',
          marketplace_id: marketplaceId
        }
      ]
    }

    // Add package dimensions if available
    if (productData.dimensions) {
      const dims = productData.dimensions
      if (dims.length && dims.width && dims.height) {
        amazonPayload.attributes.item_package_dimensions = [
          {
            length: {
              unit: 'centimeters',
              value: parseFloat(dims.length.toString())
            },
            width: {
              unit: 'centimeters',
              value: parseFloat(dims.width.toString())
            },
            height: {
              unit: 'centimeters',
              value: parseFloat(dims.height.toString())
            },
            marketplace_id: marketplaceId
          }
        ]
      }
    }

    // Add weight if available
    if (productData.weight) {
      amazonPayload.attributes.item_package_weight = [
        {
          unit: 'grams',
          value: parseFloat(productData.weight.toString()),
          marketplace_id: marketplaceId
        }
      ]
    }

    console.log('Creating Amazon product with SKU:', sellerSku)

    // Create product on Amazon using SP-API
    const amazonResponse = await fetch(
      `${AMAZON_API_ENDPOINT}/listings/2021-08-01/items/${integration.selling_partner_id}/${sellerSku}`,
      {
        method: 'PUT',
        headers: {
          'x-amz-access-token': accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(amazonPayload)
      }
    )

    const amazonData = await amazonResponse.json()

    if (!amazonResponse.ok) {
      console.error('Amazon API error:', amazonData)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create product on Amazon', 
          details: amazonData.errors || amazonData.error,
          note: 'Amazon SP-API requires specific product type schemas. This is a complex integration that may require category-specific configuration.'
        }),
        { status: amazonResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Amazon doesn't return ASIN immediately, we need to check the submission status
    const asin = amazonData.asin || sellerSku // Use SKU as fallback

    // Construct product URL
    const productUrl = asin.startsWith('B0') 
      ? `https://www.amazon.com.br/dp/${asin}` 
      : `https://sellercentral.amazon.com.br/inventory?q=${sellerSku}`

    // Save listing in database
    const { data: listing, error: listingError } = await supabaseClient
      .from('product_listings')
      .insert({
        user_id: user.id,
        product_id,
        platform: 'amazon',
        integration_id,
        platform_product_id: asin,
        platform_variant_id: sellerSku,
        platform_url: productUrl,
        sync_status: 'active',
        last_sync_at: new Date().toISOString(),
        platform_metadata: amazonData
      })
      .select()
      .single()

    if (listingError) {
      console.error('Error saving listing:', listingError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        platform_product_id: asin,
        platform_url: productUrl,
        listing_id: listing?.id,
        note: 'Product submitted to Amazon. It may take a few minutes for the listing to be processed.'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
