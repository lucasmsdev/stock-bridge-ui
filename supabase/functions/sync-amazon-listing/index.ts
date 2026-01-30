import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapa de marketplaceId → currency
const MARKETPLACE_CURRENCY_MAP: Record<string, string> = {
  'A2Q3Y263D00KWC': 'BRL', // Brasil
  'ATVPDKIKX0DER': 'USD',  // EUA
  'A2EUQ1WTGCTBG2': 'CAD', // Canadá
  'A1AM78C64UM0Y8': 'MXN', // México
  'A1PA6795UKMFR9': 'EUR', // Alemanha
  'A1F83G8C2ARO7P': 'GBP', // Reino Unido
  'A1RKKUPIHCS9HS': 'EUR', // Espanha
  'A13V1IB3VIYZZH': 'EUR', // França
  'APJ6JRA9NG5V4': 'EUR',  // Itália
  'A21TJRUUN4KGV': 'INR',  // Índia
  'A1VC38T7YXB528': 'JPY', // Japão
  'AAHKV2X7AFYLW': 'CNY',  // China
};

/**
 * Normaliza valor monetário para número com 2 casas decimais
 * Aceita: number, string BR ("1.234,56", "R$ 19,90"), string US ("1234.56")
 */
function normalizeMoneyToNumber(input: any): number | null {
  if (input === null || input === undefined || input === '') {
    return null;
  }

  // Se já é número, arredondar para 2 casas
  if (typeof input === 'number') {
    if (isNaN(input) || input <= 0) {
      console.warn('⚠️ Preço inválido (número <= 0 ou NaN):', input);
      return null;
    }
    return Math.round(input * 100) / 100;
  }

  // Se é string, normalizar
  if (typeof input === 'string') {
    let cleaned = input
      .replace(/R\$\s*/gi, '')  // Remove "R$"
      .replace(/\s/g, '')       // Remove espaços
      .trim();

    // Detectar formato BR (vírgula como decimal)
    // Ex: "1.234,56" ou "19,90"
    const brPattern = /^[\d.]+,\d{1,2}$/;
    if (brPattern.test(cleaned)) {
      // Formato BR: remove pontos de milhar, troca vírgula por ponto
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // Formato US ou sem separador de milhar: só remover vírgulas extras
      cleaned = cleaned.replace(/,/g, '');
    }

    const parsed = parseFloat(cleaned);
    if (isNaN(parsed) || parsed <= 0) {
      console.warn('⚠️ Preço inválido após parse:', input, '→', cleaned, '→', parsed);
      return null;
    }

    return Math.round(parsed * 100) / 100;
  }

  console.warn('⚠️ Tipo de preço não suportado:', typeof input, input);
  return null;
}

/**
 * Obtém currency baseado no marketplaceId
 */
function getCurrencyForMarketplace(marketplaceId: string): string {
  return MARKETPLACE_CURRENCY_MAP[marketplaceId] || 'USD';
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
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      console.error('❌ Erro de autenticação:', userError);
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { productId, sku, stock, sellingPrice, name, imageUrl, integrationId, description } = await req.json();

    console.log('🔄 Sincronizando produto Amazon:', { 
      productId, 
      sku, 
      stock, 
      sellingPrice, 
      sellingPriceType: typeof sellingPrice,
      name, 
      imageUrl, 
      integrationId,
      description: description?.substring(0, 50) + '...',
    });

    if (!productId || !sku || !integrationId) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios: productId, sku, integrationId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar integração Amazon
    const { data: integration, error: integrationError } = await supabaseClient
      .from('integrations')
      .select('id, platform, encrypted_access_token, encrypted_refresh_token, marketplace_id, selling_partner_id, account_name')
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

    // Descriptografar refresh token
    let refreshToken = null;

    if (integration.encrypted_refresh_token) {
      console.log('🔐 Descriptografando refresh token...');
      const { data: decryptedRefresh, error: decryptError } = await supabaseClient.rpc('decrypt_token', {
        encrypted_token: integration.encrypted_refresh_token
      });
      
      if (!decryptError && decryptedRefresh) {
        refreshToken = decryptedRefresh;
      }
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

    // ========================================================
    // DETERMINAR MARKETPLACE CORRETO
    // ========================================================
    let marketplaceId = integration.marketplace_id;
    
    // Se não tiver marketplace salvo ou for o padrão EUA, tentar detectar via participações
    if (!marketplaceId || marketplaceId === 'ATVPDKIKX0DER') {
      console.log('📋 Buscando marketplaces via getMarketplaceParticipations...');
      try {
        const participationsResponse = await sellingPartner.callAPI({
          operation: 'getMarketplaceParticipations',
          endpoint: 'sellers',
        });
        
        let participations: any[] = [];
        if (participationsResponse && Array.isArray(participationsResponse)) {
          participations = participationsResponse;
        } else if (participationsResponse?.payload && Array.isArray(participationsResponse.payload)) {
          participations = participationsResponse.payload;
        }
        
        // Preferir Brasil se disponível
        const brParticipation = participations.find(p => p.marketplace?.id === 'A2Q3Y263D00KWC');
        if (brParticipation) {
          marketplaceId = 'A2Q3Y263D00KWC';
          console.log('✅ Marketplace Brasil detectado');
        } else if (participations.length > 0 && participations[0].marketplace?.id) {
          marketplaceId = participations[0].marketplace.id;
          console.log('✅ Marketplace detectado:', marketplaceId);
        }
      } catch (err: any) {
        console.warn('⚠️ Erro ao buscar participações:', err?.message);
      }
    }
    
    // Fallback para Brasil se ainda não tiver
    if (!marketplaceId) {
      marketplaceId = 'A2Q3Y263D00KWC';
    }
    
    // Determinar currency baseado no marketplace
    const currency = getCurrencyForMarketplace(marketplaceId);
    console.log('💱 Marketplace:', marketplaceId, '→ Currency:', currency);

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
      
      // Se encontrou o Seller ID, salvar no banco junto com o marketplace correto
      if (sellerId && sellerId.startsWith('A')) {
        console.log('💾 Salvando Seller ID e Marketplace no banco:', sellerId, marketplaceId);
        
        const adminClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        );
        
        await adminClient
          .from('integrations')
          .update({ 
            selling_partner_id: sellerId,
            marketplace_id: marketplaceId
          })
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

    // ========================================================
    // BUSCAR PRODUCT TYPE REAL VIA getListingsItem
    // ========================================================
    let productType = 'PRODUCT'; // fallback
    
    try {
      console.log('🔍 Buscando productType via getListingsItem...');
      const listingResponse = await sellingPartner.callAPI({
        operation: 'getListingsItem',
        endpoint: 'listingsItems',
        path: {
          sellerId: sellerId,
          sku: sku,
        },
        query: {
          marketplaceIds: [marketplaceId],
          includedData: ['summaries'],
        },
      });
      
      console.log('📋 getListingsItem response:', JSON.stringify(listingResponse, null, 2));
      
      // Extrair productType do summaries
      if (listingResponse?.summaries && listingResponse.summaries.length > 0) {
        const summary = listingResponse.summaries[0];
        if (summary.productType) {
          productType = summary.productType;
          console.log('✅ ProductType real encontrado:', productType);
        }
      }
    } catch (listingError: any) {
      console.warn('⚠️ Erro ao buscar productType (usando fallback PRODUCT):', listingError?.message);
    }

    // ========================================================
    // NORMALIZAR PREÇO
    // ========================================================
    const normalizedPrice = normalizeMoneyToNumber(sellingPrice);
    console.log('💰 Preço original:', sellingPrice, '→ Normalizado:', normalizedPrice);

    // Construir patches para atualização
    const patches: any[] = [];

    // Atualizar estoque se fornecido
    // IMPORTANTE: fulfillment_availability NÃO leva marketplace_id no value (per Amazon spec)
    if (stock !== undefined && stock !== null) {
      console.log('📦 Atualizando estoque para:', stock);
      patches.push({
        op: 'replace',
        path: '/attributes/fulfillment_availability',
        value: [{
          fulfillment_channel_code: 'DEFAULT',
          quantity: stock,
        }]
      });
    }

    // Atualizar preço se fornecido e válido
    // IMPORTANTE: value_with_tax DEVE ser STRING com 2 casas decimais ("59.90", não 59.9)
    if (normalizedPrice !== null && normalizedPrice > 0) {
      const priceAsString = normalizedPrice.toFixed(2); // "59.90" (string)
      console.log('💰 Atualizando preço para:', priceAsString, currency, '(string format required by Amazon)');
      patches.push({
        op: 'replace',
        path: '/attributes/purchasable_offer',
        value: [{
          marketplace_id: marketplaceId,
          currency: currency,
          our_price: [{
            schedule: [{
              value_with_tax: priceAsString // DEVE ser string, não número
            }]
          }]
        }]
      });
    }

    // Atualizar nome se fornecido
    // NOTA: Muitos produtos têm nome gerenciado pelo catálogo Amazon (nameMayNotChange=true)
    // Nesses casos, o PATCH vai ser ACCEPTED mas o nome não muda
    // Vamos continuar tentando, mas o response vai indicar se mudou ou não
    if (name && typeof name === 'string' && name.trim().length > 0) {
      console.log('📝 Atualizando nome para:', name);
      patches.push({
        op: 'replace',
        path: '/attributes/item_name',
        value: [{
          value: name.trim(),
          marketplace_id: marketplaceId,
          language_tag: 'pt_BR'
        }]
      });
    }

    // Atualizar imagem principal se fornecida
    if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
      console.log('🖼️ Atualizando imagem para:', imageUrl);
      patches.push({
        op: 'replace',
        path: '/attributes/main_product_image_locator',
        value: [{
          marketplace_id: marketplaceId,
          media_location: imageUrl
        }]
      });
    }

    // Atualizar descrição se fornecida
    // NOTA: Muitos produtos têm descrição gerenciada pelo catálogo Amazon
    if (description && typeof description === 'string' && description.trim().length > 0) {
      console.log('📝 Atualizando descrição para:', description.substring(0, 50) + '...');
      patches.push({
        op: 'replace',
        path: '/attributes/product_description',
        value: [{
          value: description.trim(),
          language_tag: 'pt_BR',
          marketplace_id: marketplaceId
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
    console.log('📋 Currency:', currency);
    console.log('📋 ProductType:', productType);
    console.log('📋 Patches:', JSON.stringify(patches, null, 2));

    // Guardar o preço enviado como string para diagnóstico
    const priceStringSent = normalizedPrice !== null ? normalizedPrice.toFixed(2) : null;
    console.log('📋 Preço enviado (string):', priceStringSent);

    try {
      // Usar Listings API para atualizar
      // IMPORTANTE: Adicionamos issueLocale=pt_BR para mensagens em português
      const patchResult = await sellingPartner.callAPI({
        operation: 'patchListingsItem',
        endpoint: 'listingsItems',
        path: {
          sellerId: sellerId,
          sku: sku,
        },
        query: {
          marketplaceIds: [marketplaceId],
          issueLocale: 'pt_BR',
        },
        body: {
          productType: productType,
          patches: patches,
        },
      });

      console.log('✅ Resposta Amazon PATCH:', JSON.stringify(patchResult, null, 2));

      // ========================================================
      // VERIFICAÇÃO PÓS-PATCH: Ler preço, título e imagem atuais
      // ========================================================
      // Extrair dados - separando offer price e list price
      let observedOfferPrice = null;
      let observedListPrice = null;
      let observedAmazonTitle = null;
      let observedAmazonMainImage = null;
      let observedStock = null;
      let observedIssues: any[] = [];
      
      try {
        console.log('🔍 Verificando dados pós-PATCH (attributes, issues, summaries)...');
        const verifyResponse = await sellingPartner.callAPI({
          operation: 'getListingsItem',
          endpoint: 'listingsItems',
          path: {
            sellerId: sellerId,
            sku: sku,
          },
          query: {
            marketplaceIds: [marketplaceId],
            includedData: ['attributes', 'issues', 'summaries'],
          },
        });
        
        console.log('📋 Verificação pós-PATCH:', JSON.stringify(verifyResponse, null, 2));
        
        // Extrair offer price (purchasable_offer) - é o preço de venda atual
        if (verifyResponse?.attributes?.purchasable_offer) {
          const offer = verifyResponse.attributes.purchasable_offer[0];
          if (offer?.our_price?.[0]?.schedule?.[0]?.value_with_tax) {
            observedOfferPrice = offer.our_price[0].schedule[0].value_with_tax;
          }
        }

        // Extrair list price - é o preço de "comparação" ou "de"
        if (verifyResponse?.attributes?.list_price) {
          const listPrice = verifyResponse.attributes.list_price[0];
          if (listPrice?.value_with_tax) {
            observedListPrice = listPrice.value_with_tax;
          }
        }

        // Extrair estoque observado
        if (verifyResponse?.attributes?.fulfillment_availability) {
          const availability = verifyResponse.attributes.fulfillment_availability[0];
          observedStock = availability?.quantity ?? null;
        }
        
        // Extrair título e imagem do summaries (o que realmente aparece na Amazon)
        if (verifyResponse?.summaries && verifyResponse.summaries.length > 0) {
          const summary = verifyResponse.summaries[0];
          observedAmazonTitle = summary.itemName || null;
          observedAmazonMainImage = summary.mainImage?.link || null;
          console.log('📋 Summary - Título:', observedAmazonTitle);
          console.log('📋 Summary - Imagem:', observedAmazonMainImage);
        }
        
        // Extrair issues
        if (verifyResponse?.issues && verifyResponse.issues.length > 0) {
          observedIssues = verifyResponse.issues;
        }
      } catch (verifyError: any) {
        console.warn('⚠️ Erro na verificação pós-PATCH:', verifyError?.message);
      }

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

      // Verificar se há issues na resposta
      const hasIssues = (patchResult?.issues && patchResult.issues.length > 0) || observedIssues.length > 0;
      if (hasIssues) {
        console.warn('⚠️ Amazon reportou issues:', JSON.stringify([...(patchResult?.issues || []), ...observedIssues], null, 2));
      }

      // Detectar se nome não foi alterado (limitação Amazon catalog)
      const nameUpdateAttempted = name && typeof name === 'string' && name.trim().length > 0;
      const nameMayNotChange = nameUpdateAttempted && observedAmazonTitle && observedAmazonTitle !== name.trim();

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: hasIssues 
            ? 'Produto enviado à Amazon, mas com avisos. Pode levar até 15 minutos para refletir.'
            : 'Produto sincronizado com Amazon. Alterações podem levar até 15 minutos para refletir.',
          amazonResponse: patchResult,
          submissionId: patchResult?.submissionId || null,
          issues: [...(patchResult?.issues || []), ...observedIssues],
          // Dados enviados (para debug)
          sentData: {
            priceNumber: normalizedPrice,
            priceString: priceStringSent,
            stock: stock,
            name: name?.trim() || null,
            imageUrl: imageUrl || null,
            currency: currency,
            marketplace: marketplaceId,
            productType: productType,
          },
          // Dados observados na Amazon após PATCH
          observedAmazonOfferPrice: observedOfferPrice,
          observedAmazonListPrice: observedListPrice,
          observedAmazonStock: observedStock,
          observedAmazonTitle: observedAmazonTitle,
          observedAmazonMainImage: observedAmazonMainImage,
          nameMayNotChange: nameMayNotChange,
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
