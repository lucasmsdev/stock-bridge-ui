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

    // Get TikTok Shop credentials from environment
    const appKey = Deno.env.get('TIKTOK_SHOP_APP_KEY');
    const appSecret = Deno.env.get('TIKTOK_SHOP_APP_SECRET');

    if (!appKey || !appSecret) {
      console.error('Missing TikTok Shop credentials');
      return new Response(
        JSON.stringify({ error: 'Server configuration error: TikTok Shop credentials not set' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Exchange code for tokens with TikTok Shop API
    console.log('🔄 Trocando código por tokens com TikTok Shop...');
    const tokenResponse = await fetch('https://auth.tiktok-shops.com/api/v2/token/get', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_key: appKey,
        app_secret: appSecret,
        auth_code: code,
        grant_type: 'authorized_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('TikTok Shop token exchange failed:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to exchange code for tokens' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenResult = await tokenResponse.json();
    const tokenData = tokenResult.data;

    if (!tokenData?.access_token || tokenData.access_token.trim() === '') {
      console.error('No access token received from TikTok Shop:', tokenResult);
      return new Response(
        JSON.stringify({ error: 'Failed to obtain valid access token from TikTok Shop', details: tokenResult.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Successfully obtained tokens from TikTok Shop');

    // Get shop info from authorized shops
    let shopName = 'Conta TikTok Shop';
    let shopCipher = '';

    try {
      // Generate sign for the API call
      const path = '/api/shops';
      const timestamp = Math.floor(Date.now() / 1000);
      const queryParams: Record<string, string> = {
        app_key: appKey,
        timestamp: timestamp.toString(),
      };

      const sign = await generateSign(path, queryParams, appSecret);

      const shopUrl = `https://open-api.tiktokglobalshop.com${path}?app_key=${appKey}&timestamp=${timestamp}&sign=${sign}&access_token=${tokenData.access_token}`;
      
      const shopResponse = await fetch(shopUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (shopResponse.ok) {
        const shopResult = await shopResponse.json();
        const shops = shopResult.data?.shops || [];
        
        if (shops.length > 0) {
          shopCipher = shops[0].cipher || shops[0].shop_cipher || '';
          shopName = shops[0].shop_name || shops[0].name || 'Conta TikTok Shop';
          console.log('✅ TikTok Shop info:', shopName, 'cipher:', shopCipher);
        }
      } else {
        console.warn('⚠️ Could not get TikTok Shop info, using default name');
        const errorText = await shopResponse.text();
        console.warn('Shop API response:', errorText);
      }
    } catch (shopError) {
      console.error('Error fetching TikTok Shop info:', shopError);
    }

    // Check for duplicate accounts
    const { data: existingIntegrations, error: checkError } = await supabase
      .from('integrations')
      .select('id, account_name')
      .eq('user_id', user.id)
      .eq('platform', 'tiktokshop');

    if (!checkError && existingIntegrations && existingIntegrations.length > 0) {
      const sameAccount = existingIntegrations.find(int => int.account_name === shopName);
      if (sameAccount) {
        console.log('⚠️ Conta TikTok Shop já conectada:', shopName);
        return new Response(
          JSON.stringify({
            error: 'Conta já conectada',
            message: 'Esta conta do TikTok Shop já está conectada ao seu UniStock.'
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

    // TikTok Shop access tokens expire in ~24 hours
    const accessTokenExpireIn = tokenData.access_token_expire_in || 86400; // default 24h
    const tokenExpiresAt = new Date(Date.now() + accessTokenExpireIn * 1000);

    const { error: insertError } = await supabase
      .from('integrations')
      .insert({
        user_id: user.id,
        organization_id: organizationId,
        platform: 'tiktokshop',
        encrypted_access_token: encryptedAccessToken,
        encrypted_refresh_token: encryptedRefreshToken,
        account_name: shopName,
        selling_partner_id: shopCipher, // Store shop_cipher for API calls
        token_expires_at: tokenExpiresAt.toISOString(),
      });

    if (insertError) {
      console.error('Error creating integration:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save integration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ TikTok Shop integration created successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'TikTok Shop integration completed successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in tiktok-shop-auth function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// HMAC-SHA256 signature helper for TikTok Shop API
async function generateSign(
  path: string,
  params: Record<string, string>,
  appSecret: string
): Promise<string> {
  // Sort params alphabetically
  const sortedKeys = Object.keys(params).sort();
  const paramString = sortedKeys.map(key => `${key}${params[key]}`).join('');
  
  // Concatenate: app_secret + path + sorted_params + app_secret
  const baseString = `${appSecret}${path}${paramString}${appSecret}`;
  
  // Generate HMAC-SHA256
  const encoder = new TextEncoder();
  const keyData = encoder.encode(appSecret);
  const messageData = encoder.encode(baseString);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  
  // Convert to hex string
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}