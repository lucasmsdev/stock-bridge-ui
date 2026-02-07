import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ─── Status Mapping ───────────────────────────────────────────────

function mapMercadoLivreStatus(mlStatus: string): string | null {
  const map: Record<string, string> = {
    pending: "pending_shipment",
    handling: "pending_shipment",
    ready_to_ship: "pending_shipment",
    shipped: "in_transit",
    delivered: "delivered",
    not_delivered: "returned",
  };
  return map[mlStatus] || null;
}

function mapShopifyStatus(shipmentStatus: string | null): string {
  if (!shipmentStatus) return "pending_shipment";
  const map: Record<string, string> = {
    confirmed: "shipped",
    in_transit: "in_transit",
    out_for_delivery: "out_for_delivery",
    attempted_delivery: "out_for_delivery",
    delivered: "delivered",
    failure: "returned",
  };
  return map[shipmentStatus] || "shipped";
}

function mapAmazonStatus(orderStatus: string, fulfillmentChannel: string): string | null {
  if (orderStatus === "Canceled") return null;
  const map: Record<string, string> = {
    Pending: "pending_shipment",
    Unshipped: "pending_shipment",
    PartiallyShipped: "shipped",
    Shipped: fulfillmentChannel === "AFN" ? "in_transit" : "shipped",
  };
  return map[orderStatus] || null;
}

// ─── History Helpers ──────────────────────────────────────────────

function mergeHistory(existing: any[], newEvents: any[]): any[] {
  const existingKeys = new Set(
    existing.map((e) => `${e.date}|${e.status}|${e.description}`)
  );
  const merged = [...existing];
  for (const event of newEvents) {
    const key = `${event.date}|${event.status}|${event.description}`;
    if (!existingKeys.has(key)) {
      merged.push(event);
      existingKeys.add(key);
    }
  }
  return merged.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

// ─── Token Decryption ─────────────────────────────────────────────

async function decryptToken(
  supabase: any,
  encryptedToken: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc("decrypt_token", {
      encrypted_token: encryptedToken,
    });
    if (error) {
      console.error("Token decryption error:", error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error("Token decryption exception:", err);
    return null;
  }
}

// ─── Mercado Livre Provider ───────────────────────────────────────

async function syncMercadoLivreTracking(
  orders: any[],
  accessToken: string,
  supabase: any
): Promise<{ updated: number; errors: string[] }> {
  let updated = 0;
  const errors: string[] = [];

  for (const order of orders) {
    try {
      // Step 1: Get shipments for the order
      const shipmentsRes = await fetch(
        `https://api.mercadolibre.com/orders/${order.order_id_channel}/shipments`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "X-Format-New": "true",
          },
        }
      );

      if (!shipmentsRes.ok) {
        const errBody = await shipmentsRes.text();
        console.error(
          `[ML] Failed to get shipments for order ${order.order_id_channel}: ${shipmentsRes.status} - ${errBody}`
        );
        errors.push(`ML order ${order.order_id_channel}: ${shipmentsRes.status}`);
        continue;
      }

      const shipmentsData = await shipmentsRes.json();

      // The response may be an object with results array or a single shipment
      const shipments = shipmentsData?.results || (shipmentsData?.id ? [shipmentsData] : []);
      if (shipments.length === 0) continue;

      const shipment = shipments[0];
      const shipmentId = shipment.id;

      // Step 2: Get shipment details
      const detailRes = await fetch(
        `https://api.mercadolibre.com/shipments/${shipmentId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "X-Format-New": "true",
          },
        }
      );

      if (!detailRes.ok) {
        console.error(
          `[ML] Failed to get shipment detail ${shipmentId}: ${detailRes.status}`
        );
        errors.push(`ML shipment ${shipmentId}: ${detailRes.status}`);
        continue;
      }

      const detail = detailRes.json ? await detailRes.json() : null;
      if (!detail) continue;

      const mlStatus = detail.status;
      const mappedStatus = mapMercadoLivreStatus(mlStatus);
      if (!mappedStatus) continue;

      // Skip if already delivered and we have it as delivered
      if (order.shipping_status === "delivered" && mappedStatus === "delivered") continue;

      const trackingNumber =
        detail.tracking_number || detail.tracking_method?.tracking_number || null;
      const trackingUrl =
        detail.tracking_url || detail.tracking_method?.tracking_url || null;
      const carrier =
        detail.logistic_type ||
        detail.tracking_method?.name ||
        detail.shipping_option?.name ||
        null;

      // Build history events
      const newEvents: any[] = [];
      if (detail.status_history) {
        for (const [histStatus, histDate] of Object.entries(
          detail.status_history
        )) {
          if (histDate && typeof histDate === "string") {
            const mapped = mapMercadoLivreStatus(histStatus);
            if (mapped) {
              newEvents.push({
                date: histDate,
                status: mapped,
                description: `${histStatus} - Mercado Livre`,
                location: "",
              });
            }
          }
        }
      }

      // If no history from status_history, create single event
      if (newEvents.length === 0) {
        newEvents.push({
          date: detail.last_updated || new Date().toISOString(),
          status: mappedStatus,
          description: `Status: ${mlStatus}`,
          location: "",
        });
      }

      const existingHistory = Array.isArray(order.shipping_history)
        ? order.shipping_history
        : [];
      const mergedHistory = mergeHistory(existingHistory, newEvents);

      const { error: updateErr } = await supabase
        .from("orders")
        .update({
          shipping_status: mappedStatus,
          tracking_code: trackingNumber || order.tracking_code,
          tracking_url: trackingUrl || order.tracking_url,
          carrier: carrier || order.carrier,
          shipping_history: mergedHistory,
          shipping_updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);

      if (updateErr) {
        console.error(`[ML] DB update error for order ${order.id}:`, updateErr);
        errors.push(`ML DB update ${order.id}: ${updateErr.message}`);
      } else {
        updated++;
      }
    } catch (err) {
      console.error(`[ML] Exception for order ${order.order_id_channel}:`, err);
      errors.push(`ML exception ${order.order_id_channel}: ${err.message}`);
    }
  }

  return { updated, errors };
}

// ─── Shopify Provider ─────────────────────────────────────────────

async function syncShopifyTracking(
  orders: any[],
  accessToken: string,
  shopDomain: string,
  supabase: any
): Promise<{ updated: number; errors: string[] }> {
  let updated = 0;
  const errors: string[] = [];

  if (!shopDomain) {
    errors.push("Shopify: shop_domain not found");
    return { updated, errors };
  }

  const apiVersion = "2024-01";

  for (const order of orders) {
    try {
      const fulfillmentsRes = await fetch(
        `https://${shopDomain}/admin/api/${apiVersion}/orders/${order.order_id_channel}/fulfillments.json`,
        {
          headers: {
            "X-Shopify-Access-Token": accessToken,
            "Content-Type": "application/json",
          },
        }
      );

      if (!fulfillmentsRes.ok) {
        const errBody = await fulfillmentsRes.text();
        console.error(
          `[Shopify] Failed for order ${order.order_id_channel}: ${fulfillmentsRes.status} - ${errBody}`
        );
        errors.push(`Shopify order ${order.order_id_channel}: ${fulfillmentsRes.status}`);
        continue;
      }

      const data = await fulfillmentsRes.json();
      const fulfillments = data?.fulfillments || [];

      if (fulfillments.length === 0) {
        // No fulfillment = pending_shipment
        if (order.shipping_status !== "pending_shipment") {
          await supabase
            .from("orders")
            .update({
              shipping_status: "pending_shipment",
              shipping_updated_at: new Date().toISOString(),
            })
            .eq("id", order.id);
          updated++;
        }
        continue;
      }

      // Use the most recent fulfillment
      const fulfillment = fulfillments[fulfillments.length - 1];

      const trackingNumber = fulfillment.tracking_number || null;
      const trackingUrl = fulfillment.tracking_url || null;
      const carrier = fulfillment.tracking_company || null;
      const shipmentStatus = fulfillment.shipment_status || null;
      const mappedStatus = mapShopifyStatus(shipmentStatus);

      // Skip if already same status
      if (
        order.shipping_status === mappedStatus &&
        order.tracking_code === trackingNumber
      )
        continue;

      // Build history from fulfillment events
      const newEvents: any[] = [];
      if (fulfillment.tracking_numbers && fulfillment.tracking_urls) {
        newEvents.push({
          date: fulfillment.updated_at || fulfillment.created_at || new Date().toISOString(),
          status: mappedStatus,
          description: `${shipmentStatus || "fulfilled"} - ${carrier || "Shopify"}`,
          location: "",
        });
      } else {
        newEvents.push({
          date: fulfillment.updated_at || new Date().toISOString(),
          status: mappedStatus,
          description: `Fulfillment: ${shipmentStatus || "created"}`,
          location: "",
        });
      }

      const existingHistory = Array.isArray(order.shipping_history)
        ? order.shipping_history
        : [];
      const mergedHistory = mergeHistory(existingHistory, newEvents);

      const { error: updateErr } = await supabase
        .from("orders")
        .update({
          shipping_status: mappedStatus,
          tracking_code: trackingNumber || order.tracking_code,
          tracking_url: trackingUrl || order.tracking_url,
          carrier: carrier || order.carrier,
          shipping_history: mergedHistory,
          shipping_updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);

      if (updateErr) {
        console.error(`[Shopify] DB update error for order ${order.id}:`, updateErr);
        errors.push(`Shopify DB update ${order.id}: ${updateErr.message}`);
      } else {
        updated++;
      }
    } catch (err) {
      console.error(`[Shopify] Exception for order ${order.order_id_channel}:`, err);
      errors.push(`Shopify exception ${order.order_id_channel}: ${err.message}`);
    }
  }

  return { updated, errors };
}

// ─── Amazon Provider ──────────────────────────────────────────────

async function syncAmazonTracking(
  orders: any[],
  accessToken: string,
  supabase: any
): Promise<{ updated: number; errors: string[] }> {
  let updated = 0;
  const errors: string[] = [];

  const marketplaceId = Deno.env.get("AMAZON_MARKETPLACE_ID") || "ATVPDKIKX0DER";
  const region = Deno.env.get("AMAZON_REGION") || "us-east-1";

  // Determine endpoint based on region
  let spApiEndpoint = "https://sellingpartnerapi-na.amazon.com";
  if (region.startsWith("eu-")) {
    spApiEndpoint = "https://sellingpartnerapi-eu.amazon.com";
  } else if (region.startsWith("us-")) {
    spApiEndpoint = "https://sellingpartnerapi-na.amazon.com";
  } else if (region.startsWith("ap-") || region === "fe-east-1") {
    spApiEndpoint = "https://sellingpartnerapi-fe.amazon.com";
  }

  for (const order of orders) {
    try {
      const orderRes = await fetch(
        `${spApiEndpoint}/orders/v0/orders/${order.order_id_channel}`,
        {
          headers: {
            "x-amz-access-token": accessToken,
            "x-amz-date": new Date().toISOString().replace(/[:-]|\.\d{3}/g, ""),
            "Content-Type": "application/json",
          },
        }
      );

      if (!orderRes.ok) {
        const errBody = await orderRes.text();
        console.error(
          `[Amazon] Failed for order ${order.order_id_channel}: ${orderRes.status} - ${errBody}`
        );
        errors.push(`Amazon order ${order.order_id_channel}: ${orderRes.status}`);
        continue;
      }

      const data = await orderRes.json();
      const amazonOrder = data?.payload;
      if (!amazonOrder) continue;

      const orderStatus = amazonOrder.OrderStatus;
      const fulfillmentChannel = amazonOrder.FulfillmentChannel || "MFN";

      const mappedStatus = mapAmazonStatus(orderStatus, fulfillmentChannel);
      if (!mappedStatus) continue;

      // Skip if same status
      if (order.shipping_status === mappedStatus) continue;

      const newEvents: any[] = [
        {
          date: amazonOrder.LastUpdateDate || new Date().toISOString(),
          status: mappedStatus,
          description: `Amazon ${fulfillmentChannel === "AFN" ? "FBA" : "FBM"}: ${orderStatus}`,
          location: "",
        },
      ];

      const existingHistory = Array.isArray(order.shipping_history)
        ? order.shipping_history
        : [];
      const mergedHistory = mergeHistory(existingHistory, newEvents);

      const { error: updateErr } = await supabase
        .from("orders")
        .update({
          shipping_status: mappedStatus,
          shipping_history: mergedHistory,
          shipping_updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);

      if (updateErr) {
        console.error(`[Amazon] DB update error for order ${order.id}:`, updateErr);
        errors.push(`Amazon DB update ${order.id}: ${updateErr.message}`);
      } else {
        updated++;
      }
    } catch (err) {
      console.error(`[Amazon] Exception for order ${order.order_id_channel}:`, err);
      errors.push(`Amazon exception ${order.order_id_channel}: ${err.message}`);
    }
  }

  return { updated, errors };
}

// ─── Main Handler ─────────────────────────────────────────────────

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

    // Fetch active integrations (ML, Shopify, Amazon)
    const { data: integrations } = await supabase
      .from("integrations")
      .select("id, platform, encrypted_access_token, shop_domain")
      .eq("user_id", user.id)
      .in("platform", ["mercadolivre", "shopify", "amazon"]);

    if (!integrations || integrations.length === 0) {
      return new Response(
        JSON.stringify({
          message: "Nenhuma integração ativa encontrada para rastreio.",
          synced: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch orders needing tracking updates
    // Include: orders with active shipping status OR orders with status shipped/processing but no shipping_status
    const { data: ordersWithStatus } = await supabase
      .from("orders")
      .select(
        "id, order_id_channel, platform, shipping_status, tracking_code, tracking_url, carrier, shipping_history"
      )
      .eq("user_id", user.id)
      .in("shipping_status", [
        "pending_shipment",
        "shipped",
        "in_transit",
        "out_for_delivery",
      ]);

    const { data: ordersWithoutStatus } = await supabase
      .from("orders")
      .select(
        "id, order_id_channel, platform, shipping_status, tracking_code, tracking_url, carrier, shipping_history"
      )
      .eq("user_id", user.id)
      .is("shipping_status", null)
      .in("status", ["shipped", "processing", "paid"]);

    // Combine and deduplicate
    const allOrdersMap = new Map<string, any>();
    for (const o of ordersWithStatus || []) allOrdersMap.set(o.id, o);
    for (const o of ordersWithoutStatus || []) {
      if (!allOrdersMap.has(o.id)) {
        // Set default shipping_status for orders without one
        o.shipping_status = "pending_shipment";
        allOrdersMap.set(o.id, o);
      }
    }
    const allOrders = Array.from(allOrdersMap.values());

    if (allOrders.length === 0) {
      return new Response(
        JSON.stringify({
          message: "Nenhum pedido pendente de atualização de rastreio.",
          synced: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(
      `[sync-tracking] Found ${allOrders.length} orders to check across ${integrations.length} integrations`
    );

    const results: Record<
      string,
      { checked: number; updated: number; errors: string[] }
    > = {};

    for (const integration of integrations) {
      const platformOrders = allOrders.filter(
        (o) => o.platform === integration.platform
      );
      if (platformOrders.length === 0) continue;

      // Decrypt token
      const accessToken = await decryptToken(
        supabase,
        integration.encrypted_access_token
      );
      if (!accessToken) {
        console.error(
          `[sync-tracking] Failed to decrypt token for ${integration.platform}`
        );
        results[integration.platform] = {
          checked: platformOrders.length,
          updated: 0,
          errors: ["Token decryption failed"],
        };
        continue;
      }

      console.log(
        `[sync-tracking] Syncing ${platformOrders.length} orders for ${integration.platform}`
      );

      let syncResult: { updated: number; errors: string[] };

      switch (integration.platform) {
        case "mercadolivre":
          syncResult = await syncMercadoLivreTracking(
            platformOrders,
            accessToken,
            supabase
          );
          break;

        case "shopify":
          syncResult = await syncShopifyTracking(
            platformOrders,
            accessToken,
            integration.shop_domain || "",
            supabase
          );
          break;

        case "amazon":
          syncResult = await syncAmazonTracking(
            platformOrders,
            accessToken,
            supabase
          );
          break;

        default:
          syncResult = { updated: 0, errors: [`Unsupported platform: ${integration.platform}`] };
      }

      results[integration.platform] = {
        checked: platformOrders.length,
        updated: syncResult.updated,
        errors: syncResult.errors,
      };
    }

    const totalChecked = Object.values(results).reduce(
      (sum, r) => sum + r.checked,
      0
    );
    const totalUpdated = Object.values(results).reduce(
      (sum, r) => sum + r.updated,
      0
    );
    const totalErrors = Object.values(results).reduce(
      (sum, r) => sum + r.errors.length,
      0
    );

    const message = `Sincronização concluída. ${totalChecked} pedidos verificados, ${totalUpdated} atualizados${totalErrors > 0 ? `, ${totalErrors} erros` : ""}.`;

    console.log(`[sync-tracking] ${message}`, JSON.stringify(results));

    return new Response(
      JSON.stringify({
        success: true,
        message,
        synced: totalUpdated,
        checked: totalChecked,
        details: results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in sync-tracking:", error);
    return new Response(
      JSON.stringify({
        error: "Erro ao sincronizar rastreios",
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
