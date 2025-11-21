import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Iniciando rotação automática de tokens...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar integrações ativas que precisam de renovação
    const { data: integrations, error: fetchError } = await supabase
      .from('integrations')
      .select('*')
      .not('encrypted_refresh_token', 'is', null);

    if (fetchError) {
      console.error('❌ Erro ao buscar integrações:', fetchError);
      throw fetchError;
    }

    console.log(`📊 Encontradas ${integrations?.length || 0} integrações com refresh token`);

    const results = {
      total: integrations?.length || 0,
      refreshed: 0,
      failed: 0,
      skipped: 0,
      details: [] as any[]
    };

    for (const integration of integrations || []) {
      try {
        console.log(`🔍 Processando ${integration.platform} - ID: ${integration.id}`);

        // Descriptografar refresh token
        const { data: refreshToken } = await supabase.rpc('decrypt_token', {
          encrypted_token: integration.encrypted_refresh_token
        });

        if (!refreshToken) {
          console.log(`⏭️ Pulando ${integration.platform} - Sem refresh token válido`);
          results.skipped++;
          continue;
        }

        // Renovar token baseado na plataforma
        let newTokenData = null;

        if (integration.platform === 'mercadolivre') {
          newTokenData = await refreshMercadoLivreToken(refreshToken);
        } else if (integration.platform === 'amazon') {
          newTokenData = await refreshAmazonToken(refreshToken);
        } else if (integration.platform === 'shopify') {
          // Shopify tokens não expiram, pular
          console.log(`⏭️ Pulando Shopify - Tokens não expiram`);
          results.skipped++;
          continue;
        } else if (integration.platform === 'shopee') {
          newTokenData = await refreshShopeeToken(refreshToken, integration);
        } else {
          console.log(`⏭️ Pulando ${integration.platform} - Plataforma não suportada`);
          results.skipped++;
          continue;
        }

        if (newTokenData && newTokenData.access_token) {
          // Criptografar novo token
          const { data: encryptedAccessToken } = await supabase.rpc('encrypt_token', {
            token: newTokenData.access_token
          });

          const updateData: any = {
            encrypted_access_token: encryptedAccessToken,
            updated_at: new Date().toISOString()
          };

          // Se vier novo refresh token, atualizar também
          if (newTokenData.refresh_token) {
            const { data: encryptedRefreshToken } = await supabase.rpc('encrypt_token', {
              token: newTokenData.refresh_token
            });
            updateData.encrypted_refresh_token = encryptedRefreshToken;
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
              status: 'failed',
              error: updateError.message
            });
          } else {
            console.log(`✅ Token renovado com sucesso: ${integration.platform}`);
            results.refreshed++;
            results.details.push({
              platform: integration.platform,
              id: integration.id,
              status: 'success'
            });
          }
        } else {
          console.log(`⚠️ Falha ao renovar ${integration.platform} - Resposta inválida`);
          results.failed++;
          results.details.push({
            platform: integration.platform,
            id: integration.id,
            status: 'failed',
            error: 'Invalid response from platform'
          });
        }

      } catch (error) {
        console.error(`❌ Erro ao processar integração ${integration.id}:`, error);
        results.failed++;
        results.details.push({
          platform: integration.platform,
          id: integration.id,
          status: 'failed',
          error: error.message
        });
      }
    }

    console.log('📊 Resumo da rotação:', results);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total: results.total,
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

  } catch (error) {
    console.error('❌ Erro geral na rotação de tokens:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
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

  console.log('🔄 Renovando token Mercado Livre...');

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
    console.error('❌ Erro ao renovar token Mercado Livre:', errorText);
    throw new Error(`Mercado Livre refresh failed: ${response.status}`);
  }

  const data = await response.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshToken, // Usar o antigo se não vier novo
  };
}

// Renovar token da Amazon
async function refreshAmazonToken(refreshToken: string) {
  const clientId = Deno.env.get('AMAZON_CLIENT_ID');
  const clientSecret = Deno.env.get('AMAZON_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('Credenciais da Amazon não configuradas');
  }

  console.log('🔄 Renovando token Amazon...');

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
    console.error('❌ Erro ao renovar token Amazon:', errorText);
    throw new Error(`Amazon refresh failed: ${response.status}`);
  }

  const data = await response.json();
  return {
    access_token: data.access_token,
    // Amazon não retorna novo refresh_token
  };
}

// Renovar token do Shopee
async function refreshShopeeToken(refreshToken: string, integration: any) {
  console.log('🔄 Renovando token Shopee...');
  
  // Shopee usa um sistema diferente, precisaria da lógica específica
  // Por enquanto, retornar null para pular
  console.log('⚠️ Renovação de token Shopee não implementada ainda');
  return null;
}
