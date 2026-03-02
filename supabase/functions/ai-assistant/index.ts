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
    const body = await req.json();
    
    // Suporte a ambos os formatos: { messages: [...] } e { question: "..." }
    let conversationMessages: Array<{ role: string; content: string }> = [];
    
    if (body.messages && Array.isArray(body.messages)) {
      conversationMessages = body.messages;
    } else if (body.question && typeof body.question === 'string') {
      conversationMessages = [{ role: 'user', content: body.question }];
    }

    if (conversationMessages.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Mensagens são obrigatórias' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('🤖 Mensagens recebidas:', conversationMessages.length);

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
    
    // Buscar plano do usuário via organização
    const { data: orgData } = await supabase
      .from('organization_members')
      .select('organization_id, organizations(plan)')
      .eq('user_id', user.id)
      .maybeSingle();

    // Verificar se é admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    const isAdmin = roleData?.role === 'admin';
    const userPlan = orgData?.organizations?.plan || 'iniciante';
    const planConfig = AI_LIMITS[userPlan] || AI_LIMITS['iniciante'];
    const organizationId = orgData?.organization_id || null;

    console.log('📋 Plano:', userPlan, 'Admin:', isAdmin);

    // Admin tem acesso ilimitado
    if (!isAdmin) {
      if (planConfig.limit === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Faça upgrade para o plano Profissional para acessar a IA', code: 'NO_ACCESS' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        );
      }

      if (planConfig.limit !== -1) {
        const monthYear = getCurrentMonthYear();
        
        // Buscar uso atual da organização
        const usageFilter = organizationId 
          ? supabase.from('ai_usage').select('id, query_count').eq('organization_id', organizationId).eq('month_year', monthYear).maybeSingle()
          : supabase.from('ai_usage').select('id, query_count').eq('user_id', user.id).eq('month_year', monthYear).maybeSingle();

        const { data: usageData } = await usageFilter;

        const currentUsage = usageData?.query_count || 0;
        console.log('📊 Uso atual:', currentUsage, '/', planConfig.limit);

        if (currentUsage >= planConfig.limit) {
          await createAILimitNotification(supabase, user.id, '100_percent', currentUsage, planConfig.limit);
          return new Response(
            JSON.stringify({ success: false, error: `Limite de ${planConfig.limit} consultas atingido`, code: 'QUOTA_EXCEEDED', usage: currentUsage, limit: planConfig.limit }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
          );
        }

        // Incrementar uso
        const newUsage = currentUsage + 1;
        if (usageData) {
          await supabase.from('ai_usage').update({ query_count: newUsage }).eq('id', usageData.id);
        } else {
          await supabase.from('ai_usage').insert({
            user_id: user.id,
            organization_id: organizationId,
            month_year: monthYear,
            query_count: 1
          });
        }
        console.log('✅ Uso incrementado para:', newUsage);

        // Verificar thresholds para notificações
        const percentUsed = (newUsage / planConfig.limit) * 100;
        if (percentUsed >= 80 && percentUsed < 100) {
          const previousPercent = (currentUsage / planConfig.limit) * 100;
          if (previousPercent < 80) {
            await createAILimitNotification(supabase, user.id, '80_percent', newUsage, planConfig.limit);
          }
        }
        if (newUsage >= planConfig.limit) {
          await createAILimitNotification(supabase, user.id, '100_percent', newUsage, planConfig.limit);
        }
      }
    }

    // Selecionar modelo baseado no plano
    const aiModel = isAdmin ? 'sonar-pro' : planConfig.model;
    console.log('🧠 Modelo selecionado:', aiModel);

    // ========== BUSCAR DADOS EXPANDIDOS DO USUÁRIO ==========
    
    const userIdFilter = organizationId 
      ? { key: 'organization_id', value: organizationId }
      : { key: 'user_id', value: user.id };

    const [productsResult, ordersResult, integrationsResult, expensesResult, suppliersResult] = await Promise.all([
      supabase.from('products').select('*').eq(userIdFilter.key, userIdFilter.value).limit(200),
      supabase.from('orders').select('*').eq(userIdFilter.key, userIdFilter.value).order('order_date', { ascending: false }).limit(300),
      supabase.from('integrations').select('platform, account_name').eq('user_id', user.id),
      supabase.from('expenses').select('name, amount, category, recurrence, is_active').eq(userIdFilter.key, userIdFilter.value).eq('is_active', true),
      supabase.from('suppliers').select('name, contact_name, payment_terms, is_active').eq(userIdFilter.key, userIdFilter.value).eq('is_active', true)
    ]);

    const products = productsResult.data || [];
    const orders = ordersResult.data || [];
    const integrations = integrationsResult.data || [];
    const expenses = expensesResult.data || [];
    const suppliers = suppliersResult.data || [];

    console.log(`📦 ${products.length} produtos | 📋 ${orders.length} pedidos | 💰 ${expenses.length} despesas | 🏭 ${suppliers.length} fornecedores`);

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

    const criticalProducts = productSalesVelocity.filter(p => p.needsRestock);
    
    const productsWithMargin = products.map(p => {
      const cost = Number(p.cost_price) || 0;
      const price = Number(p.selling_price) || 0;
      const adSpend = Number(p.ad_spend) || 0;
      const margin = price > 0 ? ((price - cost - adSpend) / price * 100).toFixed(1) : '0';
      return { name: p.name, sku: p.sku, margin, isUnprofitable: Number(margin) < 10 };
    });

    // Preparar contexto expandido
    const dataContext = `
DADOS DO USUÁRIO (atualizado em ${now.toLocaleDateString('pt-BR')}):

PRODUTOS (${products.length} total):
${products.slice(0, 100).map(p => {
  const velocity = productSalesVelocity.find(v => v.sku === p.sku);
  const margin = productsWithMargin.find(m => m.sku === p.sku);
  return `- ${p.name} (SKU: ${p.sku}, ID: ${p.id})
  • Estoque: ${p.stock} | Preço: R$ ${p.selling_price || 0} | Custo: R$ ${p.cost_price || 0}
  • Margem: ${margin?.margin}% | Vendidos 30d: ${velocity?.totalSold30Days || 0}
  • Dias p/ esgotar: ${velocity?.daysUntilStockOut === Infinity ? 'N/A' : velocity?.daysUntilStockOut}
  • Anúncios: R$ ${p.ad_spend || 0}`;
}).join('\n')}

PEDIDOS (${orders.length} total, ${recentOrders.length} últimos 30 dias):
${orders.slice(0, 200).map(o => `- ${o.order_id_channel} (${o.platform}): R$ ${o.total_value} | ${new Date(o.order_date).toLocaleDateString('pt-BR')} | Status: ${o.status || 'N/A'}`).join('\n')}

DESPESAS FIXAS (${expenses.length} ativas):
${expenses.map(e => `- ${e.name}: R$ ${e.amount} (${e.category}, ${e.recurrence})`).join('\n') || 'Nenhuma despesa cadastrada'}

FORNECEDORES (${suppliers.length} ativos):
${suppliers.map(s => `- ${s.name}${s.contact_name ? ` (${s.contact_name})` : ''}${s.payment_terms ? ` | Pgto: ${s.payment_terms}` : ''}`).join('\n') || 'Nenhum fornecedor cadastrado'}

INTEGRAÇÕES ATIVAS:
${integrations.map(i => `- ${i.platform}${i.account_name ? ` (${i.account_name})` : ''}`).join('\n') || 'Nenhuma integração'}

ANÁLISE RÁPIDA:
- Total de produtos: ${products.length}
- Estoque baixo (< 10): ${products.filter(p => p.stock < 10).length}
- Produtos críticos: ${criticalProducts.length}${criticalProducts.length > 0 ? ' → ' + criticalProducts.map(p => `${p.name} (${p.daysUntilStockOut}d)`).join(', ') : ''}
- Margem baixa (< 10%): ${productsWithMargin.filter(p => p.isUnprofitable).length}
- Receita total: R$ ${orders.reduce((sum, o) => sum + Number(o.total_value), 0).toFixed(2)}
- Receita 30 dias: R$ ${recentOrders.reduce((sum, o) => sum + Number(o.total_value), 0).toFixed(2)}
- Despesas fixas mensais: R$ ${expenses.reduce((sum, e) => sum + Number(e.amount), 0).toFixed(2)}
`;

    // Chamar Perplexity API com streaming
    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
    if (!perplexityApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Chave da API não configurada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const systemPrompt = `Você é a Uni, uma Estrategista de Crescimento Autônomo para e-commerce, integrada ao UniStock.
Você tem acesso COMPLETO aos dados de produtos, pedidos, despesas e fornecedores do usuário.

SUAS CAPACIDADES ESTRATÉGICAS:

1. EXPANSÃO DE MERCADO:
   - Identifique produtos com alto volume e boa margem para expandir para outras plataformas
   - Sugira quando e onde lançar baseado em demanda e concorrência

2. CRIAÇÃO DE KITS E BUNDLES:
   - Identifique produtos comprados juntos frequentemente
   - Calcule potencial de aumento do ticket médio

3. ANÁLISE DE CONCORRÊNCIA E TENDÊNCIAS:
   - Alerte sobre tendências emergentes
   - Sugira ajustes estratégicos

4. OTIMIZAÇÃO AVANÇADA:
   - Precificação dinâmica baseada em margem e competitividade
   - Gestão estratégica de estoque com alertas preditivos
   - Análise de lucratividade considerando despesas fixas

AÇÕES EXECUTÁVEIS:
Quando recomendar uma alteração concreta em um produto (preço ou estoque), inclua um bloco de ação no formato abaixo APÓS sua explicação. O sistema vai renderizar um botão para o usuário executar com 1 clique.

Formato:
:::action
{"type":"update_price","product_id":"uuid-do-produto","sku":"SKU123","product_name":"Nome do Produto","new_value":32.90,"label":"Aplicar: R$ 32,90"}
:::

:::action
{"type":"update_stock","product_id":"uuid-do-produto","sku":"SKU123","product_name":"Nome do Produto","new_value":50,"label":"Aplicar: Estoque 50"}
:::

Tipos de ação suportados:
- update_price: altera o preço de venda (selling_price)
- update_stock: altera o estoque (modo "set")

REGRAS DE AÇÕES:
- Só emita ações quando tiver dados concretos (product_id real do contexto, valores calculados)
- Sempre explique o motivo ANTES do bloco de ação
- Use o product_id real dos dados do contexto (o campo ID), nunca invente
- O label deve ser curto e claro para o botão
- Cada bloco :::action deve conter exatamente um JSON válido em uma única linha

DIRETRIZES:
- Seja PROATIVA: identifique oportunidades automaticamente
- Seja ESPECÍFICA: use números reais, porcentagens, projeções concretas
- Seja ACIONÁVEL: toda análise deve ter uma recomendação prática
- Responda sempre em português brasileiro
- Formate valores como R$ X,XX
- Use markdown para formatar: **negrito**, listas, tabelas quando apropriado
- Quando identificar oportunidades, apresente: dados + impacto + ação sugerida

${dataContext}`;

    // Montar array de mensagens para a API
    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...conversationMessages.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
      }))
    ];

    console.log('🤖 Enviando para Perplexity com streaming, modelo:', aiModel, 'mensagens:', apiMessages.length);
    
    const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: aiModel,
        messages: apiMessages,
        temperature: 0.3,
        max_tokens: 2000,
        stream: true,
      }),
    });

    if (!perplexityResponse.ok) {
      const errorText = await perplexityResponse.text();
      console.error('❌ Erro da Perplexity API:', perplexityResponse.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao consultar assistente de IA. Tente novamente.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('✅ Stream iniciado com sucesso');

    // Repassar o stream SSE diretamente da Perplexity para o frontend
    return new Response(perplexityResponse.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('💥 Erro inesperado:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erro inesperado no servidor' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
