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

    const { productId, sku, integrationId } = await req.json();

    console.log('🔍 Verificando produto na Amazon:', { productId, sku, integrationId });

    if (!productId || !sku || !integrationId) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios: productId, sku, integrationId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar integração Amazon
    const { data: integration, error: integrationError } = await supabaseClient
      .from('integrations')
      .select('id, platform, refresh_token, encrypted_refresh_token, encryption_migrated, marketplace_id, selling_partner_id')
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
        JSON.stringify({ error: 'Esta função só suporta Amazon' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obter refresh token
    let refreshToken = null;
    if (integration.encrypted_refresh_token && integration.encryption_migrated) {
      const { data: decryptedRefresh, error: decryptError } = await supabaseClient.rpc('decrypt_token', {
        encrypted_token: integration.encrypted_refresh_token
      });
      if (!decryptError && decryptedRefresh) {
        refreshToken = decryptedRefresh;
      }
    }
    if (!refreshToken && integration.refresh_token) {
      refreshToken = integration.refresh_token;
    }

    if (!refreshToken) {
      return new Response(
        JSON.stringify({ error: 'Token Amazon não encontrado. Reconecte sua conta.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sellerId = integration.selling_partner_id;
    const marketplaceId = integration.marketplace_id || 'A2Q3Y263D00KWC';
    const currency = MARKETPLACE_CURRENCY_MAP[marketplaceId] || 'BRL';

    if (!sellerId || !sellerId.startsWith('A')) {
      return new Response(
        JSON.stringify({ 
          error: 'Seller ID não configurado',
          requiresSellerId: true,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Inicializar Amazon SP-API
    const { default: SellingPartnerAPI } = await import('npm:amazon-sp-api@latest');
    
    const sellingPartner = new SellingPartnerAPI({
      region: 'na',
      refresh_token: refreshToken,
      credentials: {
        SELLING_PARTNER_APP_CLIENT_ID: Deno.env.get('AMAZON_CLIENT_ID'),
        SELLING_PARTNER_APP_CLIENT_SECRET: Deno.env.get('AMAZON_CLIENT_SECRET'),
      },
    });

    console.log('🔍 Chamando getListingsItem para verificação...');

    const listingResponse = await sellingPartner.callAPI({
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

    console.log('📋 Resposta getListingsItem:', JSON.stringify(listingResponse, null, 2));

    // Extrair dados
    let observedPrice = null;
    let observedTitle = null;
    let observedMainImage = null;
    let observedStock = null;
    let productType = null;
    const issues: any[] = listingResponse?.issues || [];

    // Preço dos attributes
    if (listingResponse?.attributes?.purchasable_offer) {
      const offer = listingResponse.attributes.purchasable_offer[0];
      if (offer?.our_price?.[0]?.schedule?.[0]?.value_with_tax) {
        observedPrice = offer.our_price[0].schedule[0].value_with_tax;
      }
    }

    // Estoque dos attributes
    if (listingResponse?.attributes?.fulfillment_availability) {
      const availability = listingResponse.attributes.fulfillment_availability[0];
      observedStock = availability?.quantity ?? null;
    }

    // Título e imagem do summaries
    if (listingResponse?.summaries && listingResponse.summaries.length > 0) {
      const summary = listingResponse.summaries[0];
      observedTitle = summary.itemName || null;
      observedMainImage = summary.mainImage?.link || null;
      productType = summary.productType || null;
    }

    return new Response(
      JSON.stringify({
        success: true,
        sku: sku,
        marketplace: marketplaceId,
        currency: currency,
        observedAmazonPrice: observedPrice,
        observedAmazonTitle: observedTitle,
        observedAmazonMainImage: observedMainImage,
        observedAmazonStock: observedStock,
        productType: productType,
        issues: issues,
        verifiedAt: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('💥 Erro ao verificar listing:', error);
    return new Response(
      JSON.stringify({ error: 'Erro ao verificar produto na Amazon', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
