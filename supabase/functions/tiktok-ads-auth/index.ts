import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const appUrl = (Deno.env.get('APP_URL') || 'https://id-preview--be7c1eba-2174-4e2e-a9f0-aa07602a3be7.lovable.app').replace(/\/+$/, '');
    const redirectUrl = `${appUrl}/app/integrations`;

    // ========== POST: Sandbox manual token ==========
    if (req.method === 'POST') {
      const { access_token, advertiser_id, user_id } = await req.json();

      if (!access_token || !advertiser_id || !user_id) {
        return new Response(JSON.stringify({ error: 'Missing access_token, advertiser_id or user_id' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('🎵 TikTok Ads Sandbox - POST manual token');
      console.log('   user_id:', user_id);
      console.log('   advertiser_id:', advertiser_id);

      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Get user's organization
      const { data: orgId } = await supabase.rpc('get_user_org_id', { user_uuid: user_id });

      // Check for existing integration
      const { data: existingIntegration } = await supabase
        .from('integrations')
        .select('id')
        .eq('user_id', user_id)
        .eq('platform', 'tiktok_ads')
        .maybeSingle();

      // Encrypt token
      const { data: encryptedAccessToken, error: encryptError } = await supabase.rpc('encrypt_token', {
        token: access_token,
      });

      if (encryptError) {
        console.error('❌ Failed to encrypt token:', encryptError);
        return new Response(JSON.stringify({ error: 'Encryption failed' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const integrationData = {
        user_id,
        organization_id: orgId || null,
        platform: 'tiktok_ads',
        encrypted_access_token: encryptedAccessToken,
        encrypted_refresh_token: null,
        account_name: 'Conta TikTok Ads (Sandbox)',
        token_expires_at: null,
        marketplace_id: advertiser_id,
        shop_domain: 'sandbox',
      };

      if (existingIntegration) {
        const { error: updateError } = await supabase
          .from('integrations')
          .update({ ...integrationData, updated_at: new Date().toISOString() })
          .eq('id', existingIntegration.id);

        if (updateError) {
          console.error('❌ Failed to update integration:', updateError);
          return new Response(JSON.stringify({ error: 'Update failed' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        console.log('✅ Sandbox integration updated');
      } else {
        const { error: insertError } = await supabase
          .from('integrations')
          .insert(integrationData);

        if (insertError) {
          console.error('❌ Failed to create integration:', insertError);
          return new Response(JSON.stringify({ error: 'Insert failed' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        console.log('✅ Sandbox integration created');
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========== GET: Standard OAuth callback ==========
    const url = new URL(req.url);
    const authCode = url.searchParams.get('auth_code');
    const state = url.searchParams.get('state');

    const tiktokAppId = Deno.env.get('TIKTOK_ADS_APP_ID');
    const tiktokAppSecret = Deno.env.get('TIKTOK_ADS_APP_SECRET');
    const userId = state || '';
    const tiktokBaseUrl = 'https://business-api.tiktok.com';

    console.log('🎵 TikTok Ads OAuth Callback');
    console.log('   auth_code received:', !!authCode);
    console.log('   user_id:', userId);
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

    const { data: orgId, error: orgError } = await supabase.rpc('get_user_org_id', { user_uuid: userId });
    console.log('   org_id:', orgId, 'error:', orgError);

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

    const { data: existingIntegration } = await supabase
      .from('integrations')
      .select('id')
      .eq('user_id', userId)
      .eq('platform', 'tiktok_ads')
      .maybeSingle();

    const { data: encryptedAccessToken, error: encryptError } = await supabase.rpc('encrypt_token', {
      token: accessToken,
    });

    if (encryptError) {
      console.error('❌ Failed to encrypt token:', encryptError);
      return Response.redirect(`${redirectUrl}?status=error&message=encryption_failed`, 302);
    }

    const integrationData = {
      user_id: userId,
      organization_id: orgId || null,
      platform: 'tiktok_ads',
      encrypted_access_token: encryptedAccessToken,
      encrypted_refresh_token: null,
      account_name: 'Conta TikTok Ads',
      token_expires_at: null,
      marketplace_id: advertiserIds.length > 0 ? String(advertiserIds[0]) : null,
      shop_domain: null,
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
      console.log('✅ Integration updated');
    } else {
      const { error: insertError } = await supabase
        .from('integrations')
        .insert(integrationData);

      if (insertError) {
        console.error('❌ Failed to create integration:', insertError);
        return Response.redirect(`${redirectUrl}?status=error&message=insert_failed`, 302);
      }
      console.log('✅ Integration created');
    }

    console.log('🎉 TikTok Ads OAuth completed!');
    return Response.redirect(`${redirectUrl}?status=success`, 302);

  } catch (error: any) {
    console.error('❌ Unexpected error in TikTok Ads OAuth:', error.message, error.stack);
    const appUrl = (Deno.env.get('APP_URL') || 'https://id-preview--be7c1eba-2174-4e2e-a9f0-aa07602a3be7.lovable.app').replace(/\/+$/, '');
    return Response.redirect(`${appUrl}/app/integrations?status=error&message=unexpected_error`, 302);
  }
});
