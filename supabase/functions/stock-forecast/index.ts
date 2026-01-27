import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProductForecast {
  productId: string;
  name: string;
  sku: string | null;
  category: string | null;
  currentStock: number;
  dailyVelocity: number;
  velocity30d: number;
  velocity60d: number;
  velocity90d: number;
  daysToStockout: number;
  adjustedDaysToStockout: number;
  marketTrend: 'alta' | 'estavel' | 'baixa';
  adjustmentFactor: number;
  urgency: 'CRITICO' | 'ATENCAO' | 'OK';
  confidence: number;
  reason: string;
  recommendation: string;
  risks: string[];
}

interface ForecastSummary {
  critical: number;
  attention: number;
  ok: number;
  totalProducts: number;
  potentialLossValue: number;
}

interface ForecastResponse {
  forecasts: ProductForecast[];
  summary: ForecastSummary;
  lastUpdated: string;
  cachedUntil: string;
}

// Cache em memória (persiste entre warm invocations)
const cache = new Map<string, { data: ForecastResponse; expiry: number }>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 horas

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    // ✅ Validar JWT explicitamente (verify_jwt desabilitado no config.toml)
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    const userId = claimsData?.claims?.sub;

    if (claimsError || !userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const user = { id: userId };

    const { forceRefresh = false, maxProducts = 20 } = await req.json().catch(() => ({}));

    // Verificar cache em memória
    const cacheKey = `stock-forecast-${user.id}`;
    if (!forceRefresh) {
      const cached = cache.get(cacheKey);
      if (cached && cached.expiry > Date.now()) {
        console.log('Returning cached forecast');
        return new Response(
          JSON.stringify(cached.data),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Buscar produtos do usuário
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, sku, category, stock, cost_price, selling_price')
      .eq('user_id', user.id)
      .order('stock', { ascending: true })
      .limit(100);

    if (productsError) {
      throw new Error(`Error fetching products: ${productsError.message}`);
    }

    if (!products || products.length === 0) {
      const emptyResponse: ForecastResponse = {
        forecasts: [],
        summary: { critical: 0, attention: 0, ok: 0, totalProducts: 0, potentialLossValue: 0 },
        lastUpdated: new Date().toISOString(),
        cachedUntil: new Date(Date.now() + CACHE_TTL_MS).toISOString()
      };
      return new Response(
        JSON.stringify(emptyResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar pedidos dos últimos 90 dias
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, items, order_date')
      .eq('user_id', user.id)
      .gte('order_date', ninetyDaysAgo.toISOString());

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
    }

    // Calcular velocidade de vendas por produto
    const productVelocity: Record<string, { total30: number; total60: number; total90: number }> = {};
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // Processar itens dos pedidos
    (orders || []).forEach(order => {
      const orderDate = new Date(order.order_date);
      const items = order.items as Array<{ product_id?: string; quantity?: number }> || [];
      
      items.forEach(item => {
        const productId = item.product_id;
        if (!productId) return;
        
        if (!productVelocity[productId]) {
          productVelocity[productId] = { total30: 0, total60: 0, total90: 0 };
        }
        
        const qty = item.quantity || 1;
        productVelocity[productId].total90 += qty;
        if (orderDate >= sixtyDaysAgo) productVelocity[productId].total60 += qty;
        if (orderDate >= thirtyDaysAgo) productVelocity[productId].total30 += qty;
      });
    });

    // Filtrar produtos com estoque baixo ou vendas frequentes
    const criticalProducts = products
      .map(product => {
        const velocity = productVelocity[product.id] || { total30: 0, total60: 0, total90: 0 };
        const velocity30d = velocity.total30 / 30;
        const velocity60d = velocity.total60 / 60;
        const velocity90d = velocity.total90 / 90;
        const dailyVelocity = (velocity30d + velocity60d + velocity90d) / 3 || 0.1; // Mínimo 0.1 para evitar divisão por zero
        const daysToStockout = product.stock / dailyVelocity;
        
        return {
          ...product,
          velocity30d,
          velocity60d,
          velocity90d,
          dailyVelocity,
          daysToStockout
        };
      })
      .sort((a, b) => a.daysToStockout - b.daysToStockout)
      .slice(0, maxProducts);

    // Preparar contexto para a IA
    const productContext = criticalProducts.map(p => 
      `- ${p.name} (${p.category || 'Sem categoria'}): Estoque=${p.stock}, Velocidade=${p.dailyVelocity.toFixed(2)}/dia, Dias para esgotar=${p.daysToStockout.toFixed(0)}`
    ).join('\n');

    // Consultar Perplexity para tendências de mercado
    const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
    let marketInsights = '';
    
    if (perplexityKey && criticalProducts.length > 0) {
      const categories = [...new Set(criticalProducts.map(p => p.category).filter(Boolean))];
      const categoryList = categories.slice(0, 5).join(', ') || 'eletrônicos e acessórios';
      
      try {
        const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${perplexityKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'sonar',
            messages: [
              {
                role: 'system',
                content: 'Você é um analista de mercado especializado em e-commerce brasileiro. Responda de forma concisa e objetiva.'
              },
              {
                role: 'user',
                content: `Analise brevemente as tendências de demanda no Brasil para as categorias: ${categoryList}.

Considere:
1. Eventos sazonais próximos (Black Friday, Natal, etc.)
2. Tendências de consumo atuais
3. Fatores econômicos relevantes

Responda em formato JSON:
{
  "tendencias": [
    {"categoria": "nome", "fator": 1.2, "motivo": "breve explicação"}
  ],
  "eventos_proximos": ["evento1", "evento2"],
  "alerta_geral": "mensagem curta sobre o mercado"
}`
              }
            ],
            max_tokens: 500,
          }),
        });

        if (perplexityResponse.ok) {
          const perplexityData = await perplexityResponse.json();
          marketInsights = perplexityData.choices?.[0]?.message?.content || '';
          console.log('Perplexity insights received');
        }
      } catch (e) {
        console.error('Error fetching Perplexity insights:', e);
      }
    }

    // Usar Lovable AI para processar e gerar previsões estruturadas
    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    let forecasts: ProductForecast[] = [];

    if (lovableKey) {
      try {
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            messages: [
              {
                role: 'system',
                content: `Você é um sistema de previsão de estoque para e-commerce. Analise os dados internos e insights de mercado para gerar previsões precisas.

REGRAS:
- adjustmentFactor: 0.5 (demanda muito baixa) a 2.0 (demanda muito alta)
- urgency: CRITICO (<7 dias ajustados), ATENCAO (7-21 dias), OK (>21 dias)
- confidence: 50-95% baseado na qualidade dos dados
- Seja conservador nas previsões para evitar ruptura de estoque`
              },
              {
                role: 'user',
                content: `DADOS INTERNOS DOS PRODUTOS:
${productContext}

INSIGHTS DE MERCADO (Perplexity):
${marketInsights || 'Não disponível - use apenas dados históricos'}

Gere previsões para cada produto no formato JSON:
{
  "forecasts": [
    {
      "productId": "id",
      "adjustmentFactor": 1.2,
      "marketTrend": "alta|estavel|baixa",
      "confidence": 75,
      "reason": "Motivo da previsão",
      "recommendation": "Recomendação específica",
      "risks": ["risco1", "risco2"]
    }
  ]
}`
              }
            ],
            max_tokens: 2000,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const aiContent = aiData.choices?.[0]?.message?.content || '';
          
          // Extrair JSON da resposta
          const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]);
              const aiForecasts = parsed.forecasts || [];
              
              // Combinar dados internos com insights da IA
              forecasts = criticalProducts.map(product => {
                const aiForecast = aiForecasts.find((f: any) => f.productId === product.id) || {};
                const adjustmentFactor = aiForecast.adjustmentFactor || 1.0;
                const adjustedDaysToStockout = product.daysToStockout / adjustmentFactor;
                
                let urgency: 'CRITICO' | 'ATENCAO' | 'OK' = 'OK';
                if (adjustedDaysToStockout < 7) urgency = 'CRITICO';
                else if (adjustedDaysToStockout < 21) urgency = 'ATENCAO';

                return {
                  productId: product.id,
                  name: product.name,
                  sku: product.sku,
                  category: product.category,
                  currentStock: product.stock,
                  dailyVelocity: product.dailyVelocity,
                  velocity30d: product.velocity30d,
                  velocity60d: product.velocity60d,
                  velocity90d: product.velocity90d,
                  daysToStockout: Math.round(product.daysToStockout),
                  adjustedDaysToStockout: Math.round(adjustedDaysToStockout),
                  marketTrend: aiForecast.marketTrend || 'estavel',
                  adjustmentFactor,
                  urgency,
                  confidence: aiForecast.confidence || 60,
                  reason: aiForecast.reason || 'Baseado em dados históricos de vendas',
                  recommendation: aiForecast.recommendation || `Reabastecer ${Math.ceil(product.dailyVelocity * 30)} unidades`,
                  risks: aiForecast.risks || []
                };
              });
            } catch (parseError) {
              console.error('Error parsing AI response:', parseError);
            }
          }
        } else {
          const errorText = await aiResponse.text();
          console.error('Lovable AI error:', aiResponse.status, errorText);
        }
      } catch (e) {
        console.error('Error calling Lovable AI:', e);
      }
    }

    // Fallback: usar apenas dados internos se IA falhar
    if (forecasts.length === 0) {
      forecasts = criticalProducts.map(product => {
        let urgency: 'CRITICO' | 'ATENCAO' | 'OK' = 'OK';
        if (product.daysToStockout < 7) urgency = 'CRITICO';
        else if (product.daysToStockout < 21) urgency = 'ATENCAO';

        return {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          category: product.category,
          currentStock: product.stock,
          dailyVelocity: product.dailyVelocity,
          velocity30d: product.velocity30d,
          velocity60d: product.velocity60d,
          velocity90d: product.velocity90d,
          daysToStockout: Math.round(product.daysToStockout),
          adjustedDaysToStockout: Math.round(product.daysToStockout),
          marketTrend: 'estavel' as const,
          adjustmentFactor: 1.0,
          urgency,
          confidence: 50,
          reason: 'Baseado apenas em dados históricos internos',
          recommendation: `Reabastecer ${Math.ceil(product.dailyVelocity * 30)} unidades nos próximos 30 dias`,
          risks: product.daysToStockout < 14 ? ['Risco de ruptura de estoque'] : []
        };
      });
    }

    // Calcular sumário
    const summary: ForecastSummary = {
      critical: forecasts.filter(f => f.urgency === 'CRITICO').length,
      attention: forecasts.filter(f => f.urgency === 'ATENCAO').length,
      ok: forecasts.filter(f => f.urgency === 'OK').length,
      totalProducts: products.length,
      potentialLossValue: forecasts
        .filter(f => f.urgency === 'CRITICO')
        .reduce((sum, f) => {
          const product = products.find(p => p.id === f.productId);
          return sum + (product?.selling_price || 0) * f.currentStock;
        }, 0)
    };

    const response: ForecastResponse = {
      forecasts,
      summary,
      lastUpdated: new Date().toISOString(),
      cachedUntil: new Date(Date.now() + CACHE_TTL_MS).toISOString()
    };

    // Salvar no cache em memória
    cache.set(cacheKey, { 
      data: response, 
      expiry: Date.now() + CACHE_TTL_MS 
    });

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Stock forecast error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
