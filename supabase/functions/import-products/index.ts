import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get the user from the request
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      console.error('Authentication error:', userError);
      return new Response(
        JSON.stringify({ error: 'User not authenticated' }), 
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Authenticated user:', user.id);

    // Get user's plan and current product count to check SKU limits
    const { data: userProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('plan, role')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      console.error('Profile not found:', profileError);
      return new Response(
        JSON.stringify({ error: 'User profile not found' }), 
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Count current products for this user
    const { count, error: countError } = await supabaseClient
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (countError) {
      console.error('Error counting products:', countError);
      return new Response(
        JSON.stringify({ error: 'Failed to check current product count' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const currentProductCount = count ?? 0;

    // Define SKU limits per plan
    const skuLimits = {
      'estrategista': 500,
      'competidor': 2000,
      'dominador': 10000,
      'admin': Infinity // Admins don't have limits
    };

    const userPlan = userProfile.role === 'admin' ? 'admin' : userProfile.plan;
    const limit = skuLimits[userPlan] || skuLimits['estrategista'];

    // Check if user has reached their SKU limit
    if (currentProductCount >= limit) {
      console.log(`User has reached SKU limit. Current: ${currentProductCount}, Limit: ${limit}, Plan: ${userPlan}`);
      return new Response(
        JSON.stringify({ 
          error: 'Limite de SKUs atingido. Faça um upgrade do seu plano para importar mais produtos.',
          current_count: currentProductCount,
          limit: limit,
          plan: userPlan
        }), 
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`SKU check passed. Current: ${currentProductCount}, Limit: ${limit}, Plan: ${userPlan}`);

    // Body parsing (support both integration_id and platform for backward compatibility)
    let body: any = {};
    try {
      body = await req.json();
    } catch (parseError: any) {
      console.error('❌ Failed to parse request body as JSON:', parseError?.message || parseError);
      return new Response(
        JSON.stringify({ error: 'Corpo da requisição inválido. Tente novamente.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const integrationId: string | null = body?.integration_id ?? body?.integrationId ?? null;
    const platformFromBody: string | null = body?.platform ?? null;

    console.log('📥 Import request body received:', {
      hasIntegrationId: !!integrationId,
      platform: platformFromBody,
    });

    if (!integrationId && !platformFromBody) {
      return new Response(
        JSON.stringify({ error: 'integration_id ou platform é obrigatório' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get the specific integration (by id when provided, otherwise latest by platform)
    let integrationQuery = supabaseClient
      .from('integrations')
      .select('id, platform, access_token, refresh_token, encrypted_access_token, encrypted_refresh_token, encryption_migrated, shop_domain, selling_partner_id, marketplace_id, account_name')
      .eq('user_id', user.id);

    if (integrationId) {
      integrationQuery = integrationQuery.eq('id', integrationId);
    } else if (platformFromBody) {
      integrationQuery = integrationQuery.eq('platform', platformFromBody).order('created_at', { ascending: false }).limit(1);
    }

    const { data: integration, error: integrationError } = await integrationQuery.maybeSingle();

    if (integrationError || !integration) {
      console.error('Integration not found:', integrationError);
      return new Response(
        JSON.stringify({ error: 'Integration not found or not properly configured' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Found integration:', integration.id, 'for platform:', integration.platform, 'account:', integration.account_name);

    // Determine which tokens to use (encrypted preferred, plain as fallback)
    let accessToken = null;
    let refreshToken = null;

    if (integration.encrypted_access_token && integration.encryption_migrated) {
      // Try to decrypt tokens
      console.log('🔐 Usando tokens criptografados...');
      const { data: decryptedAccess, error: decryptAccessError } = await supabaseClient.rpc('decrypt_token', {
        encrypted_token: integration.encrypted_access_token
      });
      
      if (!decryptAccessError && decryptedAccess) {
        accessToken = decryptedAccess;
      } else {
        console.error('Failed to decrypt access token:', decryptAccessError);
      }

      if (integration.encrypted_refresh_token) {
        const { data: decryptedRefresh } = await supabaseClient.rpc('decrypt_token', {
          encrypted_token: integration.encrypted_refresh_token
        });
        refreshToken = decryptedRefresh;
      }
    }
    
    // Fallback to plain tokens if decryption failed or not migrated
    if (!accessToken && integration.access_token && integration.access_token !== 'encrypted') {
      console.log('⚠️ Usando tokens não criptografados (fallback)...');
      accessToken = integration.access_token;
      refreshToken = integration.refresh_token;
    }

    if (!accessToken) {
      console.error('No valid access token found for integration');
      return new Response(
        JSON.stringify({ error: 'Token de acesso não encontrado. Reconecte sua conta.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Found integration:', integration.id, 'for platform:', integration.platform, 'account:', integration.account_name);
    const platform = integration.platform;

    let productsToInsert = [];

    if (platform === 'mercadolivre') {
      try {
        // Step 1: Get user info to obtain user ID
        const userInfoResponse = await fetch(`https://api.mercadolibre.com/users/me`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (!userInfoResponse.ok) {
          const errorText = await userInfoResponse.text();
          console.error('Error fetching user info:', errorText);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch user info from Mercado Livre' }), 
            { 
              status: 500, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        const userInfo = await userInfoResponse.json();
        const mlUserId = userInfo.id;
        console.log(`Buscando anúncios para o vendedor ML ID: ${mlUserId}`);

        // Step 2: Get list of product IDs first
        const listResponse = await fetch(`https://api.mercadolibre.com/users/${mlUserId}/items/search?limit=100`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (!listResponse.ok) {
          const errorBody = await listResponse.text();
          console.error('Erro ao buscar lista de produtos:', errorBody);
          return new Response(
            JSON.stringify({ error: `Falha ao buscar lista de produtos: ${listResponse.statusText}` }), 
            { 
              status: 500, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        const listData = await listResponse.json();
        const itemIds = listData.results;

        if (!itemIds || itemIds.length === 0) {
          console.log('Nenhum produto encontrado para este usuário.');
          return new Response(
            JSON.stringify({ message: 'Nenhum produto encontrado na sua conta do Mercado Livre', count: 0 }), 
            { 
              status: 200, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        console.log(`Encontrados ${itemIds.length} produtos. Buscando detalhes completos...`);

        // Step 3: Get complete details for all items (up to 20 at a time)  
        const detailsUrl = `https://api.mercadolibre.com/items?ids=${itemIds.slice(0, 20).join(',')}`;
        console.log(`Chamando API de detalhes: ${detailsUrl}`);

        const detailsResponse = await fetch(detailsUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!detailsResponse.ok) {
          const errorBody = await detailsResponse.text();
          console.error('Erro ao buscar detalhes dos produtos:', errorBody);
          return new Response(
            JSON.stringify({ error: `Falha ao buscar detalhes dos produtos: ${detailsResponse.statusText}` }), 
            { 
              status: 500, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        const detailsData = await detailsResponse.json();

        // **LOG DE DEPURAÇÃO: RESPOSTA CRUA DA API DE DETALHES**
        console.log('--- RESPOSTA CRUA DA API DE DETALHES ---');
        console.log(JSON.stringify(detailsData, null, 2));
        console.log('---------------------------------------');

        // Step 4: Map the detailed results to our database format
        productsToInsert = detailsData
          .filter(item => item.code === 200 && item.body) // Only successful responses
          .map(itemDetail => {
            const item = itemDetail.body;
            
            // **LOG DE DEPURAÇÃO: ITEM INDIVIDUAL**
            console.log('🔍 Processando item detalhado:', {
              id: item.id,
              title: item.title,
              price: item.price,
              price_type: typeof item.price,
              seller_custom_field: item.seller_custom_field,
              available_quantity: item.available_quantity
            });

            // Process price to ensure it's a valid number
            let selling_price = null;
            if (item.price !== undefined && item.price !== null) {
              if (typeof item.price === 'string') {
                const cleanPrice = item.price.replace(/[^\d.,]/g, '').replace(',', '.');
                selling_price = parseFloat(cleanPrice);
              } else if (typeof item.price === 'number') {
                selling_price = item.price;
              }
              
              if (isNaN(selling_price) || selling_price <= 0) {
                console.warn('⚠️ Preço inválido detectado:', item.price, '-> definindo como null');
                selling_price = null;
              } else {
                console.log('✅ Preço válido:', selling_price);
              }
            }

            return {
              user_id: user.id,
              name: item.title,
              sku: String(item.seller_custom_field || item.id), // Ensure SKU is always string
              stock: item.available_quantity || 0,
              selling_price: selling_price,
              image_url: item.thumbnail ? item.thumbnail.replace('http://', 'https://') : null,
            };
          });

        // **LOG DE DEPURAÇÃO: DADOS FINAIS**
        console.log('--- DADOS PRONTOS PARA O UPSERT ---');
        console.log(JSON.stringify(productsToInsert, null, 2));
        console.log('-----------------------------------');

        console.log(`Mapeados ${productsToInsert.length} produtos para o upsert com preços.`);
        if (productsToInsert.length > 0) {
          console.log('Exemplo de produto mapeado:', productsToInsert[0]);
        }

      } catch (error) {
        console.error('Erro fatal no bloco de importação de produtos do Mercado Livre:', error);
        return new Response(
          JSON.stringify({ error: 'Erro interno ao processar produtos do Mercado Livre' }), 
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

    } else if (platform === 'shopify') {
      // Shop domain is already in the integration object
      if (!integration.shop_domain) {
        console.error('Shopify shop domain not found in integration');
        return new Response(
          JSON.stringify({ error: 'Shopify shop domain not configured' }), 
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const shopifyDomain = integration.shop_domain;
      console.log('Fetching products from Shopify shop:', shopifyDomain);

      // Step 1: Get ALL products from Shopify with pagination
      let allProducts = [];
      let nextPageInfo = null;
      let page = 1;

      do {
        console.log(`📄 Buscando página ${page} de produtos...`);
        
        const url = nextPageInfo 
          ? `https://${shopifyDomain}.myshopify.com/admin/api/2023-10/products.json?page_info=${nextPageInfo}&limit=250`
          : `https://${shopifyDomain}.myshopify.com/admin/api/2023-10/products.json?limit=250`;
        
        const productsResponse = await fetch(url, {
          method: 'GET',
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
        });

        if (!productsResponse.ok) {
          const errorText = await productsResponse.text();
          console.error('Error fetching Shopify products:', errorText);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch products from Shopify' }), 
            { 
              status: 500, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        const productsData = await productsResponse.json();
        const pageProducts = productsData.products || [];
        allProducts = allProducts.concat(pageProducts);

        // Shopify uses cursor-based pagination via Link header
        const linkHeader = productsResponse.headers.get('Link');
        if (linkHeader && linkHeader.includes('rel="next"')) {
          const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
          if (nextMatch) {
            const nextUrl = new URL(nextMatch[1]);
            nextPageInfo = nextUrl.searchParams.get('page_info');
          } else {
            nextPageInfo = null;
          }
        } else {
          nextPageInfo = null;
        }
        
        page++;
      } while (nextPageInfo);

      const products = allProducts;
      console.log(`✅ Total de ${products.length} produtos encontrados no Shopify`);

      if (products.length === 0) {
        console.log('No products found in Shopify store');
        return new Response(
          JSON.stringify({ message: 'No products found in your Shopify store', count: 0 }), 
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      console.log(`Found ${products.length} products to import from Shopify`);

      // Step 2: Map Shopify products to our format
      for (const product of products) {
        // Shopify products can have multiple variants
        for (const variant of product.variants || []) {
          const productData = {
            user_id: user.id,
            name: `${product.title}${variant.title !== 'Default Title' ? ` - ${variant.title}` : ''}`,
            sku: variant.sku || variant.id.toString(),
            stock: variant.inventory_quantity || 0,
            selling_price: variant.price ? parseFloat(variant.price) : null,
            image_url: product.image?.src || null,
          };

      productsToInsert.push(productData);
        }
      }
  } else if (platform === 'amazon') {
      console.log('🛒 Importando produtos da Amazon SP-API via Reports API...');

      try {
        // Importar biblioteca Amazon SP-API
        const { default: SellingPartnerAPI } = await import('npm:amazon-sp-api@latest');

        // Amazon config - use decrypted refresh token
        if (!refreshToken) {
          console.error('❌ Refresh token Amazon não encontrado na integração');
          return new Response(
            JSON.stringify({ 
              error: 'Conta Amazon não conectada corretamente. Reconecte sua conta Amazon Seller.' 
            }), 
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        console.log('🔧 Inicializando cliente Amazon SP-API...', {
          currentMarketplaceId: integration.marketplace_id,
          currentSellingPartnerId: integration.selling_partner_id,
          accountName: integration.account_name,
        });

        // Inicializar cliente Amazon SP-API
        const sellingPartner = new SellingPartnerAPI({
          region: 'na', // América (inclui Brasil)
          refresh_token: refreshToken,
          credentials: {
            SELLING_PARTNER_APP_CLIENT_ID: Deno.env.get('AMAZON_CLIENT_ID'),
            SELLING_PARTNER_APP_CLIENT_SECRET: Deno.env.get('AMAZON_CLIENT_SECRET'),
          },
        });

        // ========================================================
        // PASSO 1: Descobrir marketplaces válidos
        // ========================================================
        console.log('📊 Buscando getMarketplaceParticipations para validar conta...');
        
        let marketplaceParticipations: any[] = [];
        
        try {
          const participationsResponse = await sellingPartner.callAPI({
            operation: 'getMarketplaceParticipations',
            endpoint: 'sellers',
          });

          console.log('📋 Resposta getMarketplaceParticipations:', JSON.stringify(participationsResponse, null, 2));

          if (participationsResponse && Array.isArray(participationsResponse)) {
            marketplaceParticipations = participationsResponse;
          } else if (participationsResponse?.payload && Array.isArray(participationsResponse.payload)) {
            marketplaceParticipations = participationsResponse.payload;
          }

          console.log('✅ Marketplaces encontrados:', marketplaceParticipations.length);
          
        } catch (participationError: any) {
          console.error('❌ Erro ao buscar getMarketplaceParticipations:', participationError);
          
          if (!integration.marketplace_id) {
            return new Response(
              JSON.stringify({
                error: 'Não foi possível validar sua conta Amazon.',
                details: participationError?.message || 'Erro ao obter marketplaces participantes',
                hint: 'Reconecte sua conta Amazon Seller.',
              }),
              {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            );
          }
        }

        // ========================================================
        // PASSO 2: Validar/ajustar marketplace_id
        // ========================================================
        let validatedMarketplaceId = integration.marketplace_id;
        const validMarketplaceIds = marketplaceParticipations
          .filter((p: any) => p.participation?.isParticipating)
          .map((p: any) => p.marketplace?.id)
          .filter(Boolean);

        console.log('📍 Marketplaces válidos para esta conta:', validMarketplaceIds);

        // Se não temos marketplace configurado, escolher um
        if (!validatedMarketplaceId && validMarketplaceIds.length > 0) {
          const brazilMarketplace = 'A2Q3Y263D00KWC';
          if (validMarketplaceIds.includes(brazilMarketplace)) {
            validatedMarketplaceId = brazilMarketplace;
            console.log('🇧🇷 Selecionando marketplace Brasil automaticamente');
          } else {
            validatedMarketplaceId = validMarketplaceIds[0];
            console.log(`📍 Selecionando primeiro marketplace disponível: ${validatedMarketplaceId}`);
          }
        }

        // Validação final: precisamos ter um marketplace válido
        if (!validatedMarketplaceId) {
          console.error('❌ Nenhum marketplace válido encontrado');
          return new Response(
            JSON.stringify({
              error: 'Nenhum marketplace válido encontrado para sua conta Amazon.',
              hint: 'Verifique se sua conta Amazon Seller está ativa e tem pelo menos um marketplace habilitado.',
            }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // ========================================================
        // PASSO 3: Usar Reports API (funciona para FBA e FBM)
        // ========================================================
        console.log('📄 Criando relatório GET_MERCHANT_LISTINGS_ALL_DATA no marketplace:', validatedMarketplaceId);

        // Criar relatório
        let reportId: string;
        try {
          const createReportResponse = await sellingPartner.callAPI({
            operation: 'createReport',
            endpoint: 'reports',
            body: {
              reportType: 'GET_MERCHANT_LISTINGS_ALL_DATA',
              marketplaceIds: [validatedMarketplaceId],
            },
          });

          reportId = createReportResponse?.reportId;
          console.log('✅ Relatório criado com ID:', reportId);

          if (!reportId) {
            throw new Error('Não foi possível criar o relatório');
          }
        } catch (createError: any) {
          console.error('❌ Erro ao criar relatório:', createError);
          throw createError;
        }

        // ========================================================
        // PASSO 4: Aguardar relatório ficar pronto (polling)
        // ========================================================
        console.log('⏳ Aguardando relatório ficar pronto...');

        let reportDocumentId: string | null = null;
        const maxAttempts = 30; // ~5 minutos (10s * 30)
        let attempts = 0;

        while (attempts < maxAttempts && !reportDocumentId) {
          await new Promise(resolve => setTimeout(resolve, 3000)); // Esperar 3 segundos (otimizado)
          attempts++;

          try {
            const reportStatus = await sellingPartner.callAPI({
              operation: 'getReport',
              endpoint: 'reports',
              path: {
                reportId: reportId,
              },
            });

            console.log(`📊 Status do relatório (tentativa ${attempts}):`, reportStatus?.processingStatus);

            if (reportStatus?.processingStatus === 'DONE') {
              reportDocumentId = reportStatus.reportDocumentId;
              console.log('✅ Relatório pronto! Document ID:', reportDocumentId);
            } else if (reportStatus?.processingStatus === 'CANCELLED') {
              throw new Error('Relatório foi cancelado pela Amazon');
            } else if (reportStatus?.processingStatus === 'FATAL') {
              throw new Error('Erro fatal ao gerar relatório na Amazon');
            }
          } catch (statusError: any) {
            console.error(`⚠️ Erro ao verificar status (tentativa ${attempts}):`, statusError?.message);
          }
        }

        if (!reportDocumentId) {
          console.error('❌ Timeout esperando relatório ficar pronto');
          return new Response(
            JSON.stringify({
              error: 'Timeout ao gerar relatório de produtos da Amazon.',
              hint: 'O relatório está demorando mais que o esperado. Tente novamente em alguns minutos.',
            }),
            {
              status: 408,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // ========================================================
        // PASSO 5: Baixar documento do relatório
        // ========================================================
        console.log('📥 Baixando documento do relatório...');

        let reportContent: string;
        try {
          // Obter URL do documento
          const documentInfo = await sellingPartner.callAPI({
            operation: 'getReportDocument',
            endpoint: 'reports',
            path: {
              reportDocumentId: reportDocumentId,
            },
          });

          console.log('📋 Informações do documento:', {
            hasUrl: !!documentInfo?.url,
            compressionAlgorithm: documentInfo?.compressionAlgorithm,
          });

          if (!documentInfo?.url) {
            throw new Error('URL do documento não encontrada');
          }

          // Baixar conteúdo do relatório
          const downloadResponse = await fetch(documentInfo.url);
          
          if (!downloadResponse.ok) {
            throw new Error(`Erro ao baixar relatório: ${downloadResponse.status}`);
          }

          // Se o relatório estiver comprimido com GZIP, precisamos descomprimir
          if (documentInfo.compressionAlgorithm === 'GZIP') {
            const arrayBuffer = await downloadResponse.arrayBuffer();
            const decompressedStream = new Response(arrayBuffer).body?.pipeThrough(new DecompressionStream('gzip'));
            if (decompressedStream) {
              reportContent = await new Response(decompressedStream).text();
            } else {
              throw new Error('Erro ao descomprimir relatório');
            }
          } else {
            reportContent = await downloadResponse.text();
          }

          console.log('✅ Relatório baixado, tamanho:', reportContent.length, 'caracteres');
          console.log('📋 Primeiras 500 caracteres:', reportContent.substring(0, 500));

        } catch (downloadError: any) {
          console.error('❌ Erro ao baixar documento:', downloadError);
          throw downloadError;
        }

        // ========================================================
        // PASSO 6: Parsear relatório TSV e mapear produtos
        // ========================================================
        console.log('🔄 Parseando relatório TSV...');

        try {
          const lines = reportContent.split('\n').filter(line => line.trim());
          
          if (lines.length < 2) {
            console.log('⚠️ Relatório vazio ou apenas cabeçalho');
            return new Response(
              JSON.stringify({ 
                message: 'Nenhum produto encontrado na sua conta Amazon Seller', 
                count: 0 
              }), 
              { 
                status: 200, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
              }
            );
          }

          // Primeira linha é o cabeçalho
          const headers = lines[0].split('\t').map(h => h.trim().toLowerCase().replace(/-/g, '_'));
          console.log('📋 Colunas do relatório:', headers);

          // Mapear índices das colunas que precisamos
          const columnIndexes = {
            itemName: headers.findIndex(h => h === 'item_name' || h === 'item-name' || h === 'product_name'),
            sellerSku: headers.findIndex(h => h === 'seller_sku' || h === 'seller-sku' || h === 'sku'),
            price: headers.findIndex(h => h === 'price'),
            quantity: headers.findIndex(h => h === 'quantity' || h === 'available_quantity'),
            asin: headers.findIndex(h => h === 'asin1' || h === 'asin'),
            status: headers.findIndex(h => h === 'status'),
            fulfillmentChannel: headers.findIndex(h => h === 'fulfillment_channel' || h === 'fulfilment_channel' || h === 'fulfilment-channel'),
            imageUrl: headers.findIndex(h => h === 'image_url' || h === 'image-url'),
          };

          console.log('📋 Índices das colunas (inclui imagem):', columnIndexes);

          console.log('📋 Índices das colunas:', columnIndexes);

          // Parsear cada linha de produto
          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split('\t');
            
            // Extrair valores usando os índices
            const itemName = columnIndexes.itemName >= 0 ? values[columnIndexes.itemName]?.trim() : null;
            const sellerSku = columnIndexes.sellerSku >= 0 ? values[columnIndexes.sellerSku]?.trim() : null;
            const priceStr = columnIndexes.price >= 0 ? values[columnIndexes.price]?.trim() : null;
            const quantityStr = columnIndexes.quantity >= 0 ? values[columnIndexes.quantity]?.trim() : null;
            const status = columnIndexes.status >= 0 ? values[columnIndexes.status]?.trim() : null;
            const imageUrl = columnIndexes.imageUrl >= 0 ? values[columnIndexes.imageUrl]?.trim() : null;

            // Validar SKU (obrigatório)
            if (!sellerSku || sellerSku === '') {
              continue;
            }

            // Pular produtos inativos/fechados
            if (status && (status.toLowerCase() === 'inactive' || status.toLowerCase() === 'closed')) {
              console.log(`⏭️ Pulando produto inativo: ${sellerSku}`);
              continue;
            }

            // Converter preço
            let sellingPrice: number | null = null;
            if (priceStr && priceStr !== '') {
              const cleanPrice = priceStr.replace(/[^\d.,]/g, '').replace(',', '.');
              const parsedPrice = parseFloat(cleanPrice);
              if (!isNaN(parsedPrice) && parsedPrice > 0) {
                sellingPrice = parsedPrice;
              }
            }

            // Converter quantidade
            let stock = 0;
            if (quantityStr && quantityStr !== '') {
              const parsedQty = parseInt(quantityStr, 10);
              if (!isNaN(parsedQty)) {
                stock = parsedQty;
              }
            }

            // Processar URL da imagem (garantir HTTPS)
            let processedImageUrl: string | null = null;
            if (imageUrl && imageUrl !== '') {
              processedImageUrl = imageUrl.replace('http://', 'https://');
              console.log(`🖼️ Imagem encontrada para ${sellerSku}:`, processedImageUrl.substring(0, 80) + '...');
            }

            const productData = {
              user_id: user.id,
              name: itemName || sellerSku,
              sku: sellerSku,
              stock: stock,
              selling_price: sellingPrice,
              image_url: processedImageUrl,
            };

            productsToInsert.push(productData);
          }

          console.log(`✅ ${productsToInsert.length} produtos parseados do relatório`);

        } catch (parseError: any) {
          console.error('❌ Erro ao parsear relatório:', parseError);
          throw parseError;
        }

        console.log(`📦 Preparados ${productsToInsert.length} produtos da Amazon para importação`);

      } catch (amazonError: any) {
        console.error('💥 Erro na importação Amazon:', amazonError);
        
        // Tratamento de erros específicos da Amazon
        if (amazonError.code === 'InvalidInput') {
          const msg = amazonError?.message ? String(amazonError.message) : '';

          if (msg.includes('not registered in marketplace')) {
            const merchantIdMatch = msg.match(/Merchant:\s*(\w+)/i);
            const marketplaceIdMatch = msg.match(/marketplace:\s*(\w+)/i);
            
            const extractedMerchantId = merchantIdMatch ? merchantIdMatch[1] : null;
            const extractedMarketplaceId = marketplaceIdMatch ? marketplaceIdMatch[1] : null;

            console.error('❌ Diagnóstico de erro de marketplace:', {
              merchantIdFromError: extractedMerchantId,
              marketplaceIdFromError: extractedMarketplaceId,
              configuredMarketplaceId: integration.marketplace_id,
            });

            const marketplaceNames: Record<string, string> = {
              'A2Q3Y263D00KWC': 'Brasil',
              'ATVPDKIKX0DER': 'Estados Unidos',
              'A2EUQ1WTGCTBG2': 'Canadá',
              'A1AM78C64UM0Y8': 'México',
              'A1PA6795UKMFR9': 'Alemanha',
              'A1RKKUPIHCS9HS': 'Espanha',
              'A13V1IB3VIYZZH': 'França',
              'APJ6JRA9NG5V4': 'Itália',
              'A1F83G8C2ARO7P': 'Reino Unido',
              'A21TJRUUN4KGV': 'Índia',
              'A19VAU5U5O7RUS': 'Singapura',
              'A39IBJ37TRP1C6': 'Austrália',
              'A1VC38T7YXB528': 'Japão',
            };

            const marketplaceName = extractedMarketplaceId 
              ? (marketplaceNames[extractedMarketplaceId] || extractedMarketplaceId)
              : 'configurado';

            return new Response(
              JSON.stringify({
                error: `Sua conta Amazon (Merchant: ${extractedMerchantId || 'desconhecido'}) não está registrada no marketplace ${marketplaceName}.`,
                details: msg,
                hint: 'O refresh token usado pertence a uma conta/região diferente. Reconecte sua conta Amazon.',
              }),
              {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            );
          }

          return new Response(
            JSON.stringify({
              error: 'Parâmetros inválidos na requisição Amazon.',
              details: msg || undefined,
            }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
        
        if (amazonError.code === 'Unauthorized' || amazonError.code === 'InvalidToken') {
          return new Response(
            JSON.stringify({ 
              error: 'Token Amazon expirado ou inválido. Reconecte sua conta Amazon Seller.' 
            }), 
            { 
              status: 401, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        // Erro genérico
        return new Response(
          JSON.stringify({ 
            error: 'Erro ao buscar produtos da Amazon. Tente novamente ou contate o suporte.',
            details: amazonError.message 
          }), 
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    if (productsToInsert.length === 0) {
      console.log('No valid products to insert');
      return new Response(
        JSON.stringify({ message: 'No valid products found to import', count: 0 }), 
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Prepared ${productsToInsert.length} products for insertion`);

    // Validate products before upsert
    const validProducts = productsToInsert.filter(product => {
      if (!product.user_id || !product.name || !product.sku) {
        console.warn('❌ Produto inválido filtrado:', product);
        return false;
      }
      return true;
    });

    if (validProducts.length === 0) {
      console.error('Nenhum produto válido após validação');
      return new Response(
        JSON.stringify({ error: 'Nenhum produto válido para importar' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`✅ ${validProducts.length} produtos válidos para upsert`);

    // Step 5: Upsert products into database
    const { data: insertedProducts, error: insertError } = await supabaseClient
      .from('products')
      .upsert(validProducts, { 
        onConflict: 'user_id,sku',
        ignoreDuplicates: false 
      })
      .select();

    if (insertError) {
      console.error('❌ Error inserting products:', insertError);
      console.error('❌ Error details:', JSON.stringify(insertError, null, 2));
      return new Response(
        JSON.stringify({ 
          error: 'Failed to save products to database',
          details: insertError.message || insertError
        }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`✅ Successfully imported ${validProducts.length} products`);

    // ========================================================
    // PASSO 7: Criar vínculos na tabela product_listings
    // ========================================================
    if (insertedProducts && insertedProducts.length > 0 && platform) {
      console.log('🔗 Criando vínculos em product_listings...');
      
      const listingsToInsert = insertedProducts.map(product => ({
        user_id: user.id,
        product_id: product.id,
        platform: platform,
        platform_product_id: product.sku, // SKU é usado como identificador
        integration_id: integration.id,
        sync_status: 'active',
        last_sync_at: new Date().toISOString(),
      }));

      const { data: insertedListings, error: listingsError } = await supabaseClient
        .from('product_listings')
        .upsert(listingsToInsert, {
          onConflict: 'product_id,integration_id',
          ignoreDuplicates: false,
        })
        .select();

      if (listingsError) {
        console.warn('⚠️ Erro ao criar vínculos em product_listings:', listingsError);
        // Não falhar a importação por causa disso
      } else {
        console.log(`✅ ${insertedListings?.length || 0} vínculos criados em product_listings`);
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Products imported successfully', 
        count: validProducts.length,
        imported: insertedProducts?.length || 0
      }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error in import-products function:', error);
    console.error('Error details:', error.message);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});