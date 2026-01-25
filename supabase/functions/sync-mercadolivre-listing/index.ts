import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncRequest {
  productId: string;
  listingId: string;
  integrationId: string;
  platformProductId: string;
  sellingPrice?: number;
  stock?: number;
  name?: string;
  imageUrl?: string;
}

interface MercadoLivreError {
  message: string;
  error: string;
  status: number;
  cause?: Array<{
    code: string;
    message: string;
  }>;
}

async function refreshMercadoLivreToken(
  supabaseAdmin: any, 
  integrationId: string, 
  refreshToken: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number } | null> {
  const appId = Deno.env.get('MERCADOLIVRE_APP_ID');
  const secretKey = Deno.env.get('MERCADOLIVRE_SECRET_KEY');

  if (!appId || !secretKey) {
    console.error('❌ MERCADOLIVRE_APP_ID ou MERCADOLIVRE_SECRET_KEY não configurados');
    return null;
  }

  try {
    console.log('🔄 Renovando token do Mercado Livre...');
    
    const response = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: appId,
        client_secret: secretKey,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro ao renovar token:', errorText);
      return null;
    }

    const tokenData = await response.json();
    console.log('✅ Token renovado com sucesso');

    // Calcular nova data de expiração
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    // Atualizar tokens criptografados no banco
    const { error: updateError } = await supabaseAdmin.rpc('encrypt_token', { token: tokenData.access_token });
    
    if (!updateError) {
      // Buscar tokens criptografados
      const { data: encryptedAccess } = await supabaseAdmin.rpc('encrypt_token', { token: tokenData.access_token });
      const { data: encryptedRefresh } = await supabaseAdmin.rpc('encrypt_token', { token: tokenData.refresh_token });

      await supabaseAdmin
        .from('integrations')
        .update({
          encrypted_access_token: encryptedAccess,
          encrypted_refresh_token: encryptedRefresh,
          token_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', integrationId);
    }

    return tokenData;
  } catch (error) {
    console.error('💥 Exceção ao renovar token:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    // Cliente com auth do usuário para validação
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: req.headers.get('Authorization')! },
      },
    });

    // Cliente admin para operações privilegiadas (decrypt tokens)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Validar usuário
    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: SyncRequest = await req.json();
    const { productId, listingId, integrationId, platformProductId, sellingPrice, stock, name, imageUrl } = body;

    if (!integrationId || !platformProductId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: integrationId, platformProductId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔄 Sincronizando produto com Mercado Livre:', {
      productId,
      platformProductId,
      sellingPrice,
      stock,
      name: name?.substring(0, 30) + '...',
    });

    // Buscar integração e descriptografar token
    const { data: integration, error: integrationError } = await supabaseAdmin
      .from('integrations')
      .select('id, encrypted_access_token, encrypted_refresh_token, token_expires_at, user_id')
      .eq('id', integrationId)
      .eq('platform', 'mercadolivre')
      .single();

    if (integrationError || !integration) {
      console.error('❌ Integração não encontrada:', integrationError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Integração do Mercado Livre não encontrada',
          requiresReconnect: true,
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se a integração pertence ao usuário
    if (integration.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - integration belongs to another user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Descriptografar access token
    const { data: accessToken, error: decryptError } = await supabaseAdmin.rpc(
      'decrypt_token',
      { encrypted_token: integration.encrypted_access_token }
    );

    if (decryptError || !accessToken) {
      console.error('❌ Erro ao descriptografar token:', decryptError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Erro ao descriptografar token. Reconecte sua conta do Mercado Livre.',
          requiresReconnect: true,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let currentAccessToken = accessToken;

    // Verificar se token está expirado
    if (integration.token_expires_at) {
      const expiresAt = new Date(integration.token_expires_at);
      const now = new Date();
      
      // Se expira em menos de 5 minutos, renovar
      if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
        console.log('⏰ Token próximo de expirar, renovando...');
        
        // Descriptografar refresh token
        const { data: refreshToken } = await supabaseAdmin.rpc(
          'decrypt_token',
          { encrypted_token: integration.encrypted_refresh_token }
        );

        if (refreshToken) {
          const newTokens = await refreshMercadoLivreToken(supabaseAdmin, integrationId, refreshToken);
          if (newTokens) {
            currentAccessToken = newTokens.access_token;
          }
        }
      }
    }

    // Construir payload para API do Mercado Livre
    const mlPayload: Record<string, any> = {};

    if (sellingPrice !== undefined && sellingPrice !== null) {
      mlPayload.price = sellingPrice;
    }

    if (stock !== undefined && stock !== null) {
      mlPayload.available_quantity = stock;
    }

    if (imageUrl) {
      mlPayload.pictures = [{ source: imageUrl }];
    }

    // Primeiro, verificar se podemos alterar o título
    let canChangeTitle = true;
    let itemStatus = 'unknown';
    let soldQuantity = 0;

  let isCatalogProduct = false;
  
  if (name) {
      // Buscar informações do item para verificar se tem vendas ou é de catálogo
      const itemResponse = await fetch(
        `https://api.mercadolibre.com/items/${platformProductId}`,
        {
          headers: {
            'Authorization': `Bearer ${currentAccessToken}`,
          },
        }
      );

      if (itemResponse.ok) {
        const itemData = await itemResponse.json();
        soldQuantity = itemData.sold_quantity || 0;
        itemStatus = itemData.status || 'unknown';
        
        // Produtos de catálogo NÃO podem ter título alterado
        if (itemData.catalog_listing || itemData.catalog_product_id) {
          canChangeTitle = false;
          isCatalogProduct = true;
          console.log('📦 Produto de catálogo - título controlado pelo ML');
        } else if (soldQuantity > 0) {
          canChangeTitle = false;
          console.log(`⚠️ Produto tem ${soldQuantity} vendas - título não pode ser alterado`);
        }
      }
    }

    // Adicionar título apenas se permitido
    if (name && canChangeTitle) {
      mlPayload.title = name;
    }

    // Se não há nada para atualizar
    if (Object.keys(mlPayload).length === 0) {
      console.log('ℹ️ Nenhum campo para atualizar no Mercado Livre');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhum campo para atualizar',
          skipped: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📤 Enviando para Mercado Livre:', JSON.stringify(mlPayload, null, 2));

    // Chamar API do Mercado Livre
    const mlResponse = await fetch(
      `https://api.mercadolibre.com/items/${platformProductId}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${currentAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mlPayload),
      }
    );

    const mlResponseText = await mlResponse.text();
    let mlResult: any;

    try {
      mlResult = JSON.parse(mlResponseText);
    } catch {
      mlResult = { raw: mlResponseText };
    }

    console.log('📥 Resposta Mercado Livre:', mlResponse.status, JSON.stringify(mlResult, null, 2));

    // Atualizar status do listing no banco
    const updateListingData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (mlResponse.ok) {
      updateListingData.sync_status = 'active';
      updateListingData.last_sync_at = new Date().toISOString();
      updateListingData.sync_error = null;

      await supabaseAdmin
        .from('product_listings')
        .update(updateListingData)
        .eq('id', listingId);

      const response: any = {
        success: true,
        message: 'Produto atualizado no Mercado Livre',
        platformProductId,
        updatedFields: Object.keys(mlPayload),
        mlResponse: {
          id: mlResult.id,
          status: mlResult.status,
          price: mlResult.price,
          available_quantity: mlResult.available_quantity,
        },
      };

      // Avisar se título não foi alterado
      if (name && !canChangeTitle) {
        response.warnings = [{
          code: 'title_not_modifiable',
          message: isCatalogProduct 
            ? 'Nome não foi alterado (produto de catálogo). Preço e estoque foram atualizados.'
            : `Nome não foi alterado (${soldQuantity} venda(s)). Preço e estoque foram atualizados.`,
        }];
      }

      return new Response(
        JSON.stringify(response),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      // Tratar erros específicos do Mercado Livre
      const mlError = mlResult as MercadoLivreError;
      let errorMessage = mlError.message || 'Erro ao atualizar no Mercado Livre';
      let requiresReconnect = false;

      // Verificar se é erro de título - tentar novamente sem o título
      const isTitleError = mlError.cause?.some(c => 
        c.code?.includes('title') || 
        c.message?.toLowerCase().includes('title')
      );

      if (isTitleError && mlPayload.title) {
        console.log('🔄 Título rejeitado, tentando novamente sem ele...');
        delete mlPayload.title;

        if (Object.keys(mlPayload).length > 0) {
          // Nova tentativa sem o título
          const retryResponse = await fetch(
            `https://api.mercadolibre.com/items/${platformProductId}`,
            {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${currentAccessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(mlPayload),
            }
          );

          const retryText = await retryResponse.text();
          let retryResult: any;
          try {
            retryResult = JSON.parse(retryText);
          } catch {
            retryResult = { raw: retryText };
          }

          console.log('📥 Resposta retry (sem título):', retryResponse.status, JSON.stringify(retryResult, null, 2));

          if (retryResponse.ok) {
            // Sucesso! Atualizar status
            updateListingData.sync_status = 'active';
            updateListingData.last_sync_at = new Date().toISOString();
            updateListingData.sync_error = null;

            await supabaseAdmin
              .from('product_listings')
              .update(updateListingData)
              .eq('id', listingId);

            return new Response(
              JSON.stringify({
                success: true,
                message: 'Produto atualizado no Mercado Livre',
                platformProductId,
                updatedFields: Object.keys(mlPayload),
                mlResponse: {
                  id: retryResult.id,
                  status: retryResult.status,
                  price: retryResult.price,
                  available_quantity: retryResult.available_quantity,
                },
                warnings: [{
                  code: 'title_not_modifiable',
                  message: 'Nome não foi alterado (produto de catálogo ou com vendas). Preço e estoque foram atualizados.',
                }],
              }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          // Se retry também falhou, usar o erro do retry
          errorMessage = retryResult.message || 'Erro ao atualizar no Mercado Livre';
        }
      }

      if (mlResponse.status === 401) {
        errorMessage = 'Token expirado. Reconecte sua conta do Mercado Livre.';
        requiresReconnect = true;
      } else if (mlResponse.status === 403) {
        errorMessage = 'Sem permissão para atualizar este anúncio. Verifique se a conta conectada é a correta.';
        requiresReconnect = true;
      } else if (mlError.cause && mlError.cause.length > 0 && !isTitleError) {
        // Mensagens de erro específicas (exceto título que já foi tratado)
        const firstCause = mlError.cause[0];
        errorMessage = firstCause.message || errorMessage;
      }

      updateListingData.sync_status = 'error';
      updateListingData.sync_error = errorMessage;

      await supabaseAdmin
        .from('product_listings')
        .update(updateListingData)
        .eq('id', listingId);

      console.error('❌ Erro Mercado Livre:', errorMessage);

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: errorMessage,
          requiresReconnect,
          mlStatus: mlResponse.status,
          mlError: mlResult,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: any) {
    console.error('💥 Erro inesperado:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Erro interno do servidor',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
