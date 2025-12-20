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
    const { refresh_token, account_name } = await req.json();

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

    try {
      console.log('📊 Buscando informações do vendedor...');
      const spApiResponse = await fetch(
        'https://sellingpartnerapi-na.amazon.com/sellers/v1/marketplaceParticipations',
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
            if (item.participation) {
              sellerId = item.participation.sellerId;
              if (item.marketplace?.name) {
                sellerName = account_name || `Amazon Seller (${item.marketplace.name})`;
              } else if (sellerId) {
                sellerName = account_name || `Amazon Seller ${sellerId}`;
              }
              console.log('✅ Seller encontrado:', sellerId, sellerName);
              break;
            }
          }
        }
      }
    } catch (sellerError) {
      console.error('⚠️ Erro ao buscar info do seller (não crítico):', sellerError);
    }

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

    // Encrypt tokens
    console.log('🔒 Criptografando tokens...');
    const { data: encryptedAccessToken } = await supabaseClient.rpc('encrypt_token', { token: tokenData.access_token });
    const { data: encryptedRefreshToken } = await supabaseClient.rpc('encrypt_token', { token: refresh_token });

    // Save integration
    console.log('💾 Salvando integração...');
    const { data: integration, error: insertError } = await supabaseClient
      .from('integrations')
      .insert({
        user_id: user.id,
        platform: 'amazon',
        access_token: 'encrypted', // Placeholder for legacy column
        encrypted_access_token: encryptedAccessToken,
        encrypted_refresh_token: encryptedRefreshToken,
        encryption_migrated: true,
        selling_partner_id: sellerId,
        marketplace_id: Deno.env.get('AMAZON_MARKETPLACE_ID') || 'ATVPDKIKX0DER',
        account_name: sellerName,
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
