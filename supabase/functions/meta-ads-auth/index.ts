import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // user_id
    const error = url.searchParams.get('error');
    const errorReason = url.searchParams.get('error_reason');
    const errorDescription = url.searchParams.get('error_description');

    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const metaAppId = Deno.env.get('META_APP_ID');
    const metaAppSecret = Deno.env.get('META_APP_SECRET');
    const appUrl = Deno.env.get('APP_URL') || 'https://id-preview--be7c1eba-2174-4e2e-a9f0-aa07602a3be7.lovable.app';

    const redirectUrl = `${appUrl}/app/integrations`;

    console.log('🔵 Meta Ads OAuth Callback');
    console.log('   Code received:', !!code);
    console.log('   State (user_id):', state);

    // Handle error from Facebook
    if (error) {
      console.error('❌ Facebook OAuth error:', error, errorReason, errorDescription);
      return Response.redirect(`${redirectUrl}?status=error&message=${encodeURIComponent(errorDescription || error)}`, 302);
    }

    // Validate required parameters
    if (!code || !state) {
      console.error('❌ Missing code or state parameter');
      return Response.redirect(`${redirectUrl}?status=error&message=missing_parameters`, 302);
    }

    if (!metaAppId || !metaAppSecret) {
      console.error('❌ Missing META_APP_ID or META_APP_SECRET');
      return Response.redirect(`${redirectUrl}?status=error&message=configuration_error`, 302);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const userId = state;

    // Get user's organization
    const { data: orgId } = await supabase.rpc('get_user_org_id', { user_uuid: userId });

    // Step 1: Exchange code for short-lived access token
    console.log('📤 Exchanging code for access token...');
    const callbackUrl = `${supabaseUrl}/functions/v1/meta-ads-auth`;
    
    const tokenResponse = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token` +
      `?client_id=${metaAppId}` +
      `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
      `&client_secret=${metaAppSecret}` +
      `&code=${code}`,
      { method: 'GET' }
    );

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('❌ Token exchange failed:', errorData);
      return Response.redirect(`${redirectUrl}?status=error&message=token_exchange_failed`, 302);
    }

    const tokenData = await tokenResponse.json();
    const shortLivedToken = tokenData.access_token;
    console.log('✅ Short-lived token obtained');

    // Step 2: Exchange for long-lived access token (60 days)
    console.log('📤 Converting to long-lived token...');
    const longLivedResponse = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token` +
      `?grant_type=fb_exchange_token` +
      `&client_id=${metaAppId}` +
      `&client_secret=${metaAppSecret}` +
      `&fb_exchange_token=${shortLivedToken}`,
      { method: 'GET' }
    );

    if (!longLivedResponse.ok) {
      const errorData = await longLivedResponse.text();
      console.error('❌ Long-lived token exchange failed:', errorData);
      return Response.redirect(`${redirectUrl}?status=error&message=long_lived_token_failed`, 302);
    }

    const longLivedData = await longLivedResponse.json();
    const longLivedToken = longLivedData.access_token;
    const expiresIn = longLivedData.expires_in || 5184000; // Default 60 days in seconds
    console.log('✅ Long-lived token obtained, expires in:', expiresIn, 'seconds');

    // Step 3: Get user info and ad accounts
    console.log('📤 Fetching user info and ad accounts...');
    const userInfoResponse = await fetch(
      `https://graph.facebook.com/v21.0/me?fields=id,name,email&access_token=${longLivedToken}`
    );

    let accountName = 'Meta Ads Account';
    let facebookUserId = '';

    if (userInfoResponse.ok) {
      const userInfo = await userInfoResponse.json();
      accountName = userInfo.name || 'Meta Ads Account';
      facebookUserId = userInfo.id || '';
      console.log('✅ User info:', userInfo.name);
    }

    // Get ad accounts
    const adAccountsResponse = await fetch(
      `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_id,account_status,currency&access_token=${longLivedToken}`
    );

    let adAccounts: any[] = [];
    if (adAccountsResponse.ok) {
      const adAccountsData = await adAccountsResponse.json();
      adAccounts = adAccountsData.data || [];
      console.log('✅ Found', adAccounts.length, 'ad accounts');
    }

    // Step 4: Check for existing integration
    const { data: existingIntegration } = await supabase
      .from('integrations')
      .select('id')
      .eq('user_id', userId)
      .eq('platform', 'meta_ads')
      .maybeSingle();

    if (existingIntegration) {
      console.log('⚠️ Integration already exists, updating...');
    }

    // Step 5: Encrypt tokens
    const { data: encryptedAccessToken, error: encryptError } = await supabase.rpc('encrypt_token', {
      token: longLivedToken
    });

    if (encryptError) {
      console.error('❌ Failed to encrypt token:', encryptError);
      return Response.redirect(`${redirectUrl}?status=error&message=encryption_failed`, 302);
    }

    // Calculate token expiry
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

    // Step 6: Save or update integration
    const integrationData = {
      user_id: userId,
      organization_id: orgId || null,
      platform: 'meta_ads',
      encrypted_access_token: encryptedAccessToken,
      encrypted_refresh_token: null, // Meta long-lived tokens don't have refresh tokens - they're renewed via exchange
      account_name: accountName,
      token_expires_at: tokenExpiresAt.toISOString(),
      // Store ad accounts info in a JSON-compatible way
      selling_partner_id: facebookUserId, // Reusing this field for Meta user ID
      marketplace_id: adAccounts.length > 0 ? adAccounts[0].account_id : null, // Store first ad account ID
    };

    if (existingIntegration) {
      const { error: updateError } = await supabase
        .from('integrations')
        .update({
          ...integrationData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingIntegration.id);

      if (updateError) {
        console.error('❌ Failed to update integration:', updateError);
        return Response.redirect(`${redirectUrl}?status=error&message=update_failed`, 302);
      }
      console.log('✅ Integration updated successfully');
    } else {
      const { error: insertError } = await supabase
        .from('integrations')
        .insert(integrationData);

      if (insertError) {
        console.error('❌ Failed to create integration:', insertError);
        return Response.redirect(`${redirectUrl}?status=error&message=insert_failed`, 302);
      }
      console.log('✅ Integration created successfully');
    }

    // Success - redirect back to integrations page
    console.log('🎉 Meta Ads OAuth completed successfully!');
    return Response.redirect(`${redirectUrl}?status=success`, 302);

  } catch (error: any) {
    console.error('❌ Unexpected error in Meta Ads OAuth:', error);
    const appUrl = Deno.env.get('APP_URL') || 'https://id-preview--be7c1eba-2174-4e2e-a9f0-aa07602a3be7.lovable.app';
    return Response.redirect(`${appUrl}/app/integrations?status=error&message=unexpected_error`, 302);
  }
});
