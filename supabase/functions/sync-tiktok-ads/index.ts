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

    console.log('🎵 Sync TikTok Ads started for user:', userId);

    // Get request body
    let body: { days?: number } = {};
    try {
      body = await req.json();
    } catch {
      // No body is fine
    }
    const daysToSync = body.days || 30;

    // Get user's organization
    const { data: orgId } = await supabase.rpc('get_user_org_id', { user_uuid: userId });

    // Get TikTok Ads integration
    let query = supabase
      .from('integrations')
      .select('id, encrypted_access_token, marketplace_id, account_name, organization_id, shop_domain')
      .eq('platform', 'tiktok_ads');

    if (orgId) {
      query = query.eq('organization_id', orgId);
    } else {
      query = query.eq('user_id', userId);
    }

    const { data: integrations, error: intError } = await query;

    if (intError || !integrations?.length) {
      console.error('❌ No TikTok Ads integration found:', intError);
      return new Response(JSON.stringify({ error: 'No TikTok Ads integration found' }), {
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

      const advertiserId = integration.marketplace_id;
      if (!advertiserId) {
        console.error('❌ No advertiser_id found for integration:', integration.id);
        results.push({
          integrationId: integration.id,
          accountName: integration.account_name || 'Unknown',
          campaignsProcessed: 0,
          error: 'No advertiser_id configured',
        });
        continue;
      }

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysToSync);

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      const tiktokBaseUrl = 'https://business-api.tiktok.com';

      console.log('📤 Fetching TikTok Ads report for advertiser:', advertiserId);

      // Fetch campaign report
      const reportUrl = new URL(`${tiktokBaseUrl}/open_api/v1.3/report/integrated/get/`);
      reportUrl.searchParams.set('advertiser_id', advertiserId);
      reportUrl.searchParams.set('report_type', 'BASIC');
      reportUrl.searchParams.set('data_level', 'AUCTION_CAMPAIGN');
      reportUrl.searchParams.set('dimensions', JSON.stringify(['campaign_id']));
      reportUrl.searchParams.set('metrics', JSON.stringify([
        'campaign_name', 'spend', 'impressions', 'clicks', 'conversion', 'complete_payment',
      ]));
      reportUrl.searchParams.set('start_date', startDateStr);
      reportUrl.searchParams.set('end_date', endDateStr);
      reportUrl.searchParams.set('page_size', '1000');

      const reportResponse = await fetch(reportUrl.toString(), {
        method: 'GET',
        headers: {
          'Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      });

      if (!reportResponse.ok) {
        const errorText = await reportResponse.text();
        console.error('❌ Failed to fetch TikTok report:', errorText);
        results.push({
          integrationId: integration.id,
          accountName: integration.account_name || 'Unknown',
          campaignsProcessed: 0,
          error: 'Failed to fetch report',
        });
        continue;
      }

      const reportData = await reportResponse.json();
      console.log('📦 Report response code:', reportData.code);

      if (reportData.code !== 0) {
        console.error('❌ TikTok API error:', reportData.message);
        results.push({
          integrationId: integration.id,
          accountName: integration.account_name || 'Unknown',
          campaignsProcessed: 0,
          error: reportData.message || 'API error',
        });
        continue;
      }

      const rows = reportData.data?.list || [];
      console.log('✅ Got', rows.length, 'campaign records');

      // Map to ad_metrics format
      const metricsToUpsert = rows.map((row: any) => {
        const dimensions = row.dimensions || {};
        const metrics = row.metrics || {};

        return {
          user_id: userId,
          organization_id: integration.organization_id || orgId,
          integration_id: integration.id,
          platform: 'tiktok_ads',
          campaign_id: dimensions.campaign_id || 'unknown',
          campaign_name: metrics.campaign_name || 'Unknown Campaign',
          ad_account_id: advertiserId,
          date: startDateStr, // TikTok aggregated report uses the start date
          spend: parseFloat(metrics.spend) || 0,
          impressions: parseInt(metrics.impressions, 10) || 0,
          clicks: parseInt(metrics.clicks, 10) || 0,
          conversions: parseInt(metrics.conversion, 10) || 0,
          conversion_value: parseFloat(metrics.complete_payment) || 0,
        };
      });

      if (metricsToUpsert.length > 0) {
        const chunkSize = 500;
        let totalProcessed = 0;

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
            totalProcessed += chunk.length;
          }
        }

        results.push({
          integrationId: integration.id,
          accountName: integration.account_name || 'Unknown',
          campaignsProcessed: totalProcessed,
        });
      } else {
        results.push({
          integrationId: integration.id,
          accountName: integration.account_name || 'Unknown',
          campaignsProcessed: 0,
        });
      }
    }

    console.log('🎉 TikTok Ads sync completed:', results);

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
    console.error('❌ Unexpected error in sync-tiktok-ads:', error);
    return new Response(JSON.stringify({ error: error.message || 'Unexpected error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
