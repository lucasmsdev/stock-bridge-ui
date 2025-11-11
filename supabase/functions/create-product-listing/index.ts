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

    const { 
      productData, 
      platforms 
    } = await req.json()

    // Validate required fields
    if (!productData || !platforms || platforms.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: productData, platforms' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create product in database
    const { data: product, error: productError } = await supabaseClient
      .from('products')
      .insert({
        user_id: user.id,
        name: productData.name,
        sku: productData.sku,
        cost_price: productData.cost_price || null,
        selling_price: productData.selling_price,
        stock: productData.stock || 0,
        description: productData.description || null,
        category: productData.category || null,
        weight: productData.weight || null,
        dimensions: productData.dimensions || { length: 0, width: 0, height: 0 },
        images: productData.images || [],
        brand: productData.brand || null,
        condition: productData.condition || 'new',
        image_url: productData.images?.[0] || null,
      })
      .select()
      .single()

    if (productError) {
      console.error('Error creating product:', productError)
      return new Response(
        JSON.stringify({ error: 'Failed to create product', details: productError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const results: Record<string, any> = {}

    // Create listings on selected platforms
    for (const platformConfig of platforms) {
      const { platform, integration_id, platformData } = platformConfig

      try {
        let response

        switch (platform) {
          case 'mercadolivre':
            response = await supabaseClient.functions.invoke('create-mercadolivre-product', {
              body: {
                product_id: product.id,
                integration_id,
                productData: { ...productData, ...platformData },
              }
            })
            break

          case 'shopify':
            response = await supabaseClient.functions.invoke('create-shopify-product', {
              body: {
                product_id: product.id,
                integration_id,
                productData: { ...productData, ...platformData },
              }
            })
            break

          case 'shopee':
            response = await supabaseClient.functions.invoke('create-shopee-product', {
              body: {
                product_id: product.id,
                integration_id,
                productData: { ...productData, ...platformData },
              }
            })
            break

          case 'amazon':
            response = await supabaseClient.functions.invoke('create-amazon-product', {
              body: {
                product_id: product.id,
                integration_id,
                productData: { ...productData, ...platformData },
              }
            })
            break

          default:
            results[platform] = {
              success: false,
              error: `Platform ${platform} not yet implemented`
            }
            continue
        }

        if (response.error) {
          results[platform] = {
            success: false,
            error: response.error.message || 'Unknown error'
          }
        } else {
          results[platform] = {
            success: true,
            ...response.data
          }
        }
      } catch (error) {
        console.error(`Error creating listing on ${platform}:`, error)
        results[platform] = {
          success: false,
          error: error.message || 'Unknown error'
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        product_id: product.id,
        results
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
