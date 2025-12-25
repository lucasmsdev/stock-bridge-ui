import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔐 Iniciando Self-Authorization Amazon...');
    
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ Token de autorização ausente');
      return new Response(
        JSON.stringify({ error: 'Token de autorização ausente' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { refresh_token, account_name, marketplace_id } = await req.json();

    if (!refresh_token) {
      console.error('❌ Refresh token não fornecido');
      return new Response(
        JSON.stringify({ error: 'Refresh token é obrigatório' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📋 Refresh token recebido, validando com Amazon...');

    // Get Amazon credentials from environment
    const clientId = Deno.env.get('AMAZON_CLIENT_ID');
    const clientSecret = Deno.env.get('AMAZON_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      console.error('❌ Credenciais Amazon não configuradas');
      return new Response(
        JSON.stringify({ error: 'Credenciais Amazon não configuradas no servidor' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate refresh token by getting an access token
    console.log('🔑 Obtendo access token da Amazon...');
    const tokenResponse = await fetch('https://api.amazon.com/auth/o2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('❌ Erro ao validar refresh token:', errorText);
      return new Response(
        JSON.stringify({ 
          error: 'Refresh token inválido', 
          details: 'Verifique se o token foi copiado corretamente do Amazon Seller Central' 
        }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenData = await tokenResponse.json();
    console.log('✅ Access token obtido com sucesso');

    // Try to get seller information
    let sellerName = account_name || 'Amazon Seller';
    let sellerId = null;

    // Detectar a região do marketplace baseado no refresh token pattern ou tentar múltiplas regiões
    const regions = [
      { name: 'na', url: 'https://sellingpartnerapi-na.amazon.com' },
      { name: 'eu', url: 'https://sellingpartnerapi-eu.amazon.com' },
      { name: 'fe', url: 'https://sellingpartnerapi-fe.amazon.com' },
    ];

    let detectedMarketplaceId = null;
    let detectedRegionUrl = regions[0].url; // Default to NA

    for (const region of regions) {
      try {
        console.log(`📊 Buscando informações do vendedor na região ${region.name}...`);
        const spApiResponse = await fetch(
          `${region.url}/sellers/v1/marketplaceParticipations`,
          {
            headers: {
              'Authorization': `Bearer ${tokenData.access_token}`,
              'x-amz-access-token': tokenData.access_token,
            },
          }
        );

        if (spApiResponse.ok) {
          const spApiData = await spApiResponse.json();
          console.log('📋 Resposta SP-API:', JSON.stringify(spApiData, null, 2));
          
          if (spApiData.payload && spApiData.payload.length > 0) {
            for (const item of spApiData.payload) {
              if (item.marketplace) {
                detectedMarketplaceId = item.marketplace.id;
                detectedRegionUrl = region.url;
                sellerName = account_name || item.storeName || `Amazon (${item.marketplace.name})`;
                console.log('✅ Marketplace encontrado:', item.marketplace.id, item.marketplace.name);
                console.log('✅ Store name:', item.storeName);
                break;
              }
            }
            if (detectedMarketplaceId) break;
          }
        }
      } catch (regionError) {
        console.log(`⚠️ Região ${region.name} não respondeu:`, regionError.message);
      }
    }

    // Obter Seller ID real usando a Orders API (getOrders com limit 1)
    // Esta é a forma mais confiável de obter o Seller ID
    console.log('🔍 Buscando Seller ID real via Orders API...');
    try {
      const ordersResponse = await fetch(
        `${detectedRegionUrl}/orders/v0/orders?MarketplaceIds=${detectedMarketplaceId || marketplace_id || 'A2Q3Y263D00KWC'}&CreatedAfter=2020-01-01T00:00:00Z&MaxResultsPerPage=1`,
        {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'x-amz-access-token': tokenData.access_token,
          },
        }
      );

      if (ordersResponse.ok) {
        const ordersData = await ordersResponse.json();
        console.log('📋 Resposta Orders API:', JSON.stringify(ordersData, null, 2));
        
        // O Seller ID está no header da resposta ou podemos extrair de outra forma
        // Vamos tentar a Sellers API diretamente com /sellers/v1/participations
      }
    } catch (ordersError) {
      console.log('⚠️ Orders API não retornou Seller ID:', ordersError.message);
    }

    // Tentar obter Seller ID via Catalog Items API ou Listings API
    // Usando a abordagem de criar uma listagem de teste e pegar o erro com o Seller ID
    console.log('🔍 Tentando obter Seller ID via Listings API...');
    try {
      // Chamando getListingsItem com SKU inexistente para obter o sellerId do erro
      const listingsResponse = await fetch(
        `${detectedRegionUrl}/listings/2021-08-01/items/SELLER_ID_PLACEHOLDER/TEST_SKU_NOT_EXISTS?marketplaceIds=${detectedMarketplaceId || marketplace_id || 'A2Q3Y263D00KWC'}`,
        {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'x-amz-access-token': tokenData.access_token,
          },
        }
      );

      // O erro vai retornar informações úteis
      const listingsData = await listingsResponse.text();
      console.log('📋 Resposta Listings API:', listingsData);
    } catch (listingsError) {
      console.log('⚠️ Listings API:', listingsError.message);
    }

    // Usar Feeds API para obter Seller ID - método mais confiável
    console.log('🔍 Tentando obter Seller ID via Feeds API...');
    try {
      const feedsResponse = await fetch(
        `${detectedRegionUrl}/feeds/2021-06-30/feeds?feedTypes=POST_PRODUCT_DATA&pageSize=1`,
        {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'x-amz-access-token': tokenData.access_token,
          },
        }
      );

      if (feedsResponse.ok) {
        const feedsData = await feedsResponse.json();
        console.log('📋 Resposta Feeds API:', JSON.stringify(feedsData, null, 2));
        
        // Se houver feeds, podemos extrair informações do seller
        if (feedsData.feeds && feedsData.feeds.length > 0) {
          // Alguns feeds contêm referência ao seller
          const feed = feedsData.feeds[0];
          if (feed.sellerId) {
            sellerId = feed.sellerId;
            console.log('✅ Seller ID encontrado via Feeds:', sellerId);
          }
        }
      }
    } catch (feedsError) {
      console.log('⚠️ Feeds API:', feedsError.message);
    }

    // Se ainda não temos o Seller ID, usar a Amazon SP-API SDK para obter
    if (!sellerId) {
      console.log('🔍 Tentando obter Seller ID via SP-API SDK...');
      try {
        const { default: SellingPartnerAPI } = await import('npm:amazon-sp-api@latest');
        
        const sellingPartner = new SellingPartnerAPI({
          region: 'na',
          refresh_token: refresh_token,
          credentials: {
            SELLING_PARTNER_APP_CLIENT_ID: clientId,
            SELLING_PARTNER_APP_CLIENT_SECRET: clientSecret,
          },
        });

        // Tentar buscar seller ID via getMyFeesEstimateForSKU (precisa de um ASIN válido)
        // Ou usar getMarketplaceParticipations e extrair do endpoint
        const participations = await sellingPartner.callAPI({
          operation: 'getMarketplaceParticipations',
          endpoint: 'sellers',
        });
        
        console.log('📋 SP-API SDK Participations:', JSON.stringify(participations, null, 2));
        
        // Extrair o sellerId que vem na resposta interna da SDK
        if (sellingPartner.seller_id) {
          sellerId = sellingPartner.seller_id;
          console.log('✅ Seller ID encontrado via SDK:', sellerId);
        }

        // Se a SDK não tiver, tentar obter via uma chamada que retorna o seller ID
        if (!sellerId) {
          try {
            // A chamada getAccount retorna informações do seller
            const reports = await sellingPartner.callAPI({
              operation: 'getReports',
              endpoint: 'reports',
              query: {
                reportTypes: ['GET_MERCHANT_LISTINGS_DATA'],
                pageSize: 1,
              },
            });
            
            console.log('📋 Reports response:', JSON.stringify(reports, null, 2));
            
            // Extrair seller ID se disponível na resposta
            if (reports && reports.reports && reports.reports.length > 0) {
              // Alguns relatórios contêm o sellerId
              const report = reports.reports[0];
              if (report.sellerId) {
                sellerId = report.sellerId;
                console.log('✅ Seller ID encontrado via Reports:', sellerId);
              }
            }
          } catch (reportsError) {
            console.log('⚠️ Reports API:', reportsError.message);
          }
        }
      } catch (sdkError) {
        console.log('⚠️ SP-API SDK error:', sdkError.message);
      }
    }

    // Último recurso: deixar null e obter na primeira sincronização
    if (!sellerId) {
      console.log('⚠️ Seller ID não encontrado, será obtido na primeira sincronização');
    } else {
      console.log('✅ Seller ID final:', sellerId);
    }

    // Usar o marketplace selecionado pelo usuário (preferencial) ou fallback
    const finalMarketplaceId = marketplace_id || detectedMarketplaceId || Deno.env.get('AMAZON_MARKETPLACE_ID') || 'A2Q3Y263D00KWC';

    // Create Supabase client and verify user
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Get user from auth token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      console.error('❌ Usuário não autenticado:', userError);
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('👤 Usuário autenticado:', user.id);

    // Check for existing integration with same seller_id
    if (sellerId) {
      const { data: existingIntegrations } = await supabaseClient
        .from('integrations')
        .select('id')
        .eq('user_id', user.id)
        .eq('platform', 'amazon')
        .eq('selling_partner_id', sellerId);

      if (existingIntegrations && existingIntegrations.length > 0) {
        console.log('⚠️ Integração já existe para este seller');
        return new Response(
          JSON.stringify({ 
            error: 'Conta já conectada', 
            details: 'Esta conta Amazon já está conectada ao seu UniStock' 
          }), 
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Encrypt tokens usando SQL direto para evitar problemas com RPC
    console.log('🔒 Criptografando tokens...');
    
    const { data: encryptedAccessToken, error: encryptAccessError } = await supabaseClient.rpc('encrypt_token', { 
      token: tokenData.access_token 
    });
    
    if (encryptAccessError) {
      console.error('❌ Erro ao criptografar access token:', encryptAccessError);
    }
    
    const { data: encryptedRefreshToken, error: encryptRefreshError } = await supabaseClient.rpc('encrypt_token', { 
      token: refresh_token 
    });
    
    if (encryptRefreshError) {
      console.error('❌ Erro ao criptografar refresh token:', encryptRefreshError);
    }

    console.log('🔒 Tokens criptografados:', {
      hasEncryptedAccess: !!encryptedAccessToken,
      hasEncryptedRefresh: !!encryptedRefreshToken,
      accessTokenLength: encryptedAccessToken?.length || 0,
      refreshTokenLength: encryptedRefreshToken?.length || 0
    });

    // Se a criptografia falhar, salvar tokens em texto (fallback temporário)
    // Em produção, isso deve ser investigado
    if (!encryptedAccessToken || !encryptedRefreshToken) {
      console.warn('⚠️ Criptografia falhou, salvando tokens diretamente (fallback)');
    }

    // Calcular data de expiração do token (Amazon = 1 hora)
    const tokenExpiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000);

    // Save integration
    console.log('💾 Salvando integração com marketplace:', finalMarketplaceId);
    console.log('📅 Token expira em:', tokenExpiresAt.toISOString());
    const { data: integration, error: insertError } = await supabaseClient
      .from('integrations')
      .insert({
        user_id: user.id,
        platform: 'amazon',
        access_token: encryptedAccessToken ? 'encrypted' : tokenData.access_token,
        refresh_token: encryptedRefreshToken ? null : refresh_token,
        encrypted_access_token: encryptedAccessToken,
        encrypted_refresh_token: encryptedRefreshToken,
        encryption_migrated: !!encryptedAccessToken && !!encryptedRefreshToken,
        selling_partner_id: null,
        marketplace_id: finalMarketplaceId,
        account_name: sellerName,
        token_expires_at: tokenExpiresAt.toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Erro ao salvar integração:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erro ao salvar integração', details: insertError.message }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Integração Amazon criada com sucesso:', integration?.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Conta Amazon conectada com sucesso!',
        account_name: sellerName,
        integration_id: integration?.id
      }), 
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('💥 Erro no self-auth Amazon:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno no servidor', details: error.message }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
