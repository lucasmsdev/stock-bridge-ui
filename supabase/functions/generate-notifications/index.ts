import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.0";

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

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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
    const notificationsToSend: Array<{ notification: NotificationData; preferences: any; email: string }> = [];

    for (const notification of notifications) {
      const inserted = await insertNotificationIfNotExists(supabase, notification);
      if (inserted) {
        insertedCount++;
        
        // Fetch user preferences and email for sending
        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", notification.user_id)
          .single();

        const { data: preferences } = await supabase
          .from("notification_preferences")
          .select("*")
          .eq("user_id", notification.user_id)
          .single();

        if (profile?.email) {
          notificationsToSend.push({
            notification,
            preferences: preferences || { email_enabled: true, push_enabled: true },
            email: profile.email,
          });
        }
      }
    }

    // Send emails and push notifications in background
    const sendPromises = notificationsToSend.map(async ({ notification, preferences, email }) => {
      // Check notification type preferences
      const shouldNotify = checkNotificationTypePreference(preferences, notification.type);
      
      if (!shouldNotify) {
        console.log(`🔕 Notificação ${notification.type} desabilitada para usuário`);
        return;
      }

      // Send email if enabled
      if (preferences.email_enabled) {
        await sendEmailNotification(email, notification);
      }

      // Push notification is handled via real-time subscription
      // The client receives the notification automatically
    });

    await Promise.allSettled(sendPromises);

    console.log(`📊 Resumo: ${notifications.length} alertas detectados, ${insertedCount} notificações criadas`);

    return new Response(
      JSON.stringify({
        success: true,
        detected: notifications.length,
        created: insertedCount,
        emails_sent: notificationsToSend.filter(n => n.preferences.email_enabled).length,
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

function checkNotificationTypePreference(preferences: any, type: string): boolean {
  if (!preferences) return true;
  
  switch (type) {
    case "low_stock":
      return preferences.low_stock_alerts !== false;
    case "token_expiring":
      return preferences.token_expiring_alerts !== false;
    case "sync_error":
      return preferences.sync_error_alerts !== false;
    default:
      return true;
  }
}

async function sendEmailNotification(email: string, notification: NotificationData) {
  try {
    console.log(`📧 Enviando email para ${email}: ${notification.title}`);
    
    const { data, error } = await resend.emails.send({
      from: "UNISTOCK <notificacoes@resend.dev>",
      to: [email],
      subject: notification.title.replace(/[🚨⚠️⏰❌]/g, "").trim(),
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f1f1f1;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #121212; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">UNISTOCK</h1>
            </div>
            <div style="background-color: #ffffff; padding: 30px; border-radius: 0 0 8px 8px;">
              <h2 style="color: #121212; margin: 0 0 20px 0; font-size: 20px;">${notification.title}</h2>
              <p style="color: #666666; line-height: 1.6; margin: 0 0 20px 0;">${notification.message}</p>
              <a href="https://fcvwogaqarkuqvumyqqm.lovable.app/app/dashboard" 
                 style="display: inline-block; background-color: #DF8F06; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                Ver no Dashboard
              </a>
              <hr style="border: none; border-top: 1px solid #eeeeee; margin: 30px 0;">
              <p style="color: #999999; font-size: 12px; margin: 0;">
                Você recebeu este email porque tem notificações ativas na sua conta UNISTOCK.
                <br>Para gerenciar suas preferências de notificação, acesse as configurações do seu perfil.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("Erro ao enviar email:", error);
    } else {
      console.log("✅ Email enviado com sucesso:", data?.id);
    }
  } catch (error) {
    console.error("Erro ao enviar email:", error);
  }
}

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
