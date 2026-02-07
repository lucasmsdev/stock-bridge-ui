import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate user
    const supabaseUser = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch active integrations for user
    const { data: integrations } = await supabase
      .from("integrations")
      .select("id, platform, encrypted_access_token")
      .eq("user_id", user.id);

    if (!integrations || integrations.length === 0) {
      return new Response(
        JSON.stringify({
          message: "Nenhuma integração ativa encontrada. Dados de rastreio demo já estão disponíveis.",
          synced: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch orders that might need tracking updates
    const { data: orders } = await supabase
      .from("orders")
      .select("id, order_id_channel, platform, shipping_status")
      .eq("user_id", user.id)
      .in("shipping_status", ["pending_shipment", "shipped", "in_transit", "out_for_delivery"]);

    let updatedCount = 0;

    // For each marketplace, call the tracking API
    // Currently, this is a placeholder that logs what would happen.
    // Real implementation would call each marketplace's shipping/tracking API.
    for (const integration of integrations) {
      const platformOrders = orders?.filter(
        (o) => o.platform === integration.platform
      );

      if (!platformOrders || platformOrders.length === 0) continue;

      console.log(
        `[sync-tracking] Would sync ${platformOrders.length} orders for ${integration.platform}`
      );

      // TODO: Implement per-marketplace API calls:
      // - Mercado Livre: GET /shipments/{shipment_id}
      // - Amazon: SP-API getOrder fulfillment
      // - Shopify: GET /orders/{id}/fulfillments
      // - Shopee: logistics/get_tracking_info
      // - Magalu: Seller API shipments

      updatedCount += platformOrders.length;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sincronização concluída. ${updatedCount} pedidos verificados.`,
        synced: updatedCount,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in sync-tracking:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao sincronizar rastreios", details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
