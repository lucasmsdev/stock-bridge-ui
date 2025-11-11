import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

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
    // Verify this is a POST request
    if (req.method !== 'POST') {
      console.error('Invalid method:', req.method);
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }), 
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get request body
    const { code, redirect_uri } = await req.json();

    if (!code || !redirect_uri) {
      console.error('Missing required parameters:', { code: !!code, redirect_uri: !!redirect_uri });
      return new Response(
        JSON.stringify({ error: 'Missing code or redirect_uri' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get JWT from Authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Authorization required' }), 
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Verify JWT and get user
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);

    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }), 
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Authenticated user:', user.id);

    // Get Mercado Livre credentials from environment
    const appId = Deno.env.get('MERCADOLIVRE_APP_ID');
    const secretKey = Deno.env.get('MERCADOLIVRE_SECRET_KEY');

    if (!appId || !secretKey) {
      console.error('Missing Mercado Livre credentials');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Exchange code for tokens with Mercado Livre API
    const tokenResponse = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: appId,
        client_secret: secretKey,
        code: code,
        redirect_uri: redirect_uri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Mercado Livre token exchange failed:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to exchange code for tokens' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const tokenData = await tokenResponse.json();
    
    // Validate that we actually received valid tokens
    if (!tokenData.access_token || tokenData.access_token.trim() === '') {
      console.error('No access token received from Mercado Livre:', tokenData);
      return new Response(
        JSON.stringify({ error: 'Failed to obtain valid access token from Mercado Livre' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    console.log('Successfully obtained tokens from Mercado Livre');

    // Get user information from Mercado Livre
    let accountName = 'Conta Mercado Livre';
    try {
      const userInfoResponse = await fetch('https://api.mercadolibre.com/users/me', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
      });

      if (userInfoResponse.ok) {
        const userInfo = await userInfoResponse.json();
        accountName = userInfo.nickname || userInfo.first_name || 'Conta Mercado Livre';
        console.log('Successfully obtained user info from Mercado Livre:', accountName);
      } else {
        console.error('Failed to get user info from Mercado Livre');
      }
    } catch (userInfoError) {
      console.error('Error fetching user info from Mercado Livre:', userInfoError);
    }

    // Sempre insere uma nova integração (suporta múltiplas contas)
    // Mas verifica se já não existe a mesma conta
    const { data: existingIntegrations, error: checkError } = await supabase
      .from('integrations')
      .select('id, account_name')
      .eq('user_id', user.id)
      .eq('platform', 'mercadolivre');

    if (!checkError && existingIntegrations && existingIntegrations.length > 0) {
      // Verificar se o account_name já existe (mesmo vendedor)
      const sameAccount = existingIntegrations.find(int => int.account_name === accountName);
      if (sameAccount) {
        console.log('⚠️ Conta Mercado Livre já conectada:', accountName);
        return new Response(
          JSON.stringify({ 
            error: 'Conta já conectada',
            message: 'Esta conta do Mercado Livre já está conectada ao seu UniStock.' 
          }), 
          { 
            status: 409, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    const { error: insertError } = await supabase
      .from('integrations')
      .insert({
        user_id: user.id,
        platform: 'mercadolivre',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        account_name: accountName,
      });

    if (insertError) {
      console.error('Error creating integration:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save integration' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Integration created successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Mercado Livre integration completed successfully' 
      }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error in mercadolivre-auth function:', error);
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