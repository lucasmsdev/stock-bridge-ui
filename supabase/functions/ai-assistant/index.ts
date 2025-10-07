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

    // Preparar contexto dos dados
    const dataContext = `
DADOS DO USUÁRIO:

PRODUTOS (${products.length} total):
${products.slice(0, 50).map(p => `- ${p.name} (SKU: ${p.sku}): Estoque ${p.stock}, Custo R$ ${p.cost_price || 0}, Venda R$ ${p.selling_price || 0}, Gasto em anúncios R$ ${p.ad_spend || 0}`).join('\n')}

PEDIDOS RECENTES (${orders.length} total):
${orders.slice(0, 30).map(o => `- Pedido ${o.order_id_channel} (${o.platform}): R$ ${o.total_value} em ${new Date(o.order_date).toLocaleDateString('pt-BR')}`).join('\n')}

INTEGRAÇÕES ATIVAS:
${integrations.map(i => `- ${i.platform}${i.account_name ? ` (${i.account_name})` : ''}`).join('\n')}

ESTATÍSTICAS RÁPIDAS:
- Total de produtos: ${products.length}
- Produtos com estoque baixo (< 10): ${products.filter(p => p.stock < 10).length}
- Total de pedidos: ${orders.length}
- Receita total dos pedidos: R$ ${orders.reduce((sum, o) => sum + Number(o.total_value), 0).toFixed(2)}
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

    const systemPrompt = `Você é um assistente de análise de dados para uma plataforma de e-commerce. 
Você tem acesso aos dados de produtos, pedidos e integrações do usuário.
Analise os dados fornecidos e responda às perguntas do usuário de forma clara e objetiva.
Use números, porcentagens e insights relevantes.
Se não houver dados suficientes para responder, seja honesto e sugira o que o usuário pode fazer.
Responda sempre em português brasileiro.
Formate valores monetários como R$ X,XX.
Quando mencionar produtos, use seus nomes completos.`;

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
