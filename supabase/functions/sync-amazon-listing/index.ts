import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      console.error('❌ Erro de autenticação:', userError);
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { productId, sku, stock, sellingPrice, integrationId } = await req.json();

    console.log('🔄 Sincronizando produto Amazon:', { productId, sku, stock, sellingPrice, integrationId });

    if (!productId || !sku || !integrationId) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios: productId, sku, integrationId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar integração Amazon
    const { data: integration, error: integrationError } = await supabaseClient
      .from('integrations')
      .select('id, platform, access_token, refresh_token, encrypted_access_token, encrypted_refresh_token, encryption_migrated, marketplace_id, selling_partner_id, account_name')
      .eq('id', integrationId)
      .eq('user_id', user.id)
      .single();

    if (integrationError || !integration) {
      console.error('❌ Integração não encontrada:', integrationError);
      return new Response(
        JSON.stringify({ error: 'Integração Amazon não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (integration.platform !== 'amazon') {
      return new Response(
        JSON.stringify({ error: 'Esta função só suporta Amazon. Plataforma encontrada: ' + integration.platform }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obter tokens (descriptografar se necessário)
    let refreshToken = null;

    if (integration.encrypted_refresh_token && integration.encryption_migrated) {
      console.log('🔐 Descriptografando refresh token...');
      const { data: decryptedRefresh, error: decryptError } = await supabaseClient.rpc('decrypt_token', {
        encrypted_token: integration.encrypted_refresh_token
      });
      
      if (!decryptError && decryptedRefresh) {
        refreshToken = decryptedRefresh;
      }
    }
    
    if (!refreshToken && integration.refresh_token) {
      console.log('⚠️ Usando refresh token não criptografado (fallback)');
      refreshToken = integration.refresh_token;
    }

    if (!refreshToken) {
      console.error('❌ Refresh token não encontrado');
      return new Response(
        JSON.stringify({ error: 'Token de acesso Amazon não encontrado. Reconecte sua conta.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Inicializar cliente Amazon SP-API
    const { default: SellingPartnerAPI } = await import('npm:amazon-sp-api@latest');
    
    const sellingPartner = new SellingPartnerAPI({
      region: 'na',
      refresh_token: refreshToken,
      credentials: {
        SELLING_PARTNER_APP_CLIENT_ID: Deno.env.get('AMAZON_CLIENT_ID'),
        SELLING_PARTNER_APP_CLIENT_SECRET: Deno.env.get('AMAZON_CLIENT_SECRET'),
      },
    });

    const marketplaceId = integration.marketplace_id || 'A2Q3Y263D00KWC'; // Brasil como padrão
    
    // ========================================================
    // OBTER SELLER ID - CRÍTICO: precisa ser o ID real (AXXXXXXXXXXXX)
    // A Listings Items API patchListingsItem NÃO aceita "me"
    // ========================================================
    let sellerId = integration.selling_partner_id;
    
    if (!sellerId || !sellerId.startsWith('A')) {
      console.log('📋 Seller ID não encontrado no banco, buscando via getMarketplaceParticipations...');
      
      // Método principal: getMarketplaceParticipations (mais confiável)
      try {
        const participationsResponse = await sellingPartner.callAPI({
          operation: 'getMarketplaceParticipations',
          endpoint: 'sellers',
        });
        
        console.log('📋 getMarketplaceParticipations response:', JSON.stringify(participationsResponse, null, 2));
        
        // Extrair participations do response
        let participations: any[] = [];
        if (participationsResponse && Array.isArray(participationsResponse)) {
          participations = participationsResponse;
        } else if (participationsResponse?.payload && Array.isArray(participationsResponse.payload)) {
          participations = participationsResponse.payload;
        }
        
        // Tentar extrair Seller ID de cada participation
        for (const participation of participations) {
          const possibleSellerId = participation.sellerID || 
                                   participation.sellerId || 
                                   participation.seller_id ||
                                   participation.participation?.sellerID ||
                                   participation.participation?.sellerId;
          
          if (possibleSellerId && typeof possibleSellerId === 'string' && possibleSellerId.startsWith('A')) {
            sellerId = possibleSellerId;
            console.log('✅ Seller ID extraído de getMarketplaceParticipations:', sellerId);
            break;
          }
        }
      } catch (participationError: any) {
        console.warn('⚠️ getMarketplaceParticipations falhou:', participationError?.message);
        
        // Tentar extrair do erro se disponível
        const errorMsg = participationError?.message || '';
        const merchantMatch = errorMsg.match(/Merchant[:\s]+([A-Z0-9]{10,})/i);
        if (merchantMatch) {
          sellerId = merchantMatch[1];
          console.log('✅ Seller ID extraído do erro:', sellerId);
        }
      }
      
      // Fallback: SDK interno
      if ((!sellerId || !sellerId.startsWith('A')) && sellingPartner.seller_id) {
        sellerId = sellingPartner.seller_id;
        console.log('✅ Seller ID do SDK interno:', sellerId);
      }
      
      // Se encontrou o Seller ID, salvar no banco
      if (sellerId && sellerId.startsWith('A')) {
        console.log('💾 Salvando Seller ID no banco:', sellerId);
        
        const adminClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        );
        
        await adminClient
          .from('integrations')
          .update({ selling_partner_id: sellerId })
          .eq('id', integrationId);
      }
    }
    
    // VALIDAÇÃO FINAL: patchListingsItem EXIGE Seller ID real
    if (!sellerId || !sellerId.startsWith('A')) {
      console.error('❌ ERRO CRÍTICO: Seller ID não encontrado. A Listings Items API requer o ID real.');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Seller ID não configurado',
          message: 'Configure o Seller ID em Integrações > Amazon para sincronizar preços e estoque.',
          requiresSellerId: true,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('📋 Seller ID validado para PATCH:', sellerId);

    // Construir patches para atualização
    const patches: any[] = [];

    // Atualizar estoque se fornecido
    if (stock !== undefined && stock !== null) {
      console.log('📦 Atualizando estoque para:', stock);
      patches.push({
        op: 'replace',
        path: '/attributes/fulfillment_availability',
        value: [{
          fulfillment_channel_code: 'DEFAULT',
          quantity: stock,
          marketplace_id: marketplaceId,
        }]
      });
    }

    // Atualizar preço se fornecido
    if (sellingPrice !== undefined && sellingPrice !== null && sellingPrice > 0) {
      console.log('💰 Atualizando preço para:', sellingPrice);
      patches.push({
        op: 'replace',
        path: '/attributes/purchasable_offer',
        value: [{
          marketplace_id: marketplaceId,
          currency: 'BRL',
          our_price: [{
            schedule: [{
              value_with_tax: sellingPrice
            }]
          }]
        }]
      });
    }

    if (patches.length === 0) {
      console.log('⚠️ Nenhuma alteração para sincronizar');
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhuma alteração para sincronizar' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🚀 Enviando PATCH para Amazon SP-API...');
    console.log('📋 SKU:', sku);
    console.log('📋 Marketplace:', marketplaceId);
    console.log('📋 Patches:', JSON.stringify(patches, null, 2));

    try {
      // Usar Listings API para atualizar
      const patchResult = await sellingPartner.callAPI({
        operation: 'patchListingsItem',
        endpoint: 'listingsItems',
        path: {
          sellerId: sellerId || 'me',
          sku: sku,
        },
        query: {
          marketplaceIds: [marketplaceId],
        },
        body: {
          productType: 'PRODUCT',
          patches: patches,
        },
      });

      console.log('✅ Resposta Amazon PATCH:', JSON.stringify(patchResult, null, 2));

      // Atualizar status de sincronização na tabela product_listings
      const { error: updateListingError } = await supabaseClient
        .from('product_listings')
        .update({
          sync_status: 'active',
          last_sync_at: new Date().toISOString(),
          sync_error: null,
        })
        .eq('product_id', productId)
        .eq('integration_id', integrationId);

      if (updateListingError) {
        console.warn('⚠️ Erro ao atualizar status do listing:', updateListingError);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Produto sincronizado com Amazon',
          amazonResponse: patchResult,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (amazonError: any) {
      console.error('❌ Erro ao atualizar na Amazon:', amazonError);
      console.error('❌ Detalhes:', JSON.stringify(amazonError, null, 2));

      // Atualizar status de erro na tabela product_listings
      await supabaseClient
        .from('product_listings')
        .update({
          sync_status: 'error',
          sync_error: amazonError?.message || 'Erro ao sincronizar com Amazon',
          last_sync_at: new Date().toISOString(),
        })
        .eq('product_id', productId)
        .eq('integration_id', integrationId);

      // Tratar erros específicos da Amazon
      if (amazonError.code === 'INVALID_INPUT' || amazonError.code === 'InvalidInput') {
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'Dados inválidos para a Amazon',
            details: amazonError.message,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (amazonError.code === 'UNAUTHORIZED' || amazonError.code === 'Unauthorized') {
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'Token Amazon expirado. Reconecte sua conta.',
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Erro ao sincronizar com Amazon',
          details: amazonError.message,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: any) {
    console.error('💥 Erro inesperado:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
