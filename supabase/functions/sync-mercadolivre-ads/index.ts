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

    // Get Mercado Livre integration
    const { data: integration, error: intError } = await supabase
      .from("integrations")
      .select("id, encrypted_access_token, marketplace_id")
      .eq("platform", "mercadolivre")
      .eq("user_id", user.id)
      .maybeSingle();

    if (intError || !integration) {
      return new Response(
        JSON.stringify({ error: "Integração com Mercado Livre não encontrada" }),
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

    // Get seller user ID from ML
    const meRes = await fetch("https://api.mercadolibre.com/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!meRes.ok) {
      const errText = await meRes.text();
      return new Response(
        JSON.stringify({ error: `Falha ao buscar dados do vendedor: ${errText}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const meData = await meRes.json();
    const sellerId = meData.id;

    // Fetch advertising campaigns
    const campaignsRes = await fetch(
      `https://api.mercadolibre.com/advertising/advertisers/AD-${sellerId}/campaigns?status=active,paused&limit=50`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    let campaigns: any[] = [];
    if (campaignsRes.ok) {
      const campaignsData = await campaignsRes.json();
      campaigns = campaignsData.results || campaignsData || [];
    }

    // For each campaign, fetch metrics
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const dateFrom = startDate.toISOString().split("T")[0];
    const dateTo = endDate.toISOString().split("T")[0];

    let totalSynced = 0;

    for (const campaign of campaigns) {
      try {
        const metricsRes = await fetch(
          `https://api.mercadolibre.com/advertising/advertisers/AD-${sellerId}/campaigns/${campaign.id}/metrics?date_from=${dateFrom}&date_to=${dateTo}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!metricsRes.ok) continue;

        const metricsData = await metricsRes.json();
        const dailyData = metricsData.results || metricsData.daily || [];

        // If we have aggregated data instead of daily
        if (dailyData.length === 0 && metricsData.impressions !== undefined) {
          const record = {
            user_id: user.id,
            organization_id: organizationId,
            integration_id: integration.id,
            platform: "mercadolivre_ads",
            campaign_id: String(campaign.id),
            campaign_name: campaign.name || campaign.title || `ML Campaign ${campaign.id}`,
            date: dateTo,
            spend: metricsData.cost || metricsData.spent || 0,
            impressions: metricsData.impressions || 0,
            clicks: metricsData.clicks || 0,
            conversions: metricsData.orders || metricsData.conversions || 0,
            conversion_value: metricsData.revenue || metricsData.conversion_value || 0,
            ctr: metricsData.ctr || 0,
            cpc: metricsData.cpc || 0,
          };

          await supabase.from("ad_metrics").upsert(record, {
            onConflict: "user_id,platform,campaign_id,date",
            ignoreDuplicates: false,
          });
          totalSynced++;
          continue;
        }

        // Process daily data
        for (const day of dailyData) {
          const record = {
            user_id: user.id,
            organization_id: organizationId,
            integration_id: integration.id,
            platform: "mercadolivre_ads",
            campaign_id: String(campaign.id),
            campaign_name: campaign.name || campaign.title || `ML Campaign ${campaign.id}`,
            date: day.date || dateTo,
            spend: day.cost || day.spent || 0,
            impressions: day.impressions || 0,
            clicks: day.clicks || 0,
            conversions: day.orders || day.conversions || 0,
            conversion_value: day.revenue || day.conversion_value || 0,
            ctr: day.ctr || 0,
            cpc: day.cpc || 0,
          };

          await supabase.from("ad_metrics").upsert(record, {
            onConflict: "user_id,platform,campaign_id,date",
            ignoreDuplicates: false,
          });
          totalSynced++;
        }
      } catch (e) {
        console.error(`Error processing ML campaign ${campaign.id}:`, e);
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
    console.error("Error in sync-mercadolivre-ads:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
