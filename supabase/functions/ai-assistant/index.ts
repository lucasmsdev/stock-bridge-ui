import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { question } = await req.json();
    console.log('🤖 Pergunta recebida:', question);

    if (!question || typeof question !== 'string' || question.trim() === '') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Pergunta é obrigatória' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Obter token de autorização
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extrair JWT e obter user_id
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    
    if (userError || !user) {
      console.error('❌ Erro ao obter usuário:', userError);
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário não autenticado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    console.log('👤 Usuário autenticado:', user.id);

    // Buscar dados do usuário
    const [productsResult, ordersResult, integrationsResult] = await Promise.all([
      supabase.from('products').select('*').eq('user_id', user.id),
      supabase.from('orders').select('*').eq('user_id', user.id).order('order_date', { ascending: false }).limit(100),
      supabase.from('integrations').select('platform, account_name').eq('user_id', user.id)
    ]);

    if (productsResult.error) {
      console.error('❌ Erro ao buscar produtos:', productsResult.error);
    }
    if (ordersResult.error) {
      console.error('❌ Erro ao buscar pedidos:', ordersResult.error);
    }
    if (integrationsResult.error) {
      console.error('❌ Erro ao buscar integrações:', integrationsResult.error);
    }

    const products = productsResult.data || [];
    const orders = ordersResult.data || [];
    const integrations = integrationsResult.data || [];

    console.log(`📦 ${products.length} produtos encontrados`);
    console.log(`📋 ${orders.length} pedidos encontrados`);
    console.log(`🔌 ${integrations.length} integrações encontradas`);

    // Calcular métricas avançadas
    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentOrders = orders.filter(o => new Date(o.order_date) >= last30Days);
    
    // Calcular velocidade de vendas por produto
    const productSalesVelocity = products.map(p => {
      const productOrders = recentOrders.filter(o => 
        o.items && Array.isArray(o.items) && o.items.some((item: any) => item.sku === p.sku)
      );
      const totalSold = productOrders.reduce((sum, o) => {
        const item = o.items.find((i: any) => i.sku === p.sku);
        return sum + (item?.quantity || 0);
      }, 0);
      const daysUntilStockOut = totalSold > 0 ? Math.floor((p.stock / totalSold) * 30) : Infinity;
      
      return {
        sku: p.sku,
        name: p.name,
        totalSold30Days: totalSold,
        daysUntilStockOut,
        needsRestock: daysUntilStockOut < 15 && daysUntilStockOut !== Infinity
      };
    });

    // Identificar produtos críticos
    const criticalProducts = productSalesVelocity.filter(p => p.needsRestock);
    
    // Calcular margem de lucro
    const productsWithMargin = products.map(p => {
      const cost = Number(p.cost_price) || 0;
      const price = Number(p.selling_price) || 0;
      const adSpend = Number(p.ad_spend) || 0;
      const margin = price > 0 ? ((price - cost - adSpend) / price * 100).toFixed(1) : 0;
      return {
        name: p.name,
        sku: p.sku,
        margin,
        isUnprofitable: Number(margin) < 10
      };
    });

    // Preparar contexto dos dados
    const dataContext = `
DADOS DO USUÁRIO:

PRODUTOS (${products.length} total):
${products.slice(0, 50).map(p => {
  const velocity = productSalesVelocity.find(v => v.sku === p.sku);
  const margin = productsWithMargin.find(m => m.sku === p.sku);
  return `- ${p.name} (SKU: ${p.sku})
  • Estoque: ${p.stock} unidades
  • Preço: R$ ${p.selling_price || 0} | Custo: R$ ${p.cost_price || 0}
  • Margem: ${margin?.margin}%
  • Vendidos (30 dias): ${velocity?.totalSold30Days || 0}
  • Dias até esgotar: ${velocity?.daysUntilStockOut === Infinity ? 'N/A' : velocity?.daysUntilStockOut}
  • Gasto em anúncios: R$ ${p.ad_spend || 0}`;
}).join('\n\n')}

PEDIDOS RECENTES (${orders.length} total, ${recentOrders.length} nos últimos 30 dias):
${orders.slice(0, 30).map(o => `- Pedido ${o.order_id_channel} (${o.platform}): R$ ${o.total_value} em ${new Date(o.order_date).toLocaleDateString('pt-BR')}`).join('\n')}

INTEGRAÇÕES ATIVAS:
${integrations.map(i => `- ${i.platform}${i.account_name ? ` (${i.account_name})` : ''}`).join('\n')}

ANÁLISE RÁPIDA:
- Total de produtos: ${products.length}
- Produtos com estoque baixo (< 10): ${products.filter(p => p.stock < 10).length}
- Produtos críticos (precisam reposição urgente): ${criticalProducts.length}
${criticalProducts.length > 0 ? '\n  CRÍTICOS: ' + criticalProducts.map(p => `${p.name} (${p.daysUntilStockOut} dias)`).join(', ') : ''}
- Produtos com margem baixa (< 10%): ${productsWithMargin.filter(p => p.isUnprofitable).length}
- Total de pedidos: ${orders.length}
- Pedidos últimos 30 dias: ${recentOrders.length}
- Receita total: R$ ${orders.reduce((sum, o) => sum + Number(o.total_value), 0).toFixed(2)}
- Receita últimos 30 dias: R$ ${recentOrders.reduce((sum, o) => sum + Number(o.total_value), 0).toFixed(2)}
`;

    // Chamar Perplexity API
    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
    if (!perplexityApiKey) {
      console.error('❌ PERPLEXITY_API_KEY não configurada');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Chave da API não configurada' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const systemPrompt = `Você é um assistente inteligente de e-commerce e otimização de vendas. 
Você tem acesso aos dados de produtos, pedidos e integrações do usuário.

SUAS CAPACIDADES:
1. ANÁLISE DE DADOS: Responda perguntas sobre vendas, produtos, estoque e performance
2. OTIMIZAÇÃO DE ANÚNCIOS: Sugira melhorias em títulos, descrições e estratégias de listing
3. PRECIFICAÇÃO DINÂMICA: Recomende preços competitivos baseado em análise de mercado
4. GESTÃO DE ESTOQUE: Alerte sobre produtos com baixo estoque e sugira reposições
5. INSIGHTS ESTRATÉGICOS: Identifique oportunidades de crescimento e melhorias

DIRETRIZES:
- Seja proativo: se identificar problemas nos dados, alerte o usuário
- Seja específico: use números, porcentagens e dados concretos
- Seja prático: ofereça sugestões acionáveis, não apenas análises
- Para otimizações, explique o raciocínio por trás de cada sugestão
- Para alertas de estoque, calcule quantos dias até esgotar baseado na velocidade de vendas
- Para precificação, considere custos, margem e competitividade
- Responda sempre em português brasileiro
- Formate valores monetários como R$ X,XX
- Quando sugerir ações, pergunte se o usuário quer que você ajude a executar

EXEMPLOS DE RESPOSTAS PROATIVAS:
- "Identifiquei que o produto X está com estoque de apenas 5 unidades. Baseado nas vendas dos últimos 30 dias, ele irá esgotar em aproximadamente 7 dias. Recomendo fazer uma reposição urgente."
- "O produto Y está precificado 15% acima da média do mercado. Sugiro ajustar para R$ XXX para aumentar competitividade."
- "Seus anúncios na plataforma Z têm títulos muito curtos. Posso sugerir melhorias para aumentar a visibilidade?"

    console.log('🤖 Enviando requisição para Perplexity API...');
    
    const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: `${dataContext}\n\nPERGUNTA DO USUÁRIO: ${question}`
          }
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!perplexityResponse.ok) {
      const errorText = await perplexityResponse.text();
      console.error('❌ Erro da Perplexity API:', perplexityResponse.status, errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Erro ao consultar assistente de IA. Tente novamente.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const perplexityData = await perplexityResponse.json();
    console.log('📥 Resposta da Perplexity recebida');

    const answer = perplexityData.choices?.[0]?.message?.content;
    if (!answer) {
      console.error('❌ Resposta vazia da Perplexity');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Nenhuma resposta recebida' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    console.log('✅ Resposta gerada com sucesso');

    return new Response(
      JSON.stringify({ 
        success: true,
        answer: answer
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 Erro inesperado:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Erro inesperado no servidor' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
