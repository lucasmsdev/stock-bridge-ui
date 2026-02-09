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
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // user_id
    const error = url.searchParams.get('error');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const googleClientId = Deno.env.get('GOOGLE_ADS_CLIENT_ID');
    const googleClientSecret = Deno.env.get('GOOGLE_ADS_CLIENT_SECRET');
    const appUrl = Deno.env.get('APP_URL') || 'https://id-preview--be7c1eba-2174-4e2e-a9f0-aa07602a3be7.lovable.app';

    const redirectUrl = `${appUrl}/app/integrations`;

    console.log('🟢 Google Ads OAuth Callback');
    console.log('   Code received:', !!code);
    console.log('   State (user_id):', state);

    // Handle error from Google
    if (error) {
      console.error('❌ Google OAuth error:', error);
      return Response.redirect(`${redirectUrl}?status=error&message=${encodeURIComponent(error)}`, 302);
    }

    // Validate required parameters
    if (!code || !state) {
      console.error('❌ Missing code or state parameter');
      return Response.redirect(`${redirectUrl}?status=error&message=missing_parameters`, 302);
    }

    if (!googleClientId || !googleClientSecret) {
      console.error('❌ Missing GOOGLE_ADS_CLIENT_ID or GOOGLE_ADS_CLIENT_SECRET');
      return Response.redirect(`${redirectUrl}?status=error&message=configuration_error`, 302);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const userId = state;

    // Get user's organization
    const { data: orgId } = await supabase.rpc('get_user_org_id', { user_uuid: userId });

    // Step 1: Exchange code for tokens
    console.log('📤 Exchanging code for tokens...');
    const callbackUrl = `${supabaseUrl}/functions/v1/google-ads-auth`;

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: googleClientId,
        client_secret: googleClientSecret,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('❌ Token exchange failed:', errorData);
      return Response.redirect(`${redirectUrl}?status=error&message=token_exchange_failed`, 302);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in || 3600; // Default 1 hour

    console.log('✅ Tokens obtained successfully');

    if (!accessToken) {
      console.error('❌ No access token received');
      return Response.redirect(`${redirectUrl}?status=error&message=no_access_token`, 302);
    }

    // Step 2: Get user info from Google
    console.log('📤 Fetching Google user info...');
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let accountName = 'Google Ads Account';
    if (userInfoResponse.ok) {
      const userInfo = await userInfoResponse.json();
      accountName = userInfo.name || userInfo.email || 'Google Ads Account';
      console.log('✅ User info:', accountName);
    }

    // Step 3: Get Google Ads customer IDs using the Google Ads API
    const developerToken = Deno.env.get('GOOGLE_ADS_DEVELOPER_TOKEN');
    let customerId = '';

    if (developerToken) {
      console.log('📤 Fetching Google Ads customer accounts...');
      try {
        const customersResponse = await fetch(
          'https://googleads.googleapis.com/v18/customers:listAccessibleCustomers',
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'developer-token': developerToken,
            },
          }
        );

        if (customersResponse.ok) {
          const customersData = await customersResponse.json();
          const resourceNames = customersData.resourceNames || [];
          console.log('✅ Found', resourceNames.length, 'accessible customers');

          if (resourceNames.length > 0) {
            // Extract customer ID from resource name (format: customers/1234567890)
            customerId = resourceNames[0].replace('customers/', '');
            console.log('   Primary customer ID:', customerId);
          }
        } else {
          const errorText = await customersResponse.text();
          console.warn('⚠️ Could not fetch customer accounts:', errorText);
        }
      } catch (custError) {
        console.warn('⚠️ Error fetching customer accounts:', custError);
      }
    }

    // Step 4: Check for existing integration
    const { data: existingIntegration } = await supabase
      .from('integrations')
      .select('id')
      .eq('user_id', userId)
      .eq('platform', 'google_ads')
      .maybeSingle();

    if (existingIntegration) {
      console.log('⚠️ Integration already exists, updating...');
    }

    // Step 5: Encrypt tokens
    const { data: encryptedAccessToken, error: encryptError } = await supabase.rpc('encrypt_token', {
      token: accessToken,
    });

    if (encryptError) {
      console.error('❌ Failed to encrypt access token:', encryptError);
      return Response.redirect(`${redirectUrl}?status=error&message=encryption_failed`, 302);
    }

    let encryptedRefreshToken = null;
    if (refreshToken) {
      const { data: encRefresh, error: encRefreshError } = await supabase.rpc('encrypt_token', {
        token: refreshToken,
      });
      if (encRefreshError) {
        console.error('❌ Failed to encrypt refresh token:', encRefreshError);
      } else {
        encryptedRefreshToken = encRefresh;
      }
    }

    // Calculate token expiry
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

    // Step 6: Save or update integration
    const integrationData = {
      user_id: userId,
      organization_id: orgId || null,
      platform: 'google_ads',
      encrypted_access_token: encryptedAccessToken,
      encrypted_refresh_token: encryptedRefreshToken,
      account_name: accountName,
      token_expires_at: tokenExpiresAt.toISOString(),
      marketplace_id: customerId || null, // Store primary customer ID
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
    console.log('🎉 Google Ads OAuth completed successfully!');
    return Response.redirect(`${redirectUrl}?status=success`, 302);

  } catch (error: any) {
    console.error('❌ Unexpected error in Google Ads OAuth:', error);
    const appUrl = Deno.env.get('APP_URL') || 'https://id-preview--be7c1eba-2174-4e2e-a9f0-aa07602a3be7.lovable.app';
    return Response.redirect(`${appUrl}/app/integrations?status=error&message=unexpected_error`, 302);
  }
});