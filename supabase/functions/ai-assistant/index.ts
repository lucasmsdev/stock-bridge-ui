import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Limites de IA por plano
const AI_LIMITS: Record<string, { limit: number; model: string }> = {
  'iniciante': { limit: 0, model: 'sonar' },
  'profissional': { limit: 50, model: 'sonar' },
  'enterprise': { limit: 200, model: 'sonar-pro' },
  'unlimited': { limit: -1, model: 'sonar-pro' },
};

const getCurrentMonthYear = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

// Função para criar notificação de limite de IA
const createAILimitNotification = async (
  supabase: any, 
  userId: string, 
  type: '80_percent' | '100_percent',
  currentUsage: number,
  limit: number
) => {
  const monthYear = getCurrentMonthYear();
  const notificationId = `ai_limit_${type}_${monthYear}`;
  
  // Verificar se já enviou essa notificação este mês
  const { data: existingNotification } = await supabase
    .from('notifications')
    .select('id')
    .eq('user_id', userId)
    .like('title', type === '80_percent' ? '%80%' : '%100%')
    .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
    .maybeSingle();

  if (existingNotification) {
    console.log(`📬 Notificação de ${type} já enviada este mês`);
    return;
  }

  const notifications = {
    '80_percent': {
      title: '⚠️ 80% do limite de IA usado',
      message: `Você usou ${currentUsage} de ${limit} consultas de IA disponíveis este mês. Considere fazer upgrade para mais consultas.`,
      type: 'ai_quota_warning'
    },
    '100_percent': {
      title: '🚫 Limite de consultas IA atingido',
      message: `Você atingiu o limite de ${limit} consultas de IA este mês. Faça upgrade para continuar usando ou aguarde a renovação no próximo mês.`,
      type: 'ai_quota_exceeded'
    }
  };

  const notif = notifications[type];

  const { error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      title: notif.title,
      message: notif.message,
      type: notif.type,
      is_read: false
    });

  if (error) {
    console.error('❌ Erro ao criar notificação:', error);
  } else {
    console.log(`✅ Notificação de ${type} criada com sucesso`);
  }
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

    // ========== VERIFICAÇÃO DE QUOTA ==========
    
    // Buscar plano do usuário
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('❌ Erro ao buscar perfil:', profileError);
    }

    // Verificar se é admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    const isAdmin = roleData?.role === 'admin';
    const userPlan = profileData?.plan || 'iniciante';
    const planConfig = AI_LIMITS[userPlan] || AI_LIMITS['iniciante'];

    console.log('📋 Plano do usuário:', userPlan, 'Admin:', isAdmin);

    // Admin tem acesso ilimitado
    if (!isAdmin) {
      // Verificar se tem acesso à feature
      if (planConfig.limit === 0) {
        console.log('⛔ Usuário sem acesso à IA (plano iniciante)');
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Faça upgrade para o plano Profissional para acessar a IA',
            code: 'NO_ACCESS'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        );
      }

      // Verificar quota (se não é ilimitado)
      if (planConfig.limit !== -1) {
        const monthYear = getCurrentMonthYear();
        
        // Buscar uso atual
        const { data: usageData } = await supabase
          .from('ai_usage')
          .select('query_count')
          .eq('user_id', user.id)
          .eq('month_year', monthYear)
          .maybeSingle();

        const currentUsage = usageData?.query_count || 0;
        console.log('📊 Uso atual:', currentUsage, '/', planConfig.limit);

        if (currentUsage >= planConfig.limit) {
          console.log('⛔ Limite de consultas atingido');
          
          // Criar notificação de 100% se ainda não existe
          await createAILimitNotification(supabase, user.id, '100_percent', currentUsage, planConfig.limit);
          
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: `Você atingiu o limite de ${planConfig.limit} consultas este mês`,
              code: 'QUOTA_EXCEEDED',
              usage: currentUsage,
              limit: planConfig.limit
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
          );
        }

        // Incrementar uso
        const newUsage = currentUsage + 1;
        if (usageData) {
          await supabase
            .from('ai_usage')
            .update({ query_count: newUsage })
            .eq('user_id', user.id)
            .eq('month_year', monthYear);
        } else {
          await supabase
            .from('ai_usage')
            .insert({
              user_id: user.id,
              month_year: monthYear,
              query_count: 1
            });
        }
        console.log('✅ Uso incrementado para:', newUsage);

        // ========== VERIFICAR THRESHOLDS PARA NOTIFICAÇÕES ==========
        const percentUsed = (newUsage / planConfig.limit) * 100;
        
        // Notificação de 80% (quando cruza o threshold)
        if (percentUsed >= 80 && percentUsed < 100) {
          const previousPercent = (currentUsage / planConfig.limit) * 100;
          if (previousPercent < 80) {
            console.log('📬 Enviando notificação de 80%');
            await createAILimitNotification(supabase, user.id, '80_percent', newUsage, planConfig.limit);
          }
        }
        
        // Notificação de 100% (quando atinge exatamente o limite)
        if (newUsage >= planConfig.limit) {
          console.log('📬 Enviando notificação de 100%');
          await createAILimitNotification(supabase, user.id, '100_percent', newUsage, planConfig.limit);
        }
      }
    }

    // Selecionar modelo baseado no plano
    const aiModel = isAdmin ? 'sonar-pro' : planConfig.model;
    console.log('🧠 Modelo selecionado:', aiModel);

    // ========== BUSCAR DADOS DO USUÁRIO ==========
    
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

    const systemPrompt = `Você é o Luca, um Estrategista de Crescimento Autônomo para e-commerce.
Você age como um consultor de negócios estratégico, identificando oportunidades que o lojista nem sabia que existiam.
Você tem acesso aos dados completos de produtos, pedidos e integrações do usuário.

SUAS CAPACIDADES ESTRATÉGICAS (NÍVEL 3):

1. EXPANSÃO DE MERCADO:
   - Identifique produtos com alto volume de vendas e boa margem
   - Analise oportunidades de expandir para outras plataformas
   - Sugira quando e onde lançar produtos baseado em demanda e concorrência
   - Crie rascunhos de anúncios otimizados para novas plataformas

2. CRIAÇÃO DE KITS E BUNDLES:
   - Identifique produtos frequentemente comprados juntos
   - Calcule potencial de aumento do ticket médio
   - Sugira combinações estratégicas com descontos inteligentes
   - Proponha nomes e descrições para os kits

3. ANÁLISE DE CONCORRÊNCIA E TENDÊNCIAS:
   - Alerte sobre tendências emergentes no mercado
   - Identifique categorias em crescimento
   - Sugira ajustes estratégicos baseado em movimentos da concorrência
   - Relacione produtos do lojista com tendências atuais

4. OTIMIZAÇÃO AVANÇADA:
   - Precificação dinâmica baseada em margem e competitividade
   - Gestão estratégica de estoque com alertas preditivos
   - Otimização de anúncios com foco em conversão

DIRETRIZES DE ATUAÇÃO:
- Seja PROATIVO: não espere perguntas, identifique oportunidades automaticamente
- Seja ESTRATÉGICO: pense como um consultor de negócios, não apenas um assistente
- Seja ESPECÍFICO: use números reais, porcentagens, projeções concretas
- Seja ACIONÁVEL: toda análise deve ter uma recomendação prática
- Seja PERSUASIVO: explique o PORQUÊ e o impacto de cada sugestão
- Responda sempre em português brasileiro
- Formate valores monetários como R$ X,XX
- Quando identificar oportunidades, apresente dados + impacto + ação sugerida

EXEMPLOS DE RESPOSTAS ESTRATÉGICAS:

EXPANSÃO:
"Notei que você tem um volume alto de vendas do '[Produto X]' com uma margem de lucro de [Y]%. A busca por este produto na [Plataforma] cresceu 30% no último mês e há poucos vendedores com boa reputação. Esta é uma excelente oportunidade para expandir. Quer que eu crie um rascunho do anúncio para a [Plataforma] com base no seu anúncio de maior sucesso?"

KITS/BUNDLES:
"Identifiquei que [X]% dos clientes que compram '[Produto A]' também compram '[Produto B]'. Você pode aumentar seu ticket médio em [Y]% se criar um kit '[Nome do Kit]' com [Z]% de desconto. Isso manteria sua margem em [W]% e tornaria a oferta muito mais atrativa. Quer que eu crie este kit em todas as plataformas?"

TENDÊNCIAS:
"Alerta de tendência: o termo '[tendência]' está em alta. Seus produtos '[Produto X]' e '[Produto Y]' se encaixam perfeitamente nessa tendência. Sugiro criar uma campanha de marketing focada nesses itens e ajustar os títulos dos anúncios para capturar essa demanda crescente. Posso sugerir os novos títulos?"

SEMPRE QUE POSSÍVEL:
- Calcule o impacto financeiro estimado (aumento de receita, ticket médio, etc.)
- Ofereça próximos passos concretos
- Pergunte se o usuário quer ajuda para executar a ação`;

    console.log('🤖 Enviando requisição para Perplexity API com modelo:', aiModel);
    
    const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: aiModel,
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
        answer: answer,
        model: aiModel
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