import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationData {
  id?: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  created_at?: string;
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

    console.log("🔔 Iniciando verificação de notificações...");

    // 1. Check for expiring tokens and create notifications
    const tokenNotifications = await checkExpiringTokens(supabase);
    let insertedCount = 0;

    for (const notification of tokenNotifications) {
      const inserted = await insertNotificationIfNotExists(supabase, notification);
      if (inserted) insertedCount++;
    }

    // 2. Send emails for all unsent notifications (from DB triggers or token checks)
    const emailsSent = await sendPendingNotificationEmails(supabase);

    console.log(`📊 Resumo: ${tokenNotifications.length} tokens expirando, ${insertedCount} notificações criadas, ${emailsSent} emails enviados`);

    return new Response(
      JSON.stringify({
        success: true,
        token_notifications: tokenNotifications.length,
        notifications_created: insertedCount,
        emails_sent: emailsSent,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro ao processar notificações:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno ao processar notificações" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Send emails for notifications that haven't been emailed yet
async function sendPendingNotificationEmails(supabase: any): Promise<number> {
  // Get notifications from the last hour that we should send emails for
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const { data: notifications, error } = await supabase
    .from("notifications")
    .select(`
      id, user_id, title, message, type, created_at,
      profiles!inner(email),
      notification_preferences(email_enabled, low_stock_alerts, token_expiring_alerts, sync_error_alerts)
    `)
    .gte("created_at", oneHourAgo)
    .eq("is_read", false)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Erro ao buscar notificações pendentes:", error);
    return 0;
  }

  if (!notifications || notifications.length === 0) {
    console.log("📭 Nenhuma notificação pendente para enviar");
    return 0;
  }

  console.log(`📬 ${notifications.length} notificações pendentes encontradas`);

  let emailsSent = 0;

  for (const notification of notifications) {
    const email = notification.profiles?.email;
    if (!email) continue;

    const prefs = notification.notification_preferences?.[0] || {
      email_enabled: true,
      low_stock_alerts: true,
      token_expiring_alerts: true,
      sync_error_alerts: true,
    };

    // Check if email is enabled globally
    if (!prefs.email_enabled) {
      console.log(`🔕 Email desabilitado para usuário ${notification.user_id}`);
      continue;
    }

    // Check specific alert type preference
    const alertType = notification.type;
    if (alertType === "low_stock" && !prefs.low_stock_alerts) continue;
    if (alertType === "token_expiring" && !prefs.token_expiring_alerts) continue;
    if (alertType === "sync_error" && !prefs.sync_error_alerts) continue;

    const sent = await sendEmailNotification(email, notification);
    if (sent) emailsSent++;
  }

  return emailsSent;
}

async function sendEmailNotification(email: string, notification: NotificationData): Promise<boolean> {
  try {
    console.log(`📧 Enviando email para ${email}: ${notification.title}`);
    
    // Determine CTA button based on notification type
    const ctaConfig = getCtaForType(notification.type);
    
    const { data, error } = await resend.emails.send({
      from: "UNISTOCK <notificacoes@resend.dev>",
      to: [email],
      subject: notification.title.replace(/[🚨⚠️⏰❌📦]/g, "").trim(),
      html: buildEmailHtml(notification, ctaConfig),
    });

    if (error) {
      console.error("Erro ao enviar email:", error);
      return false;
    }
    
    console.log("✅ Email enviado com sucesso:", data?.id);
    return true;
  } catch (error) {
    console.error("Erro ao enviar email:", error);
    return false;
  }
}

function getCtaForType(type: string): { url: string; text: string } {
  const baseUrl = "https://fcvwogaqarkuqvumyqqm.lovable.app";
  
  switch (type) {
    case "low_stock":
      return { url: `${baseUrl}/app/products`, text: "Ver Produtos" };
    case "sync_error":
      return { url: `${baseUrl}/app/products`, text: "Ver Produtos" };
    case "token_expiring":
      return { url: `${baseUrl}/app/integrations`, text: "Ver Integrações" };
    default:
      return { url: `${baseUrl}/app`, text: "Acessar Dashboard" };
  }
}

function buildEmailHtml(notification: NotificationData, cta: { url: string; text: string }): string {
  // Determine header color based on type
  let headerColor = "#344966"; // Default: Harvest Gold
  if (notification.type === "low_stock" && notification.title.includes("esgotado")) {
    headerColor = "#DC2626"; // Red for critical
  } else if (notification.type === "sync_error") {
    headerColor = "#DC2626"; // Red for errors
  } else if (notification.type === "low_stock") {
    headerColor = "#F59E0B"; // Amber for warnings
  }

  return `
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
          <div style="border-left: 4px solid ${headerColor}; padding-left: 16px; margin-bottom: 20px;">
            <h2 style="color: #121212; margin: 0 0 8px 0; font-size: 20px;">${escapeHtml(notification.title)}</h2>
            <span style="color: #666666; font-size: 12px; text-transform: uppercase;">${getTypeLabel(notification.type)}</span>
          </div>
          <p style="color: #444444; line-height: 1.6; margin: 0 0 24px 0; font-size: 15px;">${escapeHtml(notification.message)}</p>
          <a href="${cta.url}" 
             style="display: inline-block; background-color: #DF8F06; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">
            ${cta.text}
          </a>
          <hr style="border: none; border-top: 1px solid #eeeeee; margin: 30px 0;">
          <p style="color: #999999; font-size: 12px; margin: 0;">
            Você recebeu este email porque tem notificações ativas na sua conta UNISTOCK.
            <br><a href="https://fcvwogaqarkuqvumyqqm.lovable.app/app/profile" style="color: #DF8F06;">Gerenciar preferências de notificação</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function getTypeLabel(type: string): string {
  switch (type) {
    case "low_stock": return "Alerta de Estoque";
    case "sync_error": return "Erro de Sincronização";
    case "token_expiring": return "Token Expirando";
    default: return "Notificação";
  }
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function checkExpiringTokens(supabase: any): Promise<NotificationData[]> {
  const notifications: NotificationData[] = [];
  
  // Check integrations with token_expires_at in the next 2 hours, or updated more than 5 hours ago
  const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
  
  // First check by token_expires_at
  const { data: expiringByDate, error: error1 } = await supabase
    .from("integrations")
    .select("id, platform, account_name, account_nickname, user_id, token_expires_at")
    .lt("token_expires_at", twoHoursFromNow)
    .gt("token_expires_at", new Date().toISOString())
    .not("platform", "eq", "shopify");

  if (!error1 && expiringByDate) {
    for (const integration of expiringByDate) {
      const accountDisplay = integration.account_nickname || integration.account_name || integration.platform;
      notifications.push({
        user_id: integration.user_id,
        title: `⏰ Token expirando: ${accountDisplay}`,
        message: `O token de acesso da integração ${integration.platform} (${accountDisplay}) expira em breve. O sistema tentará renovar automaticamente.`,
        type: "token_expiring",
      });
    }
  }

  // Also check by updated_at for integrations without token_expires_at
  const { data: expiringByUpdate, error: error2 } = await supabase
    .from("integrations")
    .select("id, platform, account_name, account_nickname, user_id, updated_at")
    .is("token_expires_at", null)
    .lt("updated_at", fiveHoursAgo)
    .not("platform", "eq", "shopify");

  if (!error2 && expiringByUpdate) {
    for (const integration of expiringByUpdate) {
      const accountDisplay = integration.account_nickname || integration.account_name || integration.platform;
      notifications.push({
        user_id: integration.user_id,
        title: `⏰ Token pode expirar: ${accountDisplay}`,
        message: `O token de acesso da integração ${integration.platform} (${accountDisplay}) pode ter expirado. Verifique a conexão.`,
        type: "token_expiring",
      });
    }
  }

  console.log(`⏰ ${notifications.length} integrações com token expirando detectadas`);
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
    return false;
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
