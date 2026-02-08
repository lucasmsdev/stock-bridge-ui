import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AutomationRule {
  id: string;
  organization_id: string;
  user_id: string;
  rule_type: string;
  is_active: boolean;
  config: Record<string, unknown>;
  last_triggered_at: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("⚡ Iniciando processamento de automações...");

    // Fetch all active automation rules
    const { data: rules, error: rulesError } = await supabase
      .from("automation_rules")
      .select("*")
      .eq("is_active", true);

    if (rulesError) {
      console.error("Erro ao buscar regras:", rulesError);
      throw rulesError;
    }

    if (!rules || rules.length === 0) {
      console.log("📭 Nenhuma regra ativa encontrada");
      return new Response(
        JSON.stringify({ success: true, message: "Nenhuma regra ativa", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📋 ${rules.length} regras ativas encontradas`);

    let totalActions = 0;

    // Group rules by organization for efficiency
    const rulesByOrg = new Map<string, AutomationRule[]>();
    for (const rule of rules) {
      const orgId = rule.organization_id;
      if (!rulesByOrg.has(orgId)) {
        rulesByOrg.set(orgId, []);
      }
      rulesByOrg.get(orgId)!.push(rule);
    }

    for (const [orgId, orgRules] of rulesByOrg) {
      // Fetch org products once
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id, name, sku, stock, cost_price, selling_price, user_id")
        .eq("organization_id", orgId);

      if (productsError || !products) {
        console.error(`Erro ao buscar produtos da org ${orgId}:`, productsError);
        continue;
      }

      // Get org owner for notifications (use the rule creator)
      const orgUserIds = [...new Set(orgRules.map(r => r.user_id))];

      for (const rule of orgRules) {
        try {
          let actionsCount = 0;

          switch (rule.rule_type) {
            case "pause_zero_stock":
              actionsCount = await processPauseZeroStock(supabase, rule, products, orgId);
              break;
            case "low_stock_alert":
              actionsCount = await processLowStockAlert(supabase, rule, products, orgId);
              break;
            case "low_margin_alert":
              actionsCount = await processLowMarginAlert(supabase, rule, products, orgId);
              break;
          }

          if (actionsCount > 0) {
            // Update last_triggered_at
            await supabase
              .from("automation_rules")
              .update({ last_triggered_at: new Date().toISOString() })
              .eq("id", rule.id);
          }

          totalActions += actionsCount;
        } catch (err) {
          console.error(`Erro ao processar regra ${rule.id} (${rule.rule_type}):`, err);
        }
      }
    }

    console.log(`✅ Processamento concluído: ${totalActions} ações executadas`);

    return new Response(
      JSON.stringify({ success: true, processed: totalActions }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro ao processar automações:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno ao processar automações" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function insertNotificationIfNotExists(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  title: string,
  message: string,
  type: string
): Promise<boolean> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: existing } = await supabase
    .from("notifications")
    .select("id")
    .eq("user_id", userId)
    .eq("type", type)
    .eq("title", title)
    .gte("created_at", oneDayAgo)
    .limit(1);

  if (existing && existing.length > 0) return false;

  const { error } = await supabase
    .from("notifications")
    .insert({ user_id: userId, title, message, type });

  if (error) {
    console.error("Erro ao inserir notificação:", error);
    return false;
  }
  return true;
}

async function logAutomationAction(
  supabase: ReturnType<typeof createClient>,
  ruleId: string,
  orgId: string,
  actionTaken: string,
  details: Record<string, unknown>
) {
  await supabase.from("automation_logs").insert({
    automation_rule_id: ruleId,
    organization_id: orgId,
    action_taken: actionTaken,
    details,
  });
}

// ==========================================
// PAUSE ZERO STOCK
// ==========================================
async function processPauseZeroStock(
  supabase: ReturnType<typeof createClient>,
  rule: AutomationRule,
  products: Array<Record<string, unknown>>,
  orgId: string
): Promise<number> {
  let actions = 0;

  // 1. Find products with stock = 0 that have active listings
  const zeroStockProducts = products.filter((p) => (p.stock as number) <= 0);
  const zeroStockIds = zeroStockProducts.map((p) => p.id as string);

  if (zeroStockIds.length > 0) {
    const { data: activeListings } = await supabase
      .from("product_listings")
      .select("id, product_id, platform")
      .in("product_id", zeroStockIds)
      .eq("organization_id", orgId)
      .eq("sync_status", "active");

    if (activeListings && activeListings.length > 0) {
      for (const listing of activeListings) {
        await supabase
          .from("product_listings")
          .update({ sync_status: "paused", sync_error: "Pausado automaticamente: estoque zerado" })
          .eq("id", listing.id);

        const product = zeroStockProducts.find((p) => p.id === listing.product_id);
        const productName = (product?.name as string) || "Produto";

        await insertNotificationIfNotExists(
          supabase,
          rule.user_id,
          `⏸️ Anúncio pausado: ${productName}`,
          `O anúncio de "${productName}" no ${listing.platform} foi pausado automaticamente porque o estoque zerou.`,
          "automation_pause"
        );

        await logAutomationAction(supabase, rule.id, orgId, "listing_paused", {
          product_id: listing.product_id,
          product_name: productName,
          platform: listing.platform,
          listing_id: listing.id,
        });

        actions++;
      }
    }
  }

  // 2. Reactivate listings for products that now have stock > 0
  const restockedProducts = products.filter((p) => (p.stock as number) > 0);
  const restockedIds = restockedProducts.map((p) => p.id as string);

  if (restockedIds.length > 0) {
    const { data: pausedListings } = await supabase
      .from("product_listings")
      .select("id, product_id, platform")
      .in("product_id", restockedIds)
      .eq("organization_id", orgId)
      .eq("sync_status", "paused")
      .eq("sync_error", "Pausado automaticamente: estoque zerado");

    if (pausedListings && pausedListings.length > 0) {
      for (const listing of pausedListings) {
        await supabase
          .from("product_listings")
          .update({ sync_status: "active", sync_error: null })
          .eq("id", listing.id);

        const product = restockedProducts.find((p) => p.id === listing.product_id);
        const productName = (product?.name as string) || "Produto";

        await insertNotificationIfNotExists(
          supabase,
          rule.user_id,
          `▶️ Anúncio reativado: ${productName}`,
          `O anúncio de "${productName}" no ${listing.platform} foi reativado automaticamente porque o estoque foi reposto.`,
          "automation_reactivate"
        );

        await logAutomationAction(supabase, rule.id, orgId, "listing_reactivated", {
          product_id: listing.product_id,
          product_name: productName,
          platform: listing.platform,
          listing_id: listing.id,
        });

        actions++;
      }
    }
  }

  return actions;
}

// ==========================================
// LOW STOCK ALERT
// ==========================================
async function processLowStockAlert(
  supabase: ReturnType<typeof createClient>,
  rule: AutomationRule,
  products: Array<Record<string, unknown>>,
  orgId: string
): Promise<number> {
  const threshold = (rule.config as Record<string, number>).threshold ?? 10;
  let actions = 0;

  const lowStockProducts = products.filter(
    (p) => (p.stock as number) > 0 && (p.stock as number) <= threshold
  );

  for (const product of lowStockProducts) {
    const inserted = await insertNotificationIfNotExists(
      supabase,
      rule.user_id,
      `📦 Estoque baixo: ${product.name}`,
      `O produto "${product.name}" (SKU: ${product.sku || "N/A"}) tem apenas ${product.stock} unidades. Limite configurado: ${threshold}.`,
      "automation_low_stock"
    );

    if (inserted) {
      await logAutomationAction(supabase, rule.id, orgId, "low_stock_alert", {
        product_id: product.id,
        product_name: product.name,
        current_stock: product.stock,
        threshold,
      });
      actions++;
    }
  }

  return actions;
}

// ==========================================
// LOW MARGIN ALERT
// ==========================================
async function processLowMarginAlert(
  supabase: ReturnType<typeof createClient>,
  rule: AutomationRule,
  products: Array<Record<string, unknown>>,
  orgId: string
): Promise<number> {
  const minMargin = (rule.config as Record<string, number>).min_margin ?? 15;
  let actions = 0;

  const productsWithPrices = products.filter(
    (p) => p.cost_price && p.selling_price && (p.selling_price as number) > 0
  );

  for (const product of productsWithPrices) {
    const costPrice = product.cost_price as number;
    const sellingPrice = product.selling_price as number;
    const margin = ((sellingPrice - costPrice) / sellingPrice) * 100;

    if (margin < minMargin) {
      const inserted = await insertNotificationIfNotExists(
        supabase,
        rule.user_id,
        `💰 Margem baixa: ${product.name}`,
        `O produto "${product.name}" (SKU: ${product.sku || "N/A"}) está com margem de ${margin.toFixed(1)}%. Mínimo configurado: ${minMargin}%.`,
        "automation_low_margin"
      );

      if (inserted) {
        await logAutomationAction(supabase, rule.id, orgId, "low_margin_alert", {
          product_id: product.id,
          product_name: product.name,
          current_margin: Number(margin.toFixed(1)),
          min_margin: minMargin,
          cost_price: costPrice,
          selling_price: sellingPrice,
        });
        actions++;
      }
    }
  }

  return actions;
}
