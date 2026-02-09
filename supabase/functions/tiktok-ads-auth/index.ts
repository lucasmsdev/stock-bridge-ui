import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const authCode = url.searchParams.get('auth_code');
    const state = url.searchParams.get('state'); // user_id

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const tiktokAppId = Deno.env.get('TIKTOK_ADS_APP_ID');
    const tiktokAppSecret = Deno.env.get('TIKTOK_ADS_APP_SECRET');
    const appUrl = Deno.env.get('APP_URL') || 'https://id-preview--be7c1eba-2174-4e2e-a9f0-aa07602a3be7.lovable.app';

    const redirectUrl = `${appUrl}/app/integrations`;

    console.log('🎵 TikTok Ads OAuth Callback');
    console.log('   auth_code received:', !!authCode);
    console.log('   State (user_id):', state);

    if (!authCode || !state) {
      console.error('❌ Missing auth_code or state parameter');
      return Response.redirect(`${redirectUrl}?status=error&message=missing_parameters`, 302);
    }

    if (!tiktokAppId || !tiktokAppSecret) {
      console.error('❌ Missing TIKTOK_ADS_APP_ID or TIKTOK_ADS_APP_SECRET');
      return Response.redirect(`${redirectUrl}?status=error&message=configuration_error`, 302);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const userId = state;

    // Get user's organization
    const { data: orgId } = await supabase.rpc('get_user_org_id', { user_uuid: userId });

    // Exchange auth_code for access_token
    console.log('📤 Exchanging auth_code for access token...');
    const tokenResponse = await fetch(
      'https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/',
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

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('❌ Token exchange failed:', errorData);
      return Response.redirect(`${redirectUrl}?status=error&message=token_exchange_failed`, 302);
    }

    const tokenData = await tokenResponse.json();
    console.log('📦 Token response code:', tokenData.code);

    if (tokenData.code !== 0) {
      console.error('❌ TikTok API error:', tokenData.message);
      return Response.redirect(`${redirectUrl}?status=error&message=${encodeURIComponent(tokenData.message || 'api_error')}`, 302);
    }

    const accessToken = tokenData.data.access_token;
    const advertiserIds = tokenData.data.advertiser_ids || [];
    console.log('✅ Access token obtained, advertiser_ids:', advertiserIds.length);

    // Check for existing integration
    const { data: existingIntegration } = await supabase
      .from('integrations')
      .select('id')
      .eq('user_id', userId)
      .eq('platform', 'tiktok_ads')
      .maybeSingle();

    if (existingIntegration) {
      console.log('⚠️ Integration already exists, updating...');
    }

    // Encrypt token
    const { data: encryptedAccessToken, error: encryptError } = await supabase.rpc('encrypt_token', {
      token: accessToken,
    });

    if (encryptError) {
      console.error('❌ Failed to encrypt token:', encryptError);
      return Response.redirect(`${redirectUrl}?status=error&message=encryption_failed`, 302);
    }

    // Save or update integration
    const integrationData = {
      user_id: userId,
      organization_id: orgId || null,
      platform: 'tiktok_ads',
      encrypted_access_token: encryptedAccessToken,
      encrypted_refresh_token: null,
      account_name: 'Conta TikTok Ads',
      token_expires_at: null, // TikTok Ads tokens are permanent
      marketplace_id: advertiserIds.length > 0 ? String(advertiserIds[0]) : null,
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

    console.log('🎉 TikTok Ads OAuth completed successfully!');
    return Response.redirect(`${redirectUrl}?status=success`, 302);

  } catch (error: any) {
    console.error('❌ Unexpected error in TikTok Ads OAuth:', error);
    const appUrl = Deno.env.get('APP_URL') || 'https://id-preview--be7c1eba-2174-4e2e-a9f0-aa07602a3be7.lovable.app';
    return Response.redirect(`${appUrl}/app/integrations?status=error&message=unexpected_error`, 302);
  }
});
