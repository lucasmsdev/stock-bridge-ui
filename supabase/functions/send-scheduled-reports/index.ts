import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const FREQUENCY_INTERVALS: Record<string, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
  quarterly: 90,
  semiannual: 180,
  annual: 365,
};

const FREQUENCY_LABELS: Record<string, string> = {
  daily: "Diário",
  weekly: "Semanal",
  monthly: "Mensal",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
};

const REPORT_TYPE_LABELS: Record<string, string> = {
  sales: "Vendas",
  profitability: "Lucratividade",
  marketplace_performance: "Performance por Marketplace",
  trends: "Tendências",
  stock_forecast: "Previsão de Estoque",
  roi_by_channel: "ROI por Canal",
};

function calculateNextRun(frequency: string, fromDate: Date = new Date()): Date {
  const next = new Date(fromDate);
  const days = FREQUENCY_INTERVALS[frequency] || 30;
  next.setDate(next.getDate() + days);
  return next;
}

function getPeriodForFrequency(frequency: string): string {
  switch (frequency) {
    case "daily":
      return "last_7_days";
    case "weekly":
      return "last_7_days";
    case "monthly":
      return "last_30_days";
    case "quarterly":
      return "last_3_months";
    case "semiannual":
      return "last_6_months";
    case "annual":
      return "current_year";
    default:
      return "last_30_days";
  }
}

async function generateReportData(
  supabase: any,
  userId: string,
  reportType: string,
  frequency: string
) {
  const period = getPeriodForFrequency(frequency);
  
  // Calculate date range
  const now = new Date();
  let startDate: Date;
  
  switch (period) {
    case "last_7_days":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "last_30_days":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "last_3_months":
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case "last_6_months":
      startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      break;
    case "current_year":
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  // Fetch orders for the period
  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .gte("order_date", startDate.toISOString())
    .lte("order_date", now.toISOString());

  if (ordersError) {
    console.error("Error fetching orders:", ordersError);
    throw ordersError;
  }

  // Fetch products
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("*")
    .eq("user_id", userId);

  if (productsError) {
    console.error("Error fetching products:", productsError);
  }

  // Calculate metrics
  const totalRevenue = (orders || []).reduce((sum: number, o: any) => sum + Number(o.total_value || 0), 0);
  const totalOrders = (orders || []).length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Group by platform
  const platformSales: Record<string, { orders: number; revenue: number }> = {};
  (orders || []).forEach((order: any) => {
    const platform = order.platform || "unknown";
    if (!platformSales[platform]) {
      platformSales[platform] = { orders: 0, revenue: 0 };
    }
    platformSales[platform].orders++;
    platformSales[platform].revenue += Number(order.total_value || 0);
  });

  return {
    period: {
      start: startDate.toLocaleDateString("pt-BR"),
      end: now.toLocaleDateString("pt-BR"),
    },
    summary: {
      totalRevenue,
      totalOrders,
      avgOrderValue,
      totalProducts: (products || []).length,
    },
    platformSales,
    reportType,
    frequency,
  };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function generateEmailHtml(data: any, reportTypeName: string, frequencyName: string): string {
  const platformRows = Object.entries(data.platformSales)
    .map(([platform, stats]: [string, any]) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${platform}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${stats.orders}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(stats.revenue)}</td>
      </tr>
    `)
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Relatório UNISTOCK</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #DF8F06 0%, #344966 100%); padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">UNISTOCK</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Relatório ${frequencyName} de ${reportTypeName}</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 30px;">
            <p style="color: #6b7280; margin: 0 0 20px 0;">
              Período: <strong>${data.period.start}</strong> a <strong>${data.period.end}</strong>
            </p>
            
            <!-- Summary Cards -->
            <div style="display: flex; gap: 15px; margin-bottom: 30px; flex-wrap: wrap;">
              <div style="flex: 1; min-width: 120px; background-color: #f0fdf4; padding: 20px; border-radius: 8px; text-align: center;">
                <p style="color: #16a34a; font-size: 24px; font-weight: bold; margin: 0;">${formatCurrency(data.summary.totalRevenue)}</p>
                <p style="color: #6b7280; font-size: 12px; margin: 5px 0 0 0;">Receita Total</p>
              </div>
              <div style="flex: 1; min-width: 120px; background-color: #eff6ff; padding: 20px; border-radius: 8px; text-align: center;">
                <p style="color: #2563eb; font-size: 24px; font-weight: bold; margin: 0;">${data.summary.totalOrders}</p>
                <p style="color: #6b7280; font-size: 12px; margin: 5px 0 0 0;">Pedidos</p>
              </div>
              <div style="flex: 1; min-width: 120px; background-color: #fef3c7; padding: 20px; border-radius: 8px; text-align: center;">
                <p style="color: #d97706; font-size: 24px; font-weight: bold; margin: 0;">${formatCurrency(data.summary.avgOrderValue)}</p>
                <p style="color: #6b7280; font-size: 12px; margin: 5px 0 0 0;">Ticket Médio</p>
              </div>
            </div>
            
            <!-- Platform Table -->
            ${Object.keys(data.platformSales).length > 0 ? `
              <h3 style="color: #1f2937; margin: 0 0 15px 0; font-size: 16px;">Vendas por Plataforma</h3>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <thead>
                  <tr style="background-color: #f9fafb;">
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #6b7280; font-weight: 600;">Plataforma</th>
                    <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e5e7eb; color: #6b7280; font-weight: 600;">Pedidos</th>
                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb; color: #6b7280; font-weight: 600;">Receita</th>
                  </tr>
                </thead>
                <tbody>
                  ${platformRows}
                </tbody>
              </table>
            ` : '<p style="color: #6b7280;">Nenhuma venda registrada no período.</p>'}
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              Este é um relatório automático gerado pelo UNISTOCK.<br>
              Para alterar as configurações de agendamento, acesse seu painel.
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Checking for scheduled reports to send...");

    // Get all active scheduled reports that are due
    const now = new Date().toISOString();
    const { data: dueReports, error: fetchError } = await supabase
      .from("scheduled_reports")
      .select(`
        id,
        user_id,
        report_type,
        frequency,
        format
      `)
      .eq("is_active", true)
      .lte("next_run_at", now);

    if (fetchError) {
      console.error("Error fetching scheduled reports:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${dueReports?.length || 0} reports to process`);

    const results = [];

    for (const report of dueReports || []) {
      try {
        console.log(`Processing report ${report.id} for user ${report.user_id}`);

        // Get user email from profiles
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("email, full_name")
          .eq("id", report.user_id)
          .single();

        if (profileError || !profile?.email) {
          console.error(`Failed to get profile for user ${report.user_id}:`, profileError);
          continue;
        }

        // Generate report data
        const reportData = await generateReportData(
          supabase,
          report.user_id,
          report.report_type,
          report.frequency
        );

        const reportTypeName = REPORT_TYPE_LABELS[report.report_type] || report.report_type;
        const frequencyName = FREQUENCY_LABELS[report.frequency] || report.frequency;

        // Generate HTML email
        const html = generateEmailHtml(reportData, reportTypeName, frequencyName);

        // Send email
        const emailResponse = await resend.emails.send({
          from: "UNISTOCK <noreply@resend.dev>",
          to: [profile.email],
          subject: `📊 Relatório ${frequencyName} de ${reportTypeName} - UNISTOCK`,
          html,
        });

        console.log(`Email sent to ${profile.email}:`, emailResponse);

        // Update next_run_at and last_sent_at
        const nextRun = calculateNextRun(report.frequency);
        const { error: updateError } = await supabase
          .from("scheduled_reports")
          .update({
            last_sent_at: now,
            next_run_at: nextRun.toISOString(),
          })
          .eq("id", report.id);

        if (updateError) {
          console.error(`Failed to update report ${report.id}:`, updateError);
        }

        results.push({
          reportId: report.id,
          email: profile.email,
          status: "sent",
        });
      } catch (reportError) {
        console.error(`Error processing report ${report.id}:`, reportError);
        results.push({
          reportId: report.id,
          status: "error",
          error: reportError instanceof Error ? reportError.message : "Unknown error",
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
    console.error("Error in send-scheduled-reports:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
