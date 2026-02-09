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
    // Validate JWT manually
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const developerToken = Deno.env.get('GOOGLE_ADS_DEVELOPER_TOKEN');

    if (!developerToken) {
      return new Response(JSON.stringify({ error: 'Google Ads Developer Token not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify JWT
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const userId = user.id;

    console.log('🟢 Sync Google Ads started for user:', userId);

    // Get request body for optional parameters
    let body: { days?: number; integrationId?: string } = {};
    try {
      body = await req.json();
    } catch {
      // No body is fine
    }
    const daysToSync = body.days || 30;
    const specificIntegrationId = body.integrationId;

    // Get user's organization
    const { data: orgId } = await supabase.rpc('get_user_org_id', { user_uuid: userId });

    // Get Google Ads integration(s)
    let query = supabase
      .from('integrations')
      .select('id, encrypted_access_token, marketplace_id, account_name, organization_id')
      .eq('platform', 'google_ads');

    if (specificIntegrationId) {
      query = query.eq('id', specificIntegrationId);
    } else if (orgId) {
      query = query.eq('organization_id', orgId);
    } else {
      query = query.eq('user_id', userId);
    }

    const { data: integrations, error: intError } = await query;

    if (intError || !integrations?.length) {
      console.error('❌ No Google Ads integration found:', intError);
      return new Response(JSON.stringify({ error: 'No Google Ads integration found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: Array<{ integrationId: string; accountName: string; campaignsProcessed: number; error?: string }> = [];

    for (const integration of integrations) {
      console.log('📊 Processing integration:', integration.id, integration.account_name);

      // Decrypt the access token
      const { data: accessToken, error: decryptError } = await supabase.rpc('decrypt_token', {
        encrypted_token: integration.encrypted_access_token,
      });

      if (decryptError || !accessToken) {
        console.error('❌ Failed to decrypt token:', decryptError);
        results.push({
          integrationId: integration.id,
          accountName: integration.account_name || 'Unknown',
          campaignsProcessed: 0,
          error: 'Failed to decrypt token',
        });
        continue;
      }

      // Get customer ID - either from stored marketplace_id or list accessible customers
      let customerId = integration.marketplace_id;

      if (!customerId) {
        console.log('📤 No stored customer ID, fetching accessible customers...');
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
            if (resourceNames.length > 0) {
              customerId = resourceNames[0].replace('customers/', '');
              console.log('✅ Found customer ID:', customerId);

              // Save it for future use
              await supabase
                .from('integrations')
                .update({ marketplace_id: customerId })
                .eq('id', integration.id);
            }
          }
        } catch (err) {
          console.error('❌ Error fetching accessible customers:', err);
        }
      }

      if (!customerId) {
        console.error('❌ No Google Ads customer ID available');
        results.push({
          integrationId: integration.id,
          accountName: integration.account_name || 'Unknown',
          campaignsProcessed: 0,
          error: 'No Google Ads customer ID available',
        });
        continue;
      }

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysToSync);

      const startDateStr = startDate.toISOString().split('T')[0].replace(/-/g, '');
      const endDateStr = endDate.toISOString().split('T')[0].replace(/-/g, '');

      // Use Google Ads API to fetch campaign performance
      console.log('📤 Fetching campaign metrics from Google Ads...');

      const gaqlQuery = `
        SELECT
          campaign.id,
          campaign.name,
          campaign.status,
          metrics.cost_micros,
          metrics.impressions,
          metrics.clicks,
          metrics.conversions,
          metrics.conversions_value,
          segments.date
        FROM campaign
        WHERE segments.date BETWEEN '${startDate.toISOString().split('T')[0]}' AND '${endDate.toISOString().split('T')[0]}'
        AND campaign.status != 'REMOVED'
        ORDER BY segments.date DESC
      `;

      const searchResponse = await fetch(
        `https://googleads.googleapis.com/v18/customers/${customerId}/googleAds:searchStream`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'developer-token': developerToken,
            'Content-Type': 'application/json',
            'login-customer-id': customerId,
          },
          body: JSON.stringify({ query: gaqlQuery }),
        }
      );

      if (!searchResponse.ok) {
        const errorText = await searchResponse.text();
        console.error('❌ Google Ads API error:', errorText);

        // Check if token is expired
        if (searchResponse.status === 401) {
          results.push({
            integrationId: integration.id,
            accountName: integration.account_name || 'Unknown',
            campaignsProcessed: 0,
            error: 'Token expired - needs refresh',
          });
        } else {
          results.push({
            integrationId: integration.id,
            accountName: integration.account_name || 'Unknown',
            campaignsProcessed: 0,
            error: `API error: ${searchResponse.status}`,
          });
        }
        continue;
      }

      const responseData = await searchResponse.json();
      let totalCampaignsProcessed = 0;

      // Process all batches in the stream response
      const allResults = Array.isArray(responseData) ? responseData : [responseData];

      for (const batch of allResults) {
        const rows = batch.results || [];
        console.log('✅ Got', rows.length, 'campaign metric rows');

        const metricsToUpsert = rows.map((row: any) => {
          const campaign = row.campaign || {};
          const metrics = row.metrics || {};
          const segments = row.segments || {};

          // cost_micros is in micros (1/1,000,000 of the currency unit)
          const spend = (parseInt(metrics.costMicros || '0', 10) || 0) / 1_000_000;
          const impressions = parseInt(metrics.impressions || '0', 10) || 0;
          const clicks = parseInt(metrics.clicks || '0', 10) || 0;
          const conversions = parseFloat(metrics.conversions || '0') || 0;
          const conversionValue = parseFloat(metrics.conversionsValue || '0') || 0;

          return {
            user_id: userId,
            organization_id: integration.organization_id || orgId,
            integration_id: integration.id,
            platform: 'google_ads',
            campaign_id: String(campaign.id || ''),
            campaign_name: campaign.name || 'Unknown Campaign',
            ad_account_id: customerId,
            date: segments.date || new Date().toISOString().split('T')[0],
            spend,
            impressions,
            clicks,
            conversions: Math.round(conversions),
            conversion_value: conversionValue,
            reach: 0, // Google Ads doesn't have a reach metric like Meta
          };
        });

        if (metricsToUpsert.length > 0) {
          // Batch upsert in chunks of 500
          const chunkSize = 500;
          for (let i = 0; i < metricsToUpsert.length; i += chunkSize) {
            const chunk = metricsToUpsert.slice(i, i + chunkSize);

            const { error: upsertError } = await supabase
              .from('ad_metrics')
              .upsert(chunk, {
                onConflict: 'integration_id,campaign_id,date',
                ignoreDuplicates: false,
              });

            if (upsertError) {
              console.error('❌ Failed to upsert metrics chunk:', upsertError);
            } else {
              totalCampaignsProcessed += chunk.length;
            }
          }
        }
      }

      results.push({
        integrationId: integration.id,
        accountName: integration.account_name || 'Unknown',
        campaignsProcessed: totalCampaignsProcessed,
      });
    }

    console.log('🎉 Google Ads sync completed:', results);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Sync completed',
        results,
        syncedAt: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('❌ Unexpected error in sync-google-ads:', error);
    return new Response(JSON.stringify({ error: error.message || 'Unexpected error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});