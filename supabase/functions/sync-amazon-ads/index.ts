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

    // Get Amazon integration
    const { data: integration, error: intError } = await supabase
      .from("integrations")
      .select("id, encrypted_access_token, encrypted_refresh_token, selling_partner_id, marketplace_id")
      .eq("platform", "amazon")
      .eq("user_id", user.id)
      .maybeSingle();

    if (intError || !integration) {
      return new Response(
        JSON.stringify({ error: "Integração com Amazon não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decrypt tokens
    const serviceRole = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: accessTokenData } = await serviceRole.rpc("decrypt_token", {
      encrypted_token: integration.encrypted_access_token,
    });

    let refreshToken: string | null = null;
    if (integration.encrypted_refresh_token) {
      const { data: refreshData } = await serviceRole.rpc("decrypt_token", {
        encrypted_token: integration.encrypted_refresh_token,
      });
      refreshToken = refreshData as string;
    }

    const accessToken = accessTokenData as string;
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "Token de acesso inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { days = 30 } = await req.json().catch(() => ({ days: 30 }));

    // Amazon Advertising API - Refresh access token if needed
    const clientId = Deno.env.get("AMAZON_CLIENT_ID") || "";
    const clientSecret = Deno.env.get("AMAZON_CLIENT_SECRET") || "";
    const region = Deno.env.get("AMAZON_REGION") || "NA";

    // Determine advertising API endpoint based on region
    const adApiEndpoints: Record<string, string> = {
      NA: "https://advertising-api.amazon.com",
      EU: "https://advertising-api-eu.amazon.com",
      FE: "https://advertising-api-fe.amazon.com",
    };
    const adApiBase = adApiEndpoints[region] || adApiEndpoints.NA;

    // Get advertising profiles
    const profilesRes = await fetch(`${adApiBase}/v2/profiles`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Amazon-Advertising-API-ClientId": clientId,
        "Content-Type": "application/json",
      },
    });

    let profiles: any[] = [];
    if (profilesRes.ok) {
      profiles = await profilesRes.json();
    } else {
      const errText = await profilesRes.text();
      console.error("Failed to get Amazon ad profiles:", errText);
    }

    let totalSynced = 0;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    for (const profile of profiles) {
      const profileId = profile.profileId;

      try {
        // Get Sponsored Products campaigns
        const campaignsRes = await fetch(`${adApiBase}/sp/campaigns/list`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Amazon-Advertising-API-ClientId": clientId,
            "Amazon-Advertising-API-Scope": String(profileId),
            "Content-Type": "application/vnd.spCampaign.v3+json",
            Accept: "application/vnd.spCampaign.v3+json",
          },
          body: JSON.stringify({
            maxResults: 100,
          }),
        });

        if (!campaignsRes.ok) continue;

        const campaignsData = await campaignsRes.json();
        const campaigns = campaignsData.campaigns || [];

        // Request campaign performance report
        const reportRes = await fetch(`${adApiBase}/reporting/reports`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Amazon-Advertising-API-ClientId": clientId,
            "Amazon-Advertising-API-Scope": String(profileId),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reportDate: endDate.toISOString().split("T")[0],
            configuration: {
              adProduct: "SPONSORED_PRODUCTS",
              groupBy: ["campaign"],
              columns: ["campaignName", "campaignId", "impressions", "clicks", "cost", "purchases7d", "sales7d"],
              reportTypeId: "spCampaigns",
              timeUnit: "SUMMARY",
              format: "GZIP_JSON",
            },
            startDate: startDate.toISOString().split("T")[0],
            endDate: endDate.toISOString().split("T")[0],
          }),
        });

        if (reportRes.ok) {
          const reportData = await reportRes.json();
          // Amazon reports are async, need to poll
          // For now, save what we can from campaign data
          for (const campaign of campaigns) {
            const record = {
              user_id: user.id,
              organization_id: organizationId,
              integration_id: integration.id,
              platform: "amazon_ads",
              campaign_id: String(campaign.campaignId),
              campaign_name: campaign.name || `Amazon Campaign ${campaign.campaignId}`,
              date: endDate.toISOString().split("T")[0],
              spend: campaign.budget?.budget || 0,
              impressions: 0,
              clicks: 0,
              conversions: 0,
              conversion_value: 0,
              ctr: 0,
              cpc: 0,
            };

            await supabase.from("ad_metrics").upsert(record, {
              onConflict: "user_id,platform,campaign_id,date",
              ignoreDuplicates: false,
            });
            totalSynced++;
          }
        }
      } catch (e) {
        console.error(`Error processing Amazon profile ${profileId}:`, e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        profiles_found: profiles.length,
        metrics_synced: totalSynced,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in sync-amazon-ads:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
