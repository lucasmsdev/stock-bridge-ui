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

    // Montar o prompt otimizado para a Perplexity
    const prompt = `TAREFA: Pesquise o produto "${searchTerm}" nas 6 principais plataformas de e-commerce brasileiras e retorne os resultados em JSON.

PLATAFORMAS OBRIGATÓRIAS (pesquise em TODAS):
1. Mercado Livre (mercadolivre.com.br) - use: site:mercadolivre.com.br "${searchTerm}"
2. Shopee (shopee.com.br) - use: site:shopee.com.br "${searchTerm}"
3. Amazon Brasil (amazon.com.br) - use: site:amazon.com.br "${searchTerm}"
4. Magazine Luiza (magazineluiza.com.br) - use: site:magazineluiza.com.br "${searchTerm}"
5. Americanas (americanas.com.br) - use: site:americanas.com.br "${searchTerm}"
6. Lojas Shopify brasileiras (.myshopify.com) - use: site:myshopify.com "${searchTerm}" brasil

INSTRUÇÕES DE BUSCA:
- Faça uma busca WEB específica em CADA plataforma usando os termos site: acima
- Para cada plataforma, encontre o produto com melhor preço disponível
- Extraia o link REAL e COMPLETO do produto (URL completa começando com https://)
- Se a plataforma não tiver o produto, NÃO a inclua no resultado

FORMATO DE SAÍDA (JSON puro, sem markdown):
{
  "productTitle": "${searchTerm}",
  "analysis": [
    {
      "platform": "Mercado Livre",
      "bestOffer": {
        "title": "Nome completo do produto real encontrado",
        "price": 99.90,
        "seller": "Nome da loja/vendedor",
        "link": "https://produto.mercadolivre.com.br/MLB-..."
      }
    },
    {
      "platform": "Shopee",
      "bestOffer": {
        "title": "Nome completo do produto real encontrado",
        "price": 89.90,
        "seller": "Nome da loja",
        "link": "https://shopee.com.br/product/..."
      }
    }
  ],
  "priceSummary": {
    "lowestPrice": 89.90,
    "highestPrice": 150.00,
    "averagePrice": 110.50
  }
}

VALIDAÇÃO:
✓ Nomes exatos: "Mercado Livre", "Shopee", "Amazon", "Magazine Luiza", "Americanas", "Shopify"
✓ Links começam com https:// e são URLs reais de produtos
✓ Preços são números (float), não strings
✓ Inclua APENAS plataformas onde encontrou o produto
✓ Retorne JSON puro (sem código markdown, sem texto extra)`;

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
            content: 'Você é um assistente de pesquisa avançada de e-commerce. Sua tarefa é OBRIGATORIAMENTE buscar produtos em TODAS as 6 plataformas especificadas usando busca web real. Use operadores site: para buscar em cada domínio. Extraia URLs reais e completas dos produtos. Retorne APENAS JSON puro sem formatação markdown.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 4000,
        search_recency_filter: 'month',
        return_related_questions: false,
        return_images: false,
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
