import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get organization_id
    const { data: orgMember } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();
    const organizationId = orgMember?.organization_id;

    // Get Shopee integration
    const { data: integration, error: intError } = await supabase
      .from("integrations")
      .select("id, encrypted_access_token, marketplace_id, shop_domain")
      .eq("platform", "shopee")
      .eq("user_id", user.id)
      .maybeSingle();

    if (intError || !integration) {
      return new Response(
        JSON.stringify({ error: "Integração com Shopee não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decrypt token
    const serviceRole = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: tokenData } = await serviceRole.rpc("decrypt_token", {
      encrypted_token: integration.encrypted_access_token,
    });
    const accessToken = tokenData as string;

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "Token de acesso inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { days = 30 } = await req.json().catch(() => ({ days: 30 }));
    const shopId = integration.marketplace_id || integration.shop_domain;

    // Shopee Ads API - Get campaign list
    const endTime = Math.floor(Date.now() / 1000);
    const startTime = endTime - days * 24 * 60 * 60;

    // Note: Shopee Ads API requires partner_id and sign for auth
    // Using access_token approach for authenticated requests
    const campaignListUrl = `https://partner.shopeemobile.com/api/v2/ads/get_campaign_list`;
    const campaignRes = await fetch(campaignListUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        shop_id: parseInt(shopId || "0"),
        offset: 0,
        page_size: 100,
      }),
    });

    let campaigns: any[] = [];
    if (campaignRes.ok) {
      const campaignData = await campaignRes.json();
      campaigns = campaignData.response?.campaign_list || campaignData.campaign_list || [];
    }

    let totalSynced = 0;

    // Get performance for each campaign
    for (const campaign of campaigns) {
      try {
        const perfUrl = `https://partner.shopeemobile.com/api/v2/ads/get_performance`;
        const perfRes = await fetch(perfUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            shop_id: parseInt(shopId || "0"),
            campaign_id: campaign.campaign_id,
            start_time: startTime,
            end_time: endTime,
            report_granularity: "daily",
          }),
        });

        if (!perfRes.ok) continue;

        const perfData = await perfRes.json();
        const dailyData = perfData.response?.daily_data || perfData.daily_data || [];

        if (dailyData.length === 0) {
          // Use aggregated data
          const total = perfData.response?.total || perfData.total || {};
          const record = {
            user_id: user.id,
            organization_id: organizationId,
            integration_id: integration.id,
            platform: "shopee_ads",
            campaign_id: String(campaign.campaign_id),
            campaign_name: campaign.campaign_name || `Shopee Campaign ${campaign.campaign_id}`,
            date: new Date().toISOString().split("T")[0],
            spend: (total.cost || 0) / 100000, // Shopee reports in micro-currency
            impressions: total.impression || 0,
            clicks: total.click || 0,
            conversions: total.order || total.conversion || 0,
            conversion_value: (total.gmv || total.conversion_value || 0) / 100000,
            ctr: total.ctr || 0,
            cpc: total.cpc ? total.cpc / 100000 : 0,
          };

          await supabase.from("ad_metrics").upsert(record, {
            onConflict: "user_id,platform,campaign_id,date",
            ignoreDuplicates: false,
          });
          totalSynced++;
          continue;
        }

        for (const day of dailyData) {
          const dateStr = day.date || new Date(day.timestamp * 1000).toISOString().split("T")[0];
          const record = {
            user_id: user.id,
            organization_id: organizationId,
            integration_id: integration.id,
            platform: "shopee_ads",
            campaign_id: String(campaign.campaign_id),
            campaign_name: campaign.campaign_name || `Shopee Campaign ${campaign.campaign_id}`,
            date: dateStr,
            spend: (day.cost || 0) / 100000,
            impressions: day.impression || 0,
            clicks: day.click || 0,
            conversions: day.order || day.conversion || 0,
            conversion_value: (day.gmv || day.conversion_value || 0) / 100000,
            ctr: day.ctr || 0,
            cpc: day.cpc ? day.cpc / 100000 : 0,
          };

          await supabase.from("ad_metrics").upsert(record, {
            onConflict: "user_id,platform,campaign_id,date",
            ignoreDuplicates: false,
          });
          totalSynced++;
        }
      } catch (e) {
        console.error(`Error processing Shopee campaign ${campaign.campaign_id}:`, e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        campaigns_found: campaigns.length,
        metrics_synced: totalSynced,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in sync-shopee-ads:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
