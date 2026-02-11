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

    const { data: orgMember } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();
    const organizationId = orgMember?.organization_id;

    const { data: integration, error: intError } = await supabase
      .from("integrations")
      .select("id, encrypted_access_token, selling_partner_id, shop_domain")
      .eq("platform", "tiktok_shop")
      .eq("user_id", user.id)
      .maybeSingle();

    if (intError || !integration) {
      return new Response(
        JSON.stringify({ error: "Integração com TikTok Shop não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
    const appKey = Deno.env.get("TIKTOK_SHOP_APP_KEY") || "";
    const shopCipher = integration.selling_partner_id || "";

    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    let totalSynced = 0;

    try {
      // TikTok Shop Ads - Product Boost / Promoted Listings API
      const adsRes = await fetch(
        `https://open-api.tiktokglobalshop.com/api/ads/campaigns?app_key=${appKey}&shop_cipher=${shopCipher}&start_date=${startDate}&end_date=${endDate}`,
        {
          headers: {
            "x-tts-access-token": accessToken,
            "Content-Type": "application/json",
          },
        }
      );

      if (adsRes.ok) {
        const adsData = await adsRes.json();
        const campaigns = adsData.data?.campaigns || adsData.campaigns || [];

        for (const campaign of campaigns) {
          const record = {
            user_id: user.id,
            organization_id: organizationId,
            integration_id: integration.id,
            platform: "tiktokshop_ads",
            campaign_id: String(campaign.campaign_id || campaign.id),
            campaign_name: campaign.campaign_name || campaign.name || `TT Shop Campaign ${campaign.campaign_id}`,
            date: endDate,
            spend: campaign.spend || campaign.cost || 0,
            impressions: campaign.impressions || 0,
            clicks: campaign.clicks || 0,
            conversions: campaign.conversions || campaign.orders || 0,
            conversion_value: campaign.revenue || campaign.gmv || 0,
            ctr: campaign.ctr || 0,
            cpc: campaign.cpc || 0,
          };

          await supabase.from("ad_metrics").upsert(record, {
            onConflict: "user_id,platform,campaign_id,date",
            ignoreDuplicates: false,
          });
          totalSynced++;
        }
      }
    } catch (e) {
      console.error("Error fetching TikTok Shop ads:", e);
    }

    return new Response(
      JSON.stringify({ success: true, metrics_synced: totalSynced }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in sync-tiktokshop-ads:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
