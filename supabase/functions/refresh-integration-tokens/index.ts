import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tempos de expiração por plataforma (em horas)
const TOKEN_EXPIRY_HOURS: Record<string, number> = {
  amazon: 1,
  mercadolivre: 6,
  shopee: 4,
  shopify: 0, // Não expira
  meta_ads: 1440, // 60 dias = 1440 horas
};

// Margem de segurança para refresh (em minutos)
const REFRESH_MARGIN_MINUTES = 15;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    console.log('🔄 [CRON] Iniciando rotação automática de tokens...');
    console.log(`⏰ Timestamp: ${new Date().toISOString()}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar integrações ativas que precisam de renovação
    // Filtrar por: tem refresh token E (token_expires_at é NULL OU expira em breve)
    const marginDate = new Date(Date.now() + REFRESH_MARGIN_MINUTES * 60 * 1000);
    
    const { data: integrations, error: fetchError } = await supabase
      .from('integrations')
      .select('*')
      .not('encrypted_refresh_token', 'is', null);

    if (fetchError) {
      console.error('❌ Erro ao buscar integrações:', fetchError);
      throw fetchError;
    }

    // Filtrar integrações que precisam de refresh
    const integrationsToRefresh = (integrations || []).filter(integration => {
      // Shopify não precisa de refresh
      if (integration.platform === 'shopify') {
        return false;
      }
      
      // Se não tem token_expires_at, precisa calcular (migração antiga)
      if (!integration.token_expires_at) {
        console.log(`📋 ${integration.platform} - ID: ${integration.id} - Sem data de expiração, fazendo refresh`);
        return true;
      }
      
      // Se expira em menos de REFRESH_MARGIN_MINUTES, precisa refresh
      const expiresAt = new Date(integration.token_expires_at);
      if (expiresAt <= marginDate) {
        const minutesUntilExpiry = Math.round((expiresAt.getTime() - Date.now()) / 60000);
        console.log(`⚠️ ${integration.platform} - ID: ${integration.id} - Expira em ${minutesUntilExpiry} minutos, fazendo refresh`);
        return true;
      }
      
      return false;
    });

    console.log(`📊 Encontradas ${integrations?.length || 0} integrações com refresh token`);
    console.log(`🔄 ${integrationsToRefresh.length} precisam de renovação`);

    const results = {
      total: integrations?.length || 0,
      needsRefresh: integrationsToRefresh.length,
      refreshed: 0,
      failed: 0,
      skipped: (integrations?.length || 0) - integrationsToRefresh.length,
      details: [] as any[]
    };

    for (const integration of integrationsToRefresh) {
      try {
        console.log(`🔍 Processando ${integration.platform} - ID: ${integration.id}`);
        console.log(`   Account: ${integration.account_name || 'N/A'}`);

        // Descriptografar refresh token
        const { data: refreshToken, error: decryptError } = await supabase.rpc('decrypt_token', {
          encrypted_token: integration.encrypted_refresh_token
        });

        if (decryptError || !refreshToken) {
          console.log(`⏭️ Pulando ${integration.platform} - Erro ao descriptografar: ${decryptError?.message || 'token inválido'}`);
          results.failed++;
          results.details.push({
            platform: integration.platform,
            id: integration.id,
            account: integration.account_name,
            status: 'failed',
            error: 'Failed to decrypt refresh token'
          });
          continue;
        }

        // Renovar token baseado na plataforma
        let newTokenData = null;
        let expiryHours = TOKEN_EXPIRY_HOURS[integration.platform] || 1;

        if (integration.platform === 'mercadolivre') {
          newTokenData = await refreshMercadoLivreToken(refreshToken);
        } else if (integration.platform === 'amazon') {
          newTokenData = await refreshAmazonToken(refreshToken);
        } else if (integration.platform === 'shopee') {
          newTokenData = await refreshShopeeToken(refreshToken, integration);
        } else if (integration.platform === 'meta_ads') {
          // Meta Ads uses long-lived tokens that are renewed via fb_exchange_token
          // We need the current access token, not refresh token
          const { data: accessToken } = await supabase.rpc('decrypt_token', {
            encrypted_token: integration.encrypted_access_token
          });
          if (accessToken) {
            newTokenData = await refreshMetaAdsToken(accessToken);
          }
        } else {
          console.log(`⏭️ Pulando ${integration.platform} - Plataforma não suportada para refresh`);
          results.skipped++;
          continue;
        }

        if (newTokenData && newTokenData.access_token) {
          // Criptografar novo token
          const { data: encryptedAccessToken, error: encryptError } = await supabase.rpc('encrypt_token', {
            token: newTokenData.access_token
          });

          if (encryptError) {
            console.error(`❌ Erro ao criptografar access token: ${encryptError.message}`);
            results.failed++;
            continue;
          }

          // Calcular nova data de expiração
          const newExpiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

          const updateData: any = {
            encrypted_access_token: encryptedAccessToken,
            token_expires_at: newExpiresAt.toISOString(),
            updated_at: new Date().toISOString()
          };

          // Se vier novo refresh token, atualizar também
          if (newTokenData.refresh_token) {
            const { data: encryptedRefreshToken } = await supabase.rpc('encrypt_token', {
              token: newTokenData.refresh_token
            });
            updateData.encrypted_refresh_token = encryptedRefreshToken;
            console.log(`   🔑 Novo refresh token recebido e atualizado`);
          }

          // Atualizar no banco
          const { error: updateError } = await supabase
            .from('integrations')
            .update(updateData)
            .eq('id', integration.id);

          if (updateError) {
            console.error(`❌ Erro ao atualizar ${integration.platform}:`, updateError);
            results.failed++;
            results.details.push({
              platform: integration.platform,
              id: integration.id,
              account: integration.account_name,
              status: 'failed',
              error: updateError.message
            });
          } else {
            console.log(`✅ Token renovado com sucesso: ${integration.platform}`);
            console.log(`   📅 Nova expiração: ${newExpiresAt.toISOString()}`);
            results.refreshed++;
            results.details.push({
              platform: integration.platform,
              id: integration.id,
              account: integration.account_name,
              status: 'success',
              newExpiresAt: newExpiresAt.toISOString()
            });
          }
        } else {
          console.log(`⚠️ Falha ao renovar ${integration.platform} - Resposta inválida da API`);
          results.failed++;
          results.details.push({
            platform: integration.platform,
            id: integration.id,
            account: integration.account_name,
            status: 'failed',
            error: 'Invalid response from platform API'
          });
        }

      } catch (error: any) {
        console.error(`❌ Erro ao processar integração ${integration.id}:`, error);
        results.failed++;
        results.details.push({
          platform: integration.platform,
          id: integration.id,
          account: integration.account_name,
          status: 'failed',
          error: error.message
        });
      }
    }

    const duration = Date.now() - startTime;
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('📊 RESUMO DA ROTAÇÃO DE TOKENS');
    console.log('═══════════════════════════════════════');
    console.log(`   Total de integrações: ${results.total}`);
    console.log(`   Precisavam refresh: ${results.needsRefresh}`);
    console.log(`   ✅ Renovados: ${results.refreshed}`);
    console.log(`   ❌ Falhas: ${results.failed}`);
    console.log(`   ⏭️ Pulados: ${results.skipped}`);
    console.log(`   ⏱️ Duração: ${duration}ms`);
    console.log('═══════════════════════════════════════');

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        duration_ms: duration,
        summary: {
          total: results.total,
          needs_refresh: results.needsRefresh,
          refreshed: results.refreshed,
          failed: results.failed,
          skipped: results.skipped
        },
        details: results.details
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('❌ Erro geral na rotação de tokens:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        timestamp: new Date().toISOString(),
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Renovar token do Mercado Livre
async function refreshMercadoLivreToken(refreshToken: string) {
  const appId = Deno.env.get('MERCADOLIVRE_APP_ID');
  const secretKey = Deno.env.get('MERCADOLIVRE_SECRET_KEY');

  if (!appId || !secretKey) {
    throw new Error('Credenciais do Mercado Livre não configuradas');
  }

  console.log('   🔄 Chamando API Mercado Livre...');

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
    console.error('   ❌ Erro API Mercado Livre:', errorText);
    throw new Error(`Mercado Livre refresh failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log('   ✅ API Mercado Livre respondeu com sucesso');
  
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshToken,
  };
}

// Renovar token da Amazon
async function refreshAmazonToken(refreshToken: string) {
  const clientId = Deno.env.get('AMAZON_CLIENT_ID');
  const clientSecret = Deno.env.get('AMAZON_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('Credenciais da Amazon não configuradas');
  }

  console.log('   🔄 Chamando API Amazon...');

  const response = await fetch('https://api.amazon.com/auth/o2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('   ❌ Erro API Amazon:', errorText);
    throw new Error(`Amazon refresh failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log('   ✅ API Amazon respondeu com sucesso');
  
  return {
    access_token: data.access_token,
    // Amazon não retorna novo refresh_token
  };
}

// Renovar token do Shopee
async function refreshShopeeToken(refreshToken: string, integration: any) {
  console.log('   🔄 Shopee refresh token...');
  
  // TODO: Implementar quando tivermos credenciais Shopee
  // Shopee usa um sistema diferente com partner_id e partner_key
  console.log('   ⚠️ Renovação de token Shopee não implementada ainda');
  return null;
}

// Renovar token do Meta Ads
async function refreshMetaAdsToken(currentAccessToken: string) {
  const metaAppId = Deno.env.get('META_APP_ID');
  const metaAppSecret = Deno.env.get('META_APP_SECRET');

  if (!metaAppId || !metaAppSecret) {
    throw new Error('Credenciais do Meta Ads não configuradas');
  }

  console.log('   🔄 Chamando API Meta para renovar long-lived token...');

  // Meta's long-lived tokens can be renewed by exchanging them for a new one
  // This works as long as the token hasn't expired yet
  const response = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token` +
    `?grant_type=fb_exchange_token` +
    `&client_id=${metaAppId}` +
    `&client_secret=${metaAppSecret}` +
    `&fb_exchange_token=${currentAccessToken}`,
    { method: 'GET' }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('   ❌ Erro API Meta:', errorText);
    throw new Error(`Meta Ads refresh failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log('   ✅ API Meta respondeu com sucesso');
  
  return {
    access_token: data.access_token,
    // Meta long-lived tokens don't use refresh tokens
  };
}
