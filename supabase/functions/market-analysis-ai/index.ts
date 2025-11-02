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
    const prompt = `Busque informações sobre o produto "${searchTerm}" em e-commerces brasileiros e retorne em JSON.

Inclua preços de TODAS estas plataformas:
- Mercado Livre
- Shopee  
- Amazon
- Magazine Luiza
- Americanas
- Shopify

Para cada plataforma, tente encontrar preço e título do produto. Se não encontrar, use "price": 0.

Retorne JSON puro (sem markdown):
{
  "productTitle": "${searchTerm}",
  "analysis": [
    {"platform": "Mercado Livre", "bestOffer": {"title": "nome do produto", "price": 100.00, "seller": "loja", "link": "url-real"}},
    {"platform": "Shopee", "bestOffer": {"title": "nome", "price": 90.00, "seller": "loja", "link": "url-real"}},
    {"platform": "Amazon", "bestOffer": {"title": "nome", "price": 95.00, "seller": "loja", "link": "url-real"}},
    {"platform": "Magazine Luiza", "bestOffer": {"title": "nome", "price": 0, "seller": "N/A", "link": "#"}},
    {"platform": "Americanas", "bestOffer": {"title": "nome", "price": 0, "seller": "N/A", "link": "#"}},
    {"platform": "Shopify", "bestOffer": {"title": "nome", "price": 0, "seller": "N/A", "link": "#"}}
  ]
}`;

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
            content: 'Você é um assistente de e-commerce. Retorne dados de TODAS as 6 plataformas solicitadas. Use price: 0 se não encontrar. Retorne APENAS JSON puro.'
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

    // Garantir que TODAS as 6 plataformas estejam presentes
    const searchQuery = encodeURIComponent(searchTerm);
    const requiredPlatforms = [
      { name: 'Mercado Livre', searchUrl: `https://lista.mercadolivre.com.br/${searchQuery}` },
      { name: 'Shopee', searchUrl: `https://shopee.com.br/search?keyword=${searchQuery}` },
      { name: 'Amazon', searchUrl: `https://www.amazon.com.br/s?k=${searchQuery}` },
      { name: 'Magazine Luiza', searchUrl: `https://www.magazineluiza.com.br/busca/${searchQuery}` },
      { name: 'Americanas', searchUrl: `https://www.americanas.com.br/busca/${searchQuery}` },
      { name: 'Shopify', searchUrl: `https://www.google.com/search?q=${searchQuery}+site:myshopify.com` }
    ];

    // Normalizar dados da IA e garantir todas as plataformas
    const platformsMap = new Map();
    
    // Adicionar dados da IA
    if (analysisData.analysis && Array.isArray(analysisData.analysis)) {
      analysisData.analysis.forEach((item: any) => {
        if (item.bestOffer?.price > 0) {
          platformsMap.set(item.platform, {
            platform: item.platform,
            bestOffer: {
              title: item.bestOffer.title || searchTerm,
              price: item.bestOffer.price,
              seller: item.bestOffer.seller || 'Loja',
              link: item.bestOffer.link && item.bestOffer.link.startsWith('http') 
                ? item.bestOffer.link 
                : requiredPlatforms.find(p => p.name === item.platform)?.searchUrl || '#'
            }
          });
        }
      });
    }

    // Adicionar plataformas faltantes com links de busca
    requiredPlatforms.forEach(platform => {
      if (!platformsMap.has(platform.name)) {
        platformsMap.set(platform.name, {
          platform: platform.name,
          bestOffer: {
            title: `${searchTerm} - Buscar nesta loja`,
            price: 0,
            seller: 'Pesquisar',
            link: platform.searchUrl
          }
        });
      }
    });

    analysisData.analysis = Array.from(platformsMap.values());

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
