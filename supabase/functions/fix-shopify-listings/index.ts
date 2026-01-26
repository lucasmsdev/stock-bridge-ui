import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Esta função corrige product_listings da Shopify com IDs incorretos.
 * 
 * Problema: platform_product_id contém variant.id ao invés de product.id
 * Solução: Buscar dados corretos na API da Shopify e atualizar banco
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: req.headers.get('Authorization')! },
      },
    });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔧 Iniciando correção de listings da Shopify para usuário:', user.id);

    // Buscar todos os listings Shopify do usuário
    const { data: listings, error: listingsError } = await supabaseAdmin
      .from('product_listings')
      .select('id, platform_product_id, platform_variant_id, integration_id, product_id')
      .eq('user_id', user.id)
      .eq('platform', 'shopify');

    if (listingsError || !listings || listings.length === 0) {
      console.log('Nenhum listing Shopify encontrado');
      return new Response(
        JSON.stringify({ message: 'Nenhum listing Shopify encontrado', fixed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Encontrados ${listings.length} listings para verificar`);

    let fixed = 0;
    let errors = 0;
    let skipped = 0;
    const results: Array<{ listingId: string; status: string; details?: string }> = [];

    for (const listing of listings) {
      try {
        // Se platform_product_id tem mais de 12 dígitos, provavelmente é um variant ID
        if (listing.platform_product_id && listing.platform_product_id.length > 12) {
          console.log(`🔍 Verificando listing ${listing.id} (ID suspeito: ${listing.platform_product_id})`);

          // Buscar integração
          const { data: integration } = await supabaseAdmin
            .from('integrations')
            .select('encrypted_access_token, shop_domain')
            .eq('id', listing.integration_id)
            .single();

          if (!integration) {
            console.warn(`⚠️ Integração não encontrada para listing ${listing.id}`);
            results.push({ listingId: listing.id, status: 'error', details: 'Integração não encontrada' });
            errors++;
            continue;
          }

          // Descriptografar token
          const { data: accessToken } = await supabaseAdmin.rpc('decrypt_token', {
            encrypted_token: integration.encrypted_access_token
          });

          if (!accessToken) {
            console.warn(`⚠️ Token não encontrado para listing ${listing.id}`);
            results.push({ listingId: listing.id, status: 'error', details: 'Token não encontrado' });
            errors++;
            continue;
          }

          const shopUrl = integration.shop_domain.includes('.myshopify.com') 
            ? integration.shop_domain 
            : `${integration.shop_domain}.myshopify.com`;

          // Buscar dados da variant na Shopify (platform_product_id é na verdade variant_id)
          const variantResponse = await fetch(
            `https://${shopUrl}/admin/api/2024-01/variants/${listing.platform_product_id}.json`,
            {
              headers: {
                'X-Shopify-Access-Token': accessToken,
                'Content-Type': 'application/json',
              }
            }
          );

          if (variantResponse.ok) {
            const variantData = await variantResponse.json();
            const correctProductId = variantData.variant.product_id.toString();
            const correctVariantId = variantData.variant.id.toString();

            console.log(`✅ IDs corretos encontrados:`, {
              listingId: listing.id,
              incorrectProductId: listing.platform_product_id,
              correctProductId,
              correctVariantId,
            });

            // Atualizar listing com IDs corretos
            const { error: updateError } = await supabaseAdmin
              .from('product_listings')
              .update({
                platform_product_id: correctProductId,
                platform_variant_id: correctVariantId,
                sync_status: 'active',
                sync_error: null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', listing.id);

            if (updateError) {
              console.error(`❌ Erro ao atualizar listing ${listing.id}:`, updateError);
              results.push({ listingId: listing.id, status: 'error', details: updateError.message });
              errors++;
            } else {
              console.log(`✅ Listing ${listing.id} corrigido`);
              results.push({ 
                listingId: listing.id, 
                status: 'fixed', 
                details: `${listing.platform_product_id} → productId: ${correctProductId}, variantId: ${correctVariantId}` 
              });
              fixed++;
            }
          } else if (variantResponse.status === 404) {
            console.log(`⚠️ Variant ${listing.platform_product_id} não encontrada - marcando como disconnected`);
            
            await supabaseAdmin
              .from('product_listings')
              .update({
                sync_status: 'disconnected',
                sync_error: 'Produto/Variant não encontrado na Shopify.',
                updated_at: new Date().toISOString(),
              })
              .eq('id', listing.id);
            
            results.push({ listingId: listing.id, status: 'disconnected', details: 'Variant não existe na Shopify' });
            fixed++;
          } else {
            const errorText = await variantResponse.text();
            console.error(`❌ Erro ao consultar Shopify para listing ${listing.id}:`, variantResponse.status, errorText);
            results.push({ listingId: listing.id, status: 'error', details: `HTTP ${variantResponse.status}` });
            errors++;
          }
        } else {
          // ID parece correto (curto o suficiente para ser product_id)
          console.log(`✓ Listing ${listing.id} parece estar correto (ID: ${listing.platform_product_id})`);
          results.push({ listingId: listing.id, status: 'skipped', details: 'ID parece correto' });
          skipped++;
        }
      } catch (error: any) {
        console.error(`💥 Erro ao processar listing ${listing.id}:`, error.message);
        results.push({ listingId: listing.id, status: 'error', details: error.message });
        errors++;
      }
    }

    console.log(`🎉 Correção concluída: ${fixed} corrigidos, ${skipped} ignorados, ${errors} erros`);

    return new Response(
      JSON.stringify({ 
        message: 'Correção concluída',
        fixed,
        skipped,
        errors,
        total: listings.length,
        results
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Erro inesperado:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
