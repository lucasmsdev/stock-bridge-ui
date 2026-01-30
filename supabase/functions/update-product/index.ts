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

    const { productId, name, sku, cost_price, selling_price, stock, image_url, supplier_id, description } = await req.json()

    if (!productId || !name || !sku) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: productId, name, sku' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('📝 Atualizando produto:', { productId, name, sku, stock, selling_price, image_url, supplier_id, description: description?.substring(0, 50) + '...' });

    // Build update object dynamically (only include fields that were provided)
    const updateFields: Record<string, any> = {
      name,
      sku,
      updated_at: new Date().toISOString(),
    };

    if (cost_price !== undefined) updateFields.cost_price = cost_price || null;
    if (selling_price !== undefined) updateFields.selling_price = selling_price || null;
    if (stock !== undefined) updateFields.stock = stock || 0;
    if (image_url !== undefined) updateFields.image_url = image_url || null;
    if (supplier_id !== undefined) updateFields.supplier_id = supplier_id || null;
    if (description !== undefined) updateFields.description = description || null;

    // Update product in database
    const { data, error } = await supabaseClient
      .from('products')
      .update(updateFields)
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
      .select('id, platform, platform_product_id, platform_variant_id, integration_id, sync_status')
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
                  name: name,
                  imageUrl: image_url,
                  integrationId: listing.integration_id,
                  description: description,
                }),
              }
            );

            const syncResult = await syncResponse.json();
            
            if (syncResponse.ok && syncResult.success) {
              console.log(`✅ Amazon sincronizado com sucesso`);
              console.log(`📋 Amazon response details:`, JSON.stringify(syncResult, null, 2));
              syncResults.push({
                platform: 'amazon',
                success: true,
                message: syncResult.message || 'Sincronizado com sucesso',
                // Dados enviados
                sentData: syncResult.sentData || null,
                // Dados observados (separando offer e list price)
                observedAmazonOfferPrice: syncResult.observedAmazonOfferPrice ?? syncResult.observedAmazonPrice ?? null,
                observedAmazonListPrice: syncResult.observedAmazonListPrice ?? null,
                observedAmazonStock: syncResult.observedAmazonStock ?? null,
                observedAmazonTitle: syncResult.observedAmazonTitle || null,
                observedAmazonMainImage: syncResult.observedAmazonMainImage || null,
                submissionId: syncResult.submissionId || null,
                issues: syncResult.issues || [],
                nameMayNotChange: syncResult.nameMayNotChange || false,
              });
            } else {
              console.error(`❌ Erro ao sincronizar Amazon:`, syncResult);
              syncResults.push({
                platform: 'amazon',
                success: false,
                error: syncResult.error || 'Erro desconhecido',
                requiresSellerId: syncResult.requiresSellerId || false,
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
          try {
            // Chamar função de sincronização Mercado Livre
            const syncResponse = await fetch(
              `${Deno.env.get('SUPABASE_URL')}/functions/v1/sync-mercadolivre-listing`,
              {
                method: 'POST',
                headers: {
                  'Authorization': req.headers.get('Authorization')!,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  productId: productId,
                  listingId: listing.id,
                  integrationId: listing.integration_id,
                  platformProductId: listing.platform_product_id,
                  sellingPrice: selling_price,
                  stock: stock,
                  name: name,
                  imageUrl: image_url,
                  description: description,
                }),
              }
            );

            const syncResult = await syncResponse.json();
            
            if (syncResponse.ok && syncResult.success) {
              console.log(`✅ Mercado Livre sincronizado com sucesso`);
              syncResults.push({
                platform: 'mercadolivre',
                success: true,
                message: syncResult.message || 'Sincronizado com sucesso',
                updatedFields: syncResult.updatedFields || [],
                warnings: syncResult.warnings || [],
              });
            } else {
              console.error(`❌ Erro ao sincronizar Mercado Livre:`, syncResult);
              syncResults.push({
                platform: 'mercadolivre',
                success: false,
                error: syncResult.error || 'Erro desconhecido',
                requiresReconnect: syncResult.requiresReconnect || false,
              });
            }
          } catch (syncError: any) {
            console.error(`💥 Exceção ao sincronizar Mercado Livre:`, syncError);
            syncResults.push({
              platform: 'mercadolivre',
              success: false,
              error: syncError.message,
            });
          }
        } else if (listing.platform === 'shopify') {
          try {
            // Chamar função de sincronização Shopify
            const syncResponse = await fetch(
              `${Deno.env.get('SUPABASE_URL')}/functions/v1/sync-shopify-listing`,
              {
                method: 'POST',
                headers: {
                  'Authorization': req.headers.get('Authorization')!,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  productId: productId,
                  listingId: listing.id,
                  integrationId: listing.integration_id,
                  platformProductId: listing.platform_product_id,
                  platformVariantId: listing.platform_variant_id,
                  sellingPrice: selling_price,
                  stock: stock,
                  name: name,
                  imageUrl: image_url,
                  description: description,
                }),
              }
            );

            const syncResult = await syncResponse.json();
            
            if (syncResponse.ok && syncResult.success) {
              console.log(`✅ Shopify sincronizado com sucesso`);
              syncResults.push({
                platform: 'shopify',
                success: true,
                message: syncResult.message || 'Sincronizado com sucesso',
                updatedFields: syncResult.updatedFields || [],
                warnings: syncResult.warnings || [],
              });
            } else {
              console.error(`❌ Erro ao sincronizar Shopify:`, syncResult);
              syncResults.push({
                platform: 'shopify',
                success: false,
                error: syncResult.error || 'Erro desconhecido',
                requiresReconnect: syncResult.requiresReconnect || false,
              });
            }
          } catch (syncError: any) {
            console.error(`💥 Exceção ao sincronizar Shopify:`, syncError);
            syncResults.push({
              platform: 'shopify',
              success: false,
              error: syncError.message,
            });
          }
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
