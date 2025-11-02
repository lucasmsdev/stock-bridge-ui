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
    const prompt = `Você DEVE pesquisar o produto "${searchTerm}" em TODAS as seguintes plataformas de e-commerce:

1. Mercado Livre Brasil (mercadolivre.com.br)
2. Shopee Brasil (shopee.com.br)
3. Amazon Brasil (amazon.com.br)
4. Shopify (lojas brasileiras usando shopify.com)
5. Magazine Luiza/Magalu (magazineluiza.com.br)
6. Americanas (americanas.com.br)

Para cada plataforma onde o produto for encontrado, forneça:
- Nome exato do produto
- Preço atual em reais (R$)
- Nome do vendedor/loja
- Link direto do produto

Retorne APENAS um objeto JSON válido com esta estrutura exata, sem markdown, sem texto adicional:

{
  "productTitle": "Nome genérico do produto pesquisado",
  "analysis": [
    {
      "platform": "Nome da Plataforma",
      "bestOffer": {
        "title": "Nome completo do produto encontrado",
        "price": 1234.56,
        "seller": "Nome do vendedor",
        "link": "https://url-direta-do-produto"
      }
    }
  ],
  "priceSummary": {
    "lowestPrice": 1234.56,
    "highestPrice": 2345.67,
    "averagePrice": 1789.11
  }
}

REGRAS OBRIGATÓRIAS:
- Pesquise em TODAS as 6 plataformas listadas acima
- Inclua no array "analysis" TODAS as plataformas onde encontrar o produto
- Use os nomes exatos das plataformas: "Mercado Livre", "Shopee", "Amazon", "Shopify", "Magazine Luiza", "Americanas"
- Preços devem ser números decimais (float), não strings
- Links devem ser URLs reais e diretas dos produtos
- Se não encontrar em alguma plataforma específica, não inclua ela no array
- Retorne SOMENTE o JSON puro, sem blocos de código markdown, sem explicações, sem texto antes ou depois`;

    console.log('🤖 Enviando requisição para Perplexity API...');
    
    const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: 'Você é um assistente de pesquisa de preços que DEVE buscar produtos em TODAS as principais plataformas de e-commerce brasileiro. Sempre retorne JSON válido sem markdown ou texto adicional. Busque em: Mercado Livre, Shopee, Amazon, Shopify, Magazine Luiza e Americanas.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 3000,
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

    // Manter os links originais da IA (são mais específicos que buscas genéricas)
    const searchQuery = encodeURIComponent(searchTerm);
    analysisData.analysis = analysisData.analysis.map((item: any) => {
      // Se a IA não forneceu link válido, usar link de busca genérico
      if (!item.bestOffer.link || item.bestOffer.link === '#' || !item.bestOffer.link.startsWith('http')) {
        let searchLink = '';
        
        switch (item.platform) {
          case 'Mercado Livre':
            searchLink = `https://lista.mercadolivre.com.br/${searchQuery}`;
            break;
          case 'Shopee':
            searchLink = `https://shopee.com.br/search?keyword=${searchQuery}`;
            break;
          case 'Amazon':
            searchLink = `https://www.amazon.com.br/s?k=${searchQuery}`;
            break;
          case 'Shopify':
            searchLink = `https://www.google.com/search?q=${searchQuery}+site:myshopify.com`;
            break;
          case 'Magazine Luiza':
            searchLink = `https://www.magazineluiza.com.br/busca/${searchQuery}`;
            break;
          case 'Americanas':
            searchLink = `https://www.americanas.com.br/busca/${searchQuery}`;
            break;
          default:
            searchLink = `https://www.google.com/search?q=${searchQuery}`;
        }
        
        return {
          ...item,
          bestOffer: {
            ...item.bestOffer,
            link: searchLink
          }
        };
      }
      
      // Manter link original da IA se for válido
      return item;
    });

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
