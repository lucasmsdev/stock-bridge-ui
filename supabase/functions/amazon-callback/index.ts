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
    console.log('🔄 Amazon OAuth callback recebido');
    
    const url = new URL(req.url);
    const code = url.searchParams.get('spapi_oauth_code');
    const state = url.searchParams.get('state'); // user_id
    const sellingPartnerId = url.searchParams.get('selling_partner_id');

    console.log('📋 Parâmetros recebidos:', { 
      hasCode: !!code, 
      hasState: !!state, 
      hasSellingPartnerId: !!sellingPartnerId 
    });

    if (!code || !state) {
      console.error('❌ Parâmetros OAuth inválidos');
      return new Response(
        JSON.stringify({ error: 'Parâmetros OAuth inválidos. Código ou state ausente.' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Trocar código OAuth por tokens
    console.log('🔑 Trocando código OAuth por tokens...');
    
    const tokenResponse = await fetch('https://api.amazon.com/auth/o2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: Deno.env.get('AMAZON_CLIENT_ID')!,
        client_secret: Deno.env.get('AMAZON_CLIENT_SECRET')!,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('❌ Erro ao trocar código OAuth:', errorText);
      return new Response(
        JSON.stringify({ 
          error: 'Falha na autenticação Amazon', 
          details: errorText 
        }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const tokenData = await tokenResponse.json();
    
    if (!tokenData.access_token || !tokenData.refresh_token) {
      console.error('❌ Resposta do token não contém access_token ou refresh_token');
      return new Response(
        JSON.stringify({ error: 'Resposta do token inválida da Amazon' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('✅ Tokens obtidos com sucesso');

    // Salvar integração no Supabase usando service role
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, // Service role para inserir sem auth
    );

    console.log('💾 Salvando integração no banco de dados...');

    // Verificar se já existe integração com o mesmo selling_partner_id
    const { data: existingIntegrations, error: checkError } = await supabaseClient
      .from('integrations')
      .select('id, account_name')
      .eq('user_id', state)
      .eq('platform', 'amazon')
      .eq('selling_partner_id', sellingPartnerId);

    if (checkError) {
      console.error('❌ Erro ao verificar integrações existentes:', checkError);
    } else if (existingIntegrations && existingIntegrations.length > 0) {
      console.log('⚠️ Integração Amazon já existe para este seller:', sellingPartnerId);
      const appUrl = Deno.env.get('APP_URL') || 'https://fcvwogaqarkuqvumyqqm.supabase.co';
      const redirectUrl = `${appUrl}/app/integrations?status=duplicate`;
      return Response.redirect(redirectUrl, 302);
    }

    // Encrypt tokens before saving
    const { data: encryptedAccessToken } = await supabaseClient.rpc('encrypt_token', { token: tokenData.access_token });
    const { data: encryptedRefreshToken } = await supabaseClient.rpc('encrypt_token', { token: tokenData.refresh_token });

    // Sempre insere uma nova integração (suporta múltiplas contas)
    const { data: integration, error: insertError } = await supabaseClient
      .from('integrations')
      .insert({
        user_id: state,
        platform: 'amazon',
        encrypted_access_token: encryptedAccessToken,
        encrypted_refresh_token: encryptedRefreshToken,
        selling_partner_id: sellingPartnerId,
        marketplace_id: 'ATVPDKIKX0DER', // US marketplace por padrão
        account_name: sellingPartnerId || 'Amazon Seller',
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Erro ao salvar integração:', insertError);
      return new Response(
        JSON.stringify({ 
          error: 'Falha ao salvar integração', 
          details: insertError.message 
        }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('✅ Integração salva com sucesso:', integration?.id);

    // Redirecionar de volta para o app com sucesso
    const appUrl = Deno.env.get('APP_URL') || 'https://fcvwogaqarkuqvumyqqm.supabase.co';
    const redirectUrl = `${appUrl}/app/integrations?status=success`;
    
    console.log('🔄 Redirecionando para:', redirectUrl);

    return Response.redirect(redirectUrl, 302);

  } catch (error: any) {
    console.error('💥 Erro no callback Amazon:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno no servidor', 
        details: error.message 
      }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
