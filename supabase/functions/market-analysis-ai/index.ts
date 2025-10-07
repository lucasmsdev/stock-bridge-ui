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
    const { searchTerm } = await req.json();
    console.log('🔍 Iniciando análise de mercado com IA para:', searchTerm);

    if (!searchTerm || typeof searchTerm !== 'string' || searchTerm.trim() === '') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Termo de busca é obrigatório' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
    if (!perplexityApiKey) {
      console.error('❌ PERPLEXITY_API_KEY não configurada');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Chave da API Perplexity não configurada' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Montar o prompt para a Perplexity
    const prompt = `Analise os preços do produto "${searchTerm}" nos principais marketplaces brasileiros (Mercado Livre, Shopee e Amazon Brasil).

Para cada plataforma, forneça:
1. Nome exato do produto encontrado
2. Preço atual (em reais - R$)
3. Nome do vendedor
4. Link direto do produto

Retorne APENAS um objeto JSON válido com a seguinte estrutura, sem nenhum texto adicional antes ou depois:
{
  "productTitle": "Nome do produto",
  "analysis": [
    {
      "platform": "Mercado Livre",
      "bestOffer": {
        "title": "Nome exato do produto",
        "price": 1234.56,
        "seller": "Nome do vendedor",
        "link": "https://..."
      }
    },
    {
      "platform": "Shopee",
      "bestOffer": {
        "title": "Nome exato do produto",
        "price": 1234.56,
        "seller": "Nome do vendedor",
        "link": "https://..."
      }
    },
    {
      "platform": "Amazon",
      "bestOffer": {
        "title": "Nome exato do produto",
        "price": 1234.56,
        "seller": "Nome do vendedor",
        "link": "https://..."
      }
    }
  ],
  "priceSummary": {
    "lowestPrice": 1234.56,
    "highestPrice": 2345.67,
    "averagePrice": 1789.11
  }
}

IMPORTANTE: 
- Retorne SOMENTE o JSON, sem markdown, sem explicações, sem texto antes ou depois
- Os preços devem ser números (float), não strings
- Busque as ofertas mais recentes e relevantes
- Se não encontrar em alguma plataforma, omita ela do array analysis`;

    console.log('🤖 Enviando requisição para Perplexity API...');
    
    const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-large-128k-online',
        messages: [
          {
            role: 'system',
            content: 'Você é um assistente especializado em pesquisa de preços em e-commerce brasileiro. Retorne sempre respostas em JSON válido, sem nenhum texto adicional.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        top_p: 0.9,
        max_tokens: 2000,
        return_images: false,
        return_related_questions: false,
        search_recency_filter: 'week',
      }),
    });

    if (!perplexityResponse.ok) {
      const errorText = await perplexityResponse.text();
      console.error('❌ Erro da Perplexity API:', perplexityResponse.status, errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Erro ao consultar a API de busca. Tente novamente.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const perplexityData = await perplexityResponse.json();
    console.log('📥 Resposta da Perplexity recebida');

    const aiResponse = perplexityData.choices?.[0]?.message?.content;
    if (!aiResponse) {
      console.error('❌ Resposta vazia da Perplexity');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Nenhum resultado encontrado' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    console.log('📄 Resposta da IA:', aiResponse.substring(0, 200) + '...');

    // Extrair JSON da resposta (remove markdown se houver)
    let jsonResponse = aiResponse.trim();
    if (jsonResponse.startsWith('```json')) {
      jsonResponse = jsonResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    } else if (jsonResponse.startsWith('```')) {
      jsonResponse = jsonResponse.replace(/```\n?/g, '').trim();
    }

    let analysisData;
    try {
      analysisData = JSON.parse(jsonResponse);
      console.log('✅ JSON parseado com sucesso');
    } catch (parseError) {
      console.error('❌ Erro ao parsear JSON:', parseError);
      console.error('Resposta recebida:', jsonResponse);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Erro ao processar os resultados da análise' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Validar estrutura
    if (!analysisData.productTitle || !analysisData.analysis || !Array.isArray(analysisData.analysis)) {
      console.error('❌ Estrutura de dados inválida');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Estrutura de dados inválida retornada pela IA' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('✅ Análise concluída com sucesso');
    console.log(`📊 Produto: ${analysisData.productTitle}`);
    console.log(`🏪 Plataformas encontradas: ${analysisData.analysis.length}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        step: 'analysis',
        data: analysisData
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
