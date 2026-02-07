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
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { code, redirect_uri } = await req.json();

    if (!code || !redirect_uri) {
      return new Response(
        JSON.stringify({ error: 'Missing code or redirect_uri' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify JWT and get user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);

    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated user:', user.id);

    // Get user's organization_id for RLS compliance
    const { data: userOrg } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    const organizationId = userOrg?.organization_id || null;

    // Get Magalu credentials from environment
    const clientId = Deno.env.get('MAGALU_CLIENT_ID');
    const clientSecret = Deno.env.get('MAGALU_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      console.error('Missing Magalu credentials');
      return new Response(
        JSON.stringify({ error: 'Server configuration error: Magalu credentials not set' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Exchange code for tokens with Magalu ID API
    console.log('🔄 Trocando código por tokens com Magalu ID...');
    const tokenResponse = await fetch('https://id.magalu.com/oauth/token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: redirect_uri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Magalu token exchange failed:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to exchange code for tokens' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token || tokenData.access_token.trim() === '') {
      console.error('No access token received from Magalu:', tokenData);
      return new Response(
        JSON.stringify({ error: 'Failed to obtain valid access token from Magalu' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Successfully obtained tokens from Magalu');

    // Get account info from Magalu API
    let accountName = 'Conta Magalu';
    try {
      const userInfoResponse = await fetch('https://api.magalu.com/account/v1/whoami', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Accept': 'application/json',
        },
      });

      if (userInfoResponse.ok) {
        const userInfo = await userInfoResponse.json();
        accountName = userInfo.name || userInfo.email || userInfo.uuid || 'Conta Magalu';
        console.log('✅ Magalu account info:', accountName);
      } else {
        console.warn('⚠️ Could not get Magalu account info, using default name');
      }
    } catch (userInfoError) {
      console.error('Error fetching Magalu user info:', userInfoError);
    }

    // Check for duplicate accounts
    const { data: existingIntegrations, error: checkError } = await supabase
      .from('integrations')
      .select('id, account_name')
      .eq('user_id', user.id)
      .eq('platform', 'magalu');

    if (!checkError && existingIntegrations && existingIntegrations.length > 0) {
      const sameAccount = existingIntegrations.find(int => int.account_name === accountName);
      if (sameAccount) {
        console.log('⚠️ Conta Magalu já conectada:', accountName);
        return new Response(
          JSON.stringify({
            error: 'Conta já conectada',
            message: 'Esta conta do Magalu já está conectada ao seu UniStock.'
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Encrypt tokens before saving
    const { data: encryptedAccessToken } = await supabase.rpc('encrypt_token', { token: tokenData.access_token });
    const { data: encryptedRefreshToken } = tokenData.refresh_token
      ? await supabase.rpc('encrypt_token', { token: tokenData.refresh_token })
      : { data: null };

    // Token expires in 2 hours (7200s) per Magalu docs
    const tokenExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

    const { error: insertError } = await supabase
      .from('integrations')
      .insert({
        user_id: user.id,
        organization_id: organizationId,
        platform: 'magalu',
        encrypted_access_token: encryptedAccessToken,
        encrypted_refresh_token: encryptedRefreshToken,
        account_name: accountName,
        token_expires_at: tokenExpiresAt.toISOString(),
      });

    if (insertError) {
      console.error('Error creating integration:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save integration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Magalu integration created successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Magalu integration completed successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in magalu-auth function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
