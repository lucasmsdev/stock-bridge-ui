import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");

    if (!perplexityKey) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate user
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get organization_id
    const { data: orgMember } = await supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .single();

    if (!orgMember) {
      return new Response(JSON.stringify({ error: "No organization found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orgId = orgMember.organization_id;

    // Check generation limit (max 2 per day per org)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count: todayCount } = await supabase
      .from("ai_insights")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .gte("generated_at", todayStart.toISOString());

    if ((todayCount || 0) >= 2) {
      // Return the most recent insights instead of generating new
      const { data: existing } = await supabase
        .from("ai_insights")
        .select("*")
        .eq("organization_id", orgId)
        .order("generated_at", { ascending: false })
        .limit(1)
        .single();

      return new Response(JSON.stringify({ insights: existing?.insights || [], cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch user data in parallel
    const [productsRes, ordersRes, expensesRes, suppliersRes, listingsRes] = await Promise.all([
      supabase
        .from("products")
        .select("id, name, sku, stock, cost_price, selling_price, category, updated_at")
        .eq("organization_id", orgId)
        .order("stock", { ascending: true })
        .limit(100),
      supabase
        .from("orders")
        .select("id, total_value, order_date, platform, items, status")
        .eq("organization_id", orgId)
        .order("order_date", { ascending: false })
        .limit(200),
      supabase
        .from("expenses")
        .select("id, name, amount, category, recurrence, is_active")
        .eq("organization_id", orgId)
        .eq("is_active", true),
      supabase
        .from("suppliers")
        .select("id, name, is_active")
        .eq("organization_id", orgId)
        .eq("is_active", true),
      supabase
        .from("product_listings")
        .select("product_id, platform")
        .eq("organization_id", orgId),
    ]);

    const products = productsRes.data || [];
    const orders = ordersRes.data || [];
    const expenses = expensesRes.data || [];
    const suppliers = suppliersRes.data || [];
    const listings = listingsRes.data || [];

    // If no data, return empty insights
    if (products.length === 0 && orders.length === 0) {
      return new Response(JSON.stringify({ insights: [], cached: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate sales velocity per product (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentOrders = orders.filter(o => new Date(o.order_date) >= thirtyDaysAgo);
    
    const productSalesMap: Record<string, number> = {};
    recentOrders.forEach(order => {
      const items = order.items as any[];
      if (Array.isArray(items)) {
        items.forEach(item => {
          const sku = item.sku || item.seller_sku;
          if (sku) {
            productSalesMap[sku] = (productSalesMap[sku] || 0) + (item.quantity || 1);
          }
        });
      }
    });

    // Build product listings map
    const productPlatformsMap: Record<string, string[]> = {};
    listings.forEach(l => {
      if (!productPlatformsMap[l.product_id]) {
        productPlatformsMap[l.product_id] = [];
      }
      productPlatformsMap[l.product_id].push(l.platform);
    });

    // Enrich products with velocity and margin
    const enrichedProducts = products.map(p => {
      const velocity = productSalesMap[p.sku] || 0;
      const daysOfStock = velocity > 0 ? Math.round((p.stock || 0) / (velocity / 30)) : null;
      const margin = p.selling_price && p.cost_price
        ? ((p.selling_price - p.cost_price) / p.selling_price * 100).toFixed(1)
        : null;
      const platforms = productPlatformsMap[p.id] || [];

      return {
        name: p.name,
        sku: p.sku,
        stock: p.stock,
        costPrice: p.cost_price,
        sellingPrice: p.selling_price,
        margin: margin ? `${margin}%` : "N/A",
        salesLast30d: velocity,
        daysOfStock,
        platforms: platforms.length > 0 ? platforms.join(", ") : "nenhum marketplace conectado",
      };
    });

    // Calculate monthly revenue trend
    const monthlyRevenue: Record<string, number> = {};
    orders.forEach(o => {
      const month = new Date(o.order_date).toISOString().slice(0, 7);
      monthlyRevenue[month] = (monthlyRevenue[month] || 0) + Number(o.total_value || 0);
    });

    const sortedMonths = Object.entries(monthlyRevenue).sort(([a], [b]) => a.localeCompare(b));

    // Calculate total monthly expenses
    const totalMonthlyExpenses = expenses.reduce((sum, e) => {
      switch (e.recurrence) {
        case "monthly": return sum + e.amount;
        case "weekly": return sum + e.amount * 4.33;
        case "yearly": return sum + e.amount / 12;
        default: return sum + e.amount;
      }
    }, 0);

    // Build the system prompt with data context
    const systemPrompt = `Você é a Uni, assistente de IA estratégica da Unistock. Analise os dados abaixo e gere insights proativos e acionáveis para o lojista.

DADOS DO NEGÓCIO:

📦 PRODUTOS (${enrichedProducts.length} produtos):
${enrichedProducts.slice(0, 50).map(p => 
  `- ${p.name} (SKU: ${p.sku}) | Estoque: ${p.stock} | Preço: R$${p.sellingPrice || "N/A"} | Custo: R$${p.costPrice || "N/A"} | Margem: ${p.margin} | Vendas 30d: ${p.salesLast30d} | Dias de estoque: ${p.daysOfStock || "∞"} | Marketplaces: ${p.platforms}`
).join("\n")}

📊 TENDÊNCIA DE VENDAS (últimos meses):
${sortedMonths.slice(-6).map(([month, rev]) => `- ${month}: R$ ${rev.toFixed(2)}`).join("\n")}

💰 DESPESAS FIXAS MENSAIS: R$ ${totalMonthlyExpenses.toFixed(2)}
${expenses.slice(0, 20).map(e => `- ${e.name}: R$ ${e.amount} (${e.recurrence})`).join("\n")}

🏭 FORNECEDORES ATIVOS: ${suppliers.length}

📈 TOTAL DE PEDIDOS (últimos 30 dias): ${recentOrders.length}
💵 FATURAMENTO (últimos 30 dias): R$ ${recentOrders.reduce((s, o) => s + Number(o.total_value || 0), 0).toFixed(2)}

REGRAS DE ANÁLISE:
1. Produto com menos de 7 dias de estoque E vendas > 0 = CRÍTICO (stock_critical)
2. Margem abaixo de 10% = WARNING (low_margin)
3. Produto vendendo bem mas ausente em outros marketplaces = OPORTUNIDADE (expansion_opportunity)
4. Tendência de queda de vendas mês a mês > 20% = ALERTA (trend_alert)
5. Despesas crescendo mais rápido que receita = OTIMIZAÇÃO (cost_optimization)

Gere no máximo 5 insights. Priorize os mais urgentes e acionáveis. Use nomes reais dos produtos e valores específicos. Seja direto e objetivo.`;

    // Call Perplexity API with structured JSON output
    const perplexityResponse = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${perplexityKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Analise os dados do meu negócio e gere insights proativos. Retorne APENAS o JSON estruturado com os insights." },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "insights_response",
            schema: {
              type: "object",
              properties: {
                insights: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: {
                        type: "string",
                        enum: ["stock_critical", "low_margin", "expansion_opportunity", "trend_alert", "cost_optimization"],
                      },
                      severity: {
                        type: "string",
                        enum: ["critical", "warning", "opportunity"],
                      },
                      title: { type: "string" },
                      description: { type: "string" },
                      action: { type: "string" },
                      metric: { type: "string" },
                      relatedProductId: { type: "string" },
                    },
                    required: ["type", "severity", "title", "description", "action", "metric"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["insights"],
              additionalProperties: false,
            },
          },
        },
        max_tokens: 1500,
        temperature: 0.3,
      }),
    });

    if (!perplexityResponse.ok) {
      const errorText = await perplexityResponse.text();
      console.error("Perplexity API error:", perplexityResponse.status, errorText);
      return new Response(JSON.stringify({ error: "AI service error", insights: [] }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await perplexityResponse.json();
    
    let insights: any[] = [];

    // Extract from structured JSON response
    const content = aiResult.choices?.[0]?.message?.content;
    if (content) {
      try {
        const parsed = JSON.parse(content);
        insights = parsed.insights || [];
      } catch (e) {
        console.error("Failed to parse JSON response:", e);
        // Fallback: try to extract JSON array from content
        try {
          const jsonMatch = content.match(/\{[\s\S]*"insights"[\s\S]*\}/);
          if (jsonMatch) {
            const parsed2 = JSON.parse(jsonMatch[0]);
            insights = parsed2.insights || [];
          }
        } catch (e2) {
          console.error("Fallback parse also failed:", e2);
        }
      }
    }
    // Limit to 5 insights
    insights = insights.slice(0, 5);

    // Map product names to IDs for relatedProductId
    insights = insights.map((insight: any) => {
      if (!insight.relatedProductId) {
        // Try to find a matching product by name
        const matchedProduct = products.find(p => 
          insight.title?.includes(p.name) || insight.description?.includes(p.name)
        );
        if (matchedProduct) {
          insight.relatedProductId = matchedProduct.id;
        }
      }
      return insight;
    });

    // Save insights to database
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000); // 12 hours

    await supabase
      .from("ai_insights")
      .insert({
        organization_id: orgId,
        user_id: user.id,
        insights: insights,
        generated_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      });

    // Create notifications for critical insights (max 1 per type per day)
    const criticalInsights = insights.filter((i: any) => i.severity === "critical");
    
    for (const insight of criticalInsights) {
      // Check if we already notified about this type today
      const { count: existingNotifCount } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("type", "ai_insight")
        .gte("created_at", todayStart.toISOString())
        .ilike("title", `%${insight.type}%`);

      if ((existingNotifCount || 0) === 0) {
        await supabase.from("notifications").insert({
          user_id: user.id,
          organization_id: orgId,
          title: `🤖 Uni AI: ${insight.title}`,
          message: insight.description,
          type: "ai_insight",
        });
      }
    }

    return new Response(JSON.stringify({ insights, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-ai-insights error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error", insights: [] }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
