import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
    )

    // Get the user from the JWT token
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const { productId, name, sku, cost_price, selling_price, stock } = await req.json()

    if (!productId || !name || !sku) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: productId, name, sku' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('📝 Atualizando produto:', { productId, name, sku, stock, selling_price });

    // Update product in database
    const { data, error } = await supabaseClient
      .from('products')
      .update({
        name,
        sku,
        cost_price: cost_price || null,
        selling_price: selling_price || null,
        stock: stock || 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating product:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to update product' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('✅ Produto atualizado no banco local:', data.id);

    // ========================================================
    // SINCRONIZAÇÃO COM MARKETPLACES
    // ========================================================
    const syncResults: any[] = [];

    // Buscar listings vinculados a este produto
    const { data: listings, error: listingsError } = await supabaseClient
      .from('product_listings')
      .select('id, platform, platform_product_id, integration_id, sync_status')
      .eq('product_id', productId)
      .eq('user_id', user.id);

    if (listingsError) {
      console.warn('⚠️ Erro ao buscar listings:', listingsError);
    }

    if (listings && listings.length > 0) {
      console.log(`🔄 Encontrados ${listings.length} listings vinculados. Sincronizando...`);

      for (const listing of listings) {
        console.log(`📤 Sincronizando com ${listing.platform}...`);

        if (listing.platform === 'amazon') {
          try {
            // Chamar função de sincronização Amazon
            const syncResponse = await fetch(
              `${Deno.env.get('SUPABASE_URL')}/functions/v1/sync-amazon-listing`,
              {
                method: 'POST',
                headers: {
                  'Authorization': req.headers.get('Authorization')!,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  productId: productId,
                  sku: sku,
                  stock: stock,
                  sellingPrice: selling_price,
                  integrationId: listing.integration_id,
                }),
              }
            );

            const syncResult = await syncResponse.json();
            
            if (syncResponse.ok && syncResult.success) {
              console.log(`✅ Amazon sincronizado com sucesso`);
              syncResults.push({
                platform: 'amazon',
                success: true,
                message: 'Sincronizado com sucesso',
              });
            } else {
              console.error(`❌ Erro ao sincronizar Amazon:`, syncResult);
              syncResults.push({
                platform: 'amazon',
                success: false,
                error: syncResult.error || 'Erro desconhecido',
              });
            }
          } catch (syncError: any) {
            console.error(`💥 Exceção ao sincronizar Amazon:`, syncError);
            syncResults.push({
              platform: 'amazon',
              success: false,
              error: syncError.message,
            });
          }
        } else if (listing.platform === 'mercadolivre') {
          // TODO: Implementar sincronização Mercado Livre
          console.log('⏭️ Sincronização Mercado Livre não implementada ainda');
          syncResults.push({
            platform: 'mercadolivre',
            success: false,
            error: 'Sincronização não implementada',
          });
        } else if (listing.platform === 'shopify') {
          // TODO: Implementar sincronização Shopify
          console.log('⏭️ Sincronização Shopify não implementada ainda');
          syncResults.push({
            platform: 'shopify',
            success: false,
            error: 'Sincronização não implementada',
          });
        }
      }
    } else {
      console.log('ℹ️ Nenhum listing vinculado a este produto');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        product: data,
        syncResults: syncResults,
        message: syncResults.length > 0 
          ? `Produto atualizado. ${syncResults.filter(r => r.success).length}/${syncResults.length} marketplaces sincronizados.`
          : 'Produto atualizado localmente.',
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
