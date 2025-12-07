import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationData {
  user_id: string;
  title: string;
  message: string;
  type: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("🔔 Iniciando verificação de notificações automáticas...");

    const notifications: NotificationData[] = [];

    // 1. Check for low stock products (stock <= 5)
    const lowStockNotifications = await checkLowStock(supabase);
    notifications.push(...lowStockNotifications);

    // 2. Check for expiring tokens (within 24 hours)
    const expiringTokenNotifications = await checkExpiringTokens(supabase);
    notifications.push(...expiringTokenNotifications);

    // 3. Check for sync errors
    const syncErrorNotifications = await checkSyncErrors(supabase);
    notifications.push(...syncErrorNotifications);

    // Insert all notifications (avoiding duplicates)
    let insertedCount = 0;
    for (const notification of notifications) {
      const inserted = await insertNotificationIfNotExists(supabase, notification);
      if (inserted) insertedCount++;
    }

    console.log(`📊 Resumo: ${notifications.length} alertas detectados, ${insertedCount} notificações criadas`);

    return new Response(
      JSON.stringify({
        success: true,
        detected: notifications.length,
        created: insertedCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro ao gerar notificações:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function checkLowStock(supabase: any): Promise<NotificationData[]> {
  const notifications: NotificationData[] = [];
  
  const { data: lowStockProducts, error } = await supabase
    .from("products")
    .select("id, name, sku, stock, user_id")
    .lte("stock", 5);

  if (error) {
    console.error("Erro ao verificar estoque baixo:", error);
    return notifications;
  }

  if (lowStockProducts && lowStockProducts.length > 0) {
    console.log(`⚠️ ${lowStockProducts.length} produtos com estoque baixo`);
    
    for (const product of lowStockProducts) {
      const stockLevel = product.stock <= 0 ? "esgotado" : "baixo";
      const urgency = product.stock <= 0 ? "🚨" : "⚠️";
      
      notifications.push({
        user_id: product.user_id,
        title: `${urgency} Estoque ${stockLevel}: ${product.name}`,
        message: product.stock <= 0 
          ? `O produto "${product.name}" (SKU: ${product.sku}) está sem estoque. Reponha o quanto antes para não perder vendas.`
          : `O produto "${product.name}" (SKU: ${product.sku}) está com apenas ${product.stock} unidades em estoque.`,
        type: "low_stock",
      });
    }
  }

  return notifications;
}

async function checkExpiringTokens(supabase: any): Promise<NotificationData[]> {
  const notifications: NotificationData[] = [];
  
  // Check integrations updated more than 5 hours ago (tokens typically expire in 6 hours)
  const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
  
  const { data: expiringIntegrations, error } = await supabase
    .from("integrations")
    .select("id, platform, account_name, account_nickname, user_id, updated_at")
    .lt("updated_at", fiveHoursAgo)
    .not("platform", "eq", "shopify"); // Shopify tokens don't expire

  if (error) {
    console.error("Erro ao verificar tokens expirando:", error);
    return notifications;
  }

  if (expiringIntegrations && expiringIntegrations.length > 0) {
    console.log(`⏰ ${expiringIntegrations.length} integrações com token expirando`);
    
    for (const integration of expiringIntegrations) {
      const accountDisplay = integration.account_nickname || integration.account_name || integration.platform;
      
      notifications.push({
        user_id: integration.user_id,
        title: `⏰ Token expirando: ${accountDisplay}`,
        message: `O token de acesso da integração ${integration.platform} (${accountDisplay}) pode expirar em breve. O sistema tentará renovar automaticamente.`,
        type: "token_expiring",
      });
    }
  }

  return notifications;
}

async function checkSyncErrors(supabase: any): Promise<NotificationData[]> {
  const notifications: NotificationData[] = [];
  
  const { data: syncErrors, error } = await supabase
    .from("product_listings")
    .select(`
      id, 
      platform, 
      sync_error, 
      user_id,
      products:product_id (name, sku)
    `)
    .eq("sync_status", "error")
    .not("sync_error", "is", null);

  if (error) {
    console.error("Erro ao verificar erros de sincronização:", error);
    return notifications;
  }

  if (syncErrors && syncErrors.length > 0) {
    console.log(`❌ ${syncErrors.length} produtos com erro de sincronização`);
    
    for (const listing of syncErrors) {
      const productName = listing.products?.name || "Produto";
      
      notifications.push({
        user_id: listing.user_id,
        title: `❌ Erro de sincronização: ${productName}`,
        message: `Falha ao sincronizar "${productName}" com ${listing.platform}: ${listing.sync_error}`,
        type: "sync_error",
      });
    }
  }

  return notifications;
}

async function insertNotificationIfNotExists(
  supabase: any, 
  notification: NotificationData
): Promise<boolean> {
  // Check if a similar notification was created in the last 24 hours
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const { data: existing } = await supabase
    .from("notifications")
    .select("id")
    .eq("user_id", notification.user_id)
    .eq("type", notification.type)
    .eq("title", notification.title)
    .gte("created_at", oneDayAgo)
    .limit(1);

  if (existing && existing.length > 0) {
    return false; // Already exists, skip
  }

  const { error } = await supabase
    .from("notifications")
    .insert(notification);

  if (error) {
    console.error("Erro ao inserir notificação:", error);
    return false;
  }

  return true;
}
