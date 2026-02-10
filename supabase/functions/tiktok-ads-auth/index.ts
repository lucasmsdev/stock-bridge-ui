import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const authCode = url.searchParams.get('auth_code');
    const state = url.searchParams.get('state'); // "user_id" or "user_id:sandbox"

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const tiktokAppId = Deno.env.get('TIKTOK_ADS_APP_ID');
    const tiktokAppSecret = Deno.env.get('TIKTOK_ADS_APP_SECRET');
    const appUrl = (Deno.env.get('APP_URL') || 'https://id-preview--be7c1eba-2174-4e2e-a9f0-aa07602a3be7.lovable.app').replace(/\/+$/, '');
    // Sandbox pode ser forçado via env ou detectado pelo state
    const envSandbox = Deno.env.get('TIKTOK_ADS_SANDBOX') === 'true';

    const redirectUrl = `${appUrl}/app/integrations`;

    // Parse state: "userId" or "userId:sandbox"
    let userId = state || '';
    let isSandbox = envSandbox;
    if (state?.includes(':sandbox')) {
      userId = state.split(':sandbox')[0];
      isSandbox = true;
    }

    const tiktokBaseUrl = isSandbox
      ? 'https://sandbox-ads.tiktok.com'
      : 'https://business-api.tiktok.com';

    console.log('🎵 TikTok Ads OAuth Callback');
    console.log('   Sandbox mode:', isSandbox);
    console.log('   Base URL:', tiktokBaseUrl);
    console.log('   auth_code received:', !!authCode);
    console.log('   user_id:', userId);

    if (!authCode || !userId) {
      console.error('❌ Missing auth_code or state parameter');
      return Response.redirect(`${redirectUrl}?status=error&message=missing_parameters`, 302);
    }

    if (!tiktokAppId || !tiktokAppSecret) {
      console.error('❌ Missing TIKTOK_ADS_APP_ID or TIKTOK_ADS_APP_SECRET');
      return Response.redirect(`${redirectUrl}?status=error&message=configuration_error`, 302);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's organization
    const { data: orgId, error: orgError } = await supabase.rpc('get_user_org_id', { user_uuid: userId });
    console.log('   org_id:', orgId, 'error:', orgError);

    // Exchange auth_code for access_token using correct base URL
    console.log('📤 Exchanging auth_code for access token...');
    
    let tokenResponse;
    try {
      tokenResponse = await fetch(
        `${tiktokBaseUrl}/open_api/v1.3/oauth2/access_token/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            app_id: tiktokAppId,
            secret: tiktokAppSecret,
            auth_code: authCode,
          }),
        }
      );
    } catch (fetchError: any) {
      console.error('❌ Fetch failed (network error):', fetchError.message);
      return Response.redirect(`${redirectUrl}?status=error&message=network_error`, 302);
    }

    console.log('📥 Token response status:', tokenResponse.status);
    
    const responseText = await tokenResponse.text();
    console.log('📥 Token response body:', responseText);

    if (!tokenResponse.ok) {
      console.error('❌ Token exchange failed with HTTP', tokenResponse.status);
      return Response.redirect(`${redirectUrl}?status=error&message=token_exchange_failed`, 302);
    }

    let tokenData;
    try {
      tokenData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ Failed to parse token response as JSON');
      return Response.redirect(`${redirectUrl}?status=error&message=invalid_response`, 302);
    }

    if (tokenData.code !== 0) {
      console.error('❌ TikTok API error code:', tokenData.code, 'message:', tokenData.message);
      return Response.redirect(`${redirectUrl}?status=error&message=${encodeURIComponent(tokenData.message || 'api_error')}`, 302);
    }

    const accessToken = tokenData.data?.access_token;
    const advertiserIds = tokenData.data?.advertiser_ids || [];
    console.log('✅ Access token obtained:', !!accessToken, 'advertiser_ids:', advertiserIds.length);

    if (!accessToken) {
      console.error('❌ No access_token in response data');
      return Response.redirect(`${redirectUrl}?status=error&message=no_access_token`, 302);
    }

    // Check for existing integration
    const { data: existingIntegration } = await supabase
      .from('integrations')
      .select('id')
      .eq('user_id', userId)
      .eq('platform', 'tiktok_ads')
      .maybeSingle();

    // Encrypt token
    const { data: encryptedAccessToken, error: encryptError } = await supabase.rpc('encrypt_token', {
      token: accessToken,
    });

    if (encryptError) {
      console.error('❌ Failed to encrypt token:', encryptError);
      return Response.redirect(`${redirectUrl}?status=error&message=encryption_failed`, 302);
    }

    // Save or update integration with is_sandbox flag in account_name
    const accountLabel = isSandbox ? 'Conta TikTok Ads (Sandbox)' : 'Conta TikTok Ads';
    const integrationData = {
      user_id: userId,
      organization_id: orgId || null,
      platform: 'tiktok_ads',
      encrypted_access_token: encryptedAccessToken,
      encrypted_refresh_token: null,
      account_name: accountLabel,
      token_expires_at: null,
      marketplace_id: advertiserIds.length > 0 ? String(advertiserIds[0]) : null,
      // Store sandbox flag in shop_domain field (reused for metadata)
      shop_domain: isSandbox ? 'sandbox' : null,
    };

    if (existingIntegration) {
      const { error: updateError } = await supabase
        .from('integrations')
        .update({ ...integrationData, updated_at: new Date().toISOString() })
        .eq('id', existingIntegration.id);

      if (updateError) {
        console.error('❌ Failed to update integration:', updateError);
        return Response.redirect(`${redirectUrl}?status=error&message=update_failed`, 302);
      }
      console.log('✅ Integration updated (sandbox:', isSandbox, ')');
    } else {
      const { error: insertError } = await supabase
        .from('integrations')
        .insert(integrationData);

      if (insertError) {
        console.error('❌ Failed to create integration:', insertError);
        return Response.redirect(`${redirectUrl}?status=error&message=insert_failed`, 302);
      }
      console.log('✅ Integration created (sandbox:', isSandbox, ')');
    }

    console.log('🎉 TikTok Ads OAuth completed! Sandbox:', isSandbox);
    return Response.redirect(`${redirectUrl}?status=success`, 302);

  } catch (error: any) {
    console.error('❌ Unexpected error in TikTok Ads OAuth:', error.message, error.stack);
    const appUrl = (Deno.env.get('APP_URL') || 'https://id-preview--be7c1eba-2174-4e2e-a9f0-aa07602a3be7.lovable.app').replace(/\/+$/, '');
    return Response.redirect(`${appUrl}/app/integrations?status=error&message=unexpected_error`, 302);
  }
});
