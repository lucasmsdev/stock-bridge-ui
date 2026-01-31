import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MetaInsight {
  campaign_id: string;
  campaign_name: string;
  spend: string;
  impressions: string;
  clicks: string;
  reach?: string;
  actions?: Array<{
    action_type: string;
    value: string;
  }>;
  date_start: string;
  date_stop: string;
}

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

    console.log('🔵 Sync Meta Ads started for user:', userId);

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

    // Get Meta Ads integration(s)
    let query = supabase
      .from('integrations')
      .select('id, encrypted_access_token, marketplace_id, account_name, organization_id')
      .eq('platform', 'meta_ads');

    if (specificIntegrationId) {
      query = query.eq('id', specificIntegrationId);
    } else if (orgId) {
      query = query.eq('organization_id', orgId);
    } else {
      query = query.eq('user_id', userId);
    }

    const { data: integrations, error: intError } = await query;

    if (intError || !integrations?.length) {
      console.error('❌ No Meta Ads integration found:', intError);
      return new Response(JSON.stringify({ error: 'No Meta Ads integration found' }), {
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

      // First, get all ad accounts for this token
      const adAccountsUrl = `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_id,account_status&access_token=${accessToken}`;
      const adAccountsResponse = await fetch(adAccountsUrl);

      if (!adAccountsResponse.ok) {
        const errorText = await adAccountsResponse.text();
        console.error('❌ Failed to fetch ad accounts:', errorText);
        results.push({
          integrationId: integration.id,
          accountName: integration.account_name || 'Unknown',
          campaignsProcessed: 0,
          error: 'Failed to fetch ad accounts',
        });
        continue;
      }

      const adAccountsData = await adAccountsResponse.json();
      const adAccounts = adAccountsData.data || [];
      console.log('✅ Found', adAccounts.length, 'ad accounts');

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysToSync);

      const timeRange = JSON.stringify({
        since: startDate.toISOString().split('T')[0],
        until: endDate.toISOString().split('T')[0],
      });

      let totalCampaignsProcessed = 0;

      // Fetch insights for each ad account
      for (const adAccount of adAccounts) {
        // Skip inactive accounts (account_status !== 1 means not active)
        if (adAccount.account_status !== 1) {
          console.log('⏭️ Skipping inactive account:', adAccount.name);
          continue;
        }

        const accountId = adAccount.id; // This includes "act_" prefix

        console.log('📤 Fetching insights for account:', adAccount.name, accountId);

        const insightsUrl = new URL(`https://graph.facebook.com/v21.0/${accountId}/insights`);
        insightsUrl.searchParams.set('fields', 'campaign_id,campaign_name,spend,impressions,clicks,reach,actions');
        insightsUrl.searchParams.set('time_range', timeRange);
        insightsUrl.searchParams.set('level', 'campaign');
        insightsUrl.searchParams.set('time_increment', '1'); // Daily breakdown
        insightsUrl.searchParams.set('access_token', accessToken);

        const insightsResponse = await fetch(insightsUrl.toString());

        if (!insightsResponse.ok) {
          const errorText = await insightsResponse.text();
          console.error('❌ Failed to fetch insights for', accountId, ':', errorText);
          continue;
        }

        const insightsData = await insightsResponse.json();
        const insights: MetaInsight[] = insightsData.data || [];
        console.log('✅ Got', insights.length, 'insight records for', adAccount.name);

        // Process and upsert metrics
        const metricsToUpsert = insights.map((insight) => {
          // Extract conversions from actions
          let conversions = 0;
          let conversionValue = 0;

          if (insight.actions) {
            for (const action of insight.actions) {
              // Count various conversion types
              if (
                action.action_type === 'purchase' ||
                action.action_type === 'lead' ||
                action.action_type === 'complete_registration' ||
                action.action_type === 'add_to_cart' ||
                action.action_type === 'omni_purchase'
              ) {
                conversions += parseInt(action.value, 10) || 0;
              }
            }
          }

          return {
            user_id: userId,
            organization_id: integration.organization_id || orgId,
            integration_id: integration.id,
            platform: 'meta_ads',
            campaign_id: insight.campaign_id,
            campaign_name: insight.campaign_name,
            ad_account_id: adAccount.account_id,
            date: insight.date_start,
            spend: parseFloat(insight.spend) || 0,
            impressions: parseInt(insight.impressions, 10) || 0,
            clicks: parseInt(insight.clicks, 10) || 0,
            conversions,
            conversion_value: conversionValue,
            reach: parseInt(insight.reach || '0', 10) || 0,
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

    console.log('🎉 Sync completed:', results);

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
    console.error('❌ Unexpected error in sync-meta-ads:', error);
    return new Response(JSON.stringify({ error: error.message || 'Unexpected error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
