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

    console.log("🔔 Verificando tokens expirando...");

    // Only check for expiring tokens (low_stock and sync_error are now handled by DB triggers)
    const notifications = await checkExpiringTokens(supabase);

    let insertedCount = 0;
    const notificationsToSend: Array<{ notification: NotificationData; preferences: any; email: string }> = [];

    for (const notification of notifications) {
      const inserted = await insertNotificationIfNotExists(supabase, notification);
      if (inserted) {
        insertedCount++;
        
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

    // Send emails
    const sendPromises = notificationsToSend.map(async ({ notification, preferences, email }) => {
      if (preferences.token_expiring_alerts === false) {
        console.log(`🔕 Notificação token_expiring desabilitada para usuário`);
        return;
      }

      if (preferences.email_enabled) {
        await sendEmailNotification(email, notification);
      }
    });

    await Promise.allSettled(sendPromises);

    console.log(`📊 Resumo: ${notifications.length} tokens expirando, ${insertedCount} notificações criadas`);

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
    console.error("Erro ao verificar tokens:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

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
              <a href="https://fcvwogaqarkuqvumyqqm.lovable.app/app/integrations" 
                 style="display: inline-block; background-color: #DF8F06; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                Ver Integrações
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
