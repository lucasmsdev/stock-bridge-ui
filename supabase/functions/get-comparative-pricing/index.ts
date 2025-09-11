import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RawResult {
  platform: 'Mercado Livre' | 'Shopee' | 'Amazon';
  title: string;
  price: number;
  seller: string;
  sales_count?: number;
  shipping_cost?: number;
  url: string;
  image_url?: string;
  score?: number;
}

interface BestOffer {
  title: string;
  price: number;
  seller: string;
  link: string;
}

interface PlatformAnalysis {
  platform: string;
  bestOffer: BestOffer;
}

interface ComparativeAnalysis {
  productTitle: string;
  analysis: PlatformAnalysis[];
  priceSummary: {
    lowestPrice: number;
    highestPrice: number;
    averagePrice: number;
  };
}

interface VariationAnalysis {
  productTitle: string;
  variations: string[];
}

serve(async (req) => {
  console.log('🚀 Edge Function get-comparative-pricing iniciada');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('📝 Processando requisição OPTIONS (CORS)');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📥 Processando requisição:', req.method);
    
    const { searchTerm, variation } = await req.json();
    console.log('🔍 Iniciando análise para o termo:', searchTerm);
    console.log('🎯 Variação específica:', variation || 'Não especificada');

    if (!searchTerm || typeof searchTerm !== 'string') {
      console.error('❌ Erro: Search term inválido ou ausente');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Search term é obrigatório e deve ser uma string' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('🔄 Verificando se é URL ou termo de busca...');
    
    // Check if it's a URL or a search term
    const isUrl = searchTerm.startsWith('http');
    
    if (isUrl) {
      console.log('🔗 Detectada URL, processando análise de produto específico...');
      const productInfo = await analyzeProductUrl(searchTerm);
      console.log('✅ Análise de URL concluída com sucesso');
      return new Response(
        JSON.stringify({ 
          success: true, 
          analysis: productInfo 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Determine search term with variation if provided
    const finalSearchTerm = variation ? `${searchTerm} ${variation}` : searchTerm;
    console.log('🔍 Termo de busca final:', finalSearchTerm);
    
    console.log('🌐 Iniciando busca paralela em múltiplas plataformas...');
    
    // Step 1: Search across all platforms in parallel
    const [mlResults, shopeeResults, amazonResults] = await Promise.allSettled([
      searchMercadoLibre(finalSearchTerm),
      searchShopee(finalSearchTerm),
      searchAmazon(finalSearchTerm)
    ]);

    console.log('📊 Resultados das buscas paralelas:');
    console.log('- MercadoLibre status:', mlResults.status);
    console.log('- Shopee status:', shopeeResults.status);
    console.log('- Amazon status:', amazonResults.status);

    let allRawResults: RawResult[] = [];

    // Aggregate results from all platforms
    if (mlResults.status === 'fulfilled') {
      console.log('✅ MercadoLibre: obtidos', mlResults.value.length, 'resultados');
      allRawResults.push(...mlResults.value);
    } else {
      console.error('❌ MercadoLibre falhou:', mlResults.reason);
    }
    
    if (shopeeResults.status === 'fulfilled') {
      console.log('✅ Shopee: obtidos', shopeeResults.value.length, 'resultados');
      allRawResults.push(...shopeeResults.value);
    } else {
      console.error('❌ Shopee falhou:', shopeeResults.reason);
    }
    
    if (amazonResults.status === 'fulfilled') {
      console.log('✅ Amazon: obtidos', amazonResults.value.length, 'resultados');
      allRawResults.push(...amazonResults.value);
    } else {
      console.error('❌ Amazon falhou:', amazonResults.reason);
    }

    console.log('📈 Total de resultados brutos coletados:', allRawResults.length);

    if (allRawResults.length === 0) {
      console.log('⚠️ Nenhum resultado encontrado em nenhuma plataforma');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Nenhum resultado encontrado para este termo de busca' 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if this is a variation selection step or final analysis
    if (!variation) {
      console.log('🔍 Primeira etapa: Identificando variações disponíveis...');
      
      // Step 2: Extract variations from results
      const variationAnalysis = extractProductVariations(allRawResults, searchTerm);
      
      console.log('✅ Variações identificadas:', variationAnalysis.variations);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          step: 'variations',
          data: variationAnalysis 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    } else {
      console.log('🧠 Segunda etapa: Análise comparativa para variação específica...');
      
      // Step 2: Apply intelligent filtering and scoring for specific variation
      const analysis = performComparativeAnalysis(allRawResults, finalSearchTerm);
      
      console.log('✅ Análise comparativa concluída com sucesso');
      console.log('- Produto identificado:', analysis.productTitle);
      console.log('- Plataformas analisadas:', analysis.analysis.length);
      console.log('- Menor preço:', analysis.priceSummary.lowestPrice);
      console.log('- Maior preço:', analysis.priceSummary.highestPrice);

      return new Response(
        JSON.stringify({ 
          success: true, 
          step: 'analysis',
          data: analysis 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

  } catch (error) {
    console.error('🔥 ERRO CRÍTICO na análise:', error);
    console.error('Stack trace:', error.stack);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Falha ao processar a análise de mercado. Tente novamente mais tarde.' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Extract product variations from search results
function extractProductVariations(rawResults: RawResult[], searchTerm: string): VariationAnalysis {
  console.log('🔍 Extraindo variações dos resultados...');
  
  const variations = new Set<string>();
  const commonVariationPatterns = [
    /(\d+GB|\d+MB)/gi,
    /(64GB|128GB|256GB|512GB|1TB|2TB)/gi,
    /(Preto|Branco|Azul|Verde|Rosa|Vermelho|Dourado|Prata|Cinza|Space Gray|Midnight|Starlight)/gi,
    /(Pro|Max|Plus|Mini|Lite|Standard)/gi,
    /(WiFi|4G|5G|Cellular)/gi,
    /(S|M|L|XL|PP|P|G|GG)/gi,
  ];
  
  // Analyze titles to find variations
  rawResults.forEach(result => {
    const title = result.title;
    
    commonVariationPatterns.forEach(pattern => {
      const matches = title.match(pattern);
      if (matches) {
        matches.forEach(match => {
          // Build variation string
          const titleWords = title.toLowerCase().split(' ');
          const matchIndex = titleWords.findIndex(word => word.includes(match.toLowerCase()));
          
          if (matchIndex !== -1) {
            // Extract surrounding context for better variation description
            const context = titleWords.slice(Math.max(0, matchIndex - 1), matchIndex + 3).join(' ');
            if (context.length > match.length && context.length < 50) {
              variations.add(context);
            } else {
              variations.add(match);
            }
          }
        });
      }
    });
  });
  
  // Filter and clean variations
  const filteredVariations = Array.from(variations)
    .filter(v => v.length > 2 && v.length < 40)
    .filter(v => !v.includes('usado') && !v.includes('case') && !v.includes('capa'))
    .slice(0, 8); // Limit to 8 variations
  
  console.log('✅ Variações extraídas:', filteredVariations);
  
  // Determine main product title
  const bestResult = rawResults.sort((a, b) => (b.score || 0) - (a.score || 0))[0];
  const productTitle = bestResult ? bestResult.title : searchTerm;
  
  return {
    productTitle,
    variations: filteredVariations
  };
}

// Intelligent filtering and scoring function
function performComparativeAnalysis(rawResults: RawResult[], searchTerm: string): ComparativeAnalysis {
  console.log('🎯 Aplicando pontuação aos resultados...');
  
  // Apply scoring to each result
  const scoredResults = rawResults.map(result => ({
    ...result,
    score: calculateRelevanceScore(result, searchTerm)
  }));

  console.log('📊 Pontuações calculadas. Agrupando por plataforma...');

  // Group by platform and find best offer per platform
  const platformGroups = {
    'Mercado Livre': scoredResults.filter(r => r.platform === 'Mercado Livre'),
    'Shopee': scoredResults.filter(r => r.platform === 'Shopee'),
    'Amazon': scoredResults.filter(r => r.platform === 'Amazon')
  };

  const analysis: PlatformAnalysis[] = [];
  const prices: number[] = [];

  console.log('🏆 Selecionando melhor oferta por plataforma...');

  // Find best offer for each platform
  Object.entries(platformGroups).forEach(([platform, results]) => {
    if (results.length > 0) {
      // Sort by score (highest first) and get the best one
      const bestResult = results.sort((a, b) => (b.score || 0) - (a.score || 0))[0];
      
      console.log(`- ${platform}: melhor resultado com score ${bestResult.score} - ${bestResult.title}`);
      
      analysis.push({
        platform,
        bestOffer: {
          title: bestResult.title,
          price: bestResult.price,
          seller: bestResult.seller,
          link: bestResult.url
        }
      });
      
      prices.push(bestResult.price);
    } else {
      console.log(`- ${platform}: nenhum resultado encontrado`);
    }
  });

  // Determine the most likely product title (from highest scored result overall)
  const bestOverallResult = scoredResults.sort((a, b) => (b.score || 0) - (a.score || 0))[0];
  const productTitle = bestOverallResult ? bestOverallResult.title : searchTerm;
  
  console.log('🎯 Produto principal identificado:', productTitle);

  // Calculate price summary
  const priceSummary = {
    lowestPrice: prices.length > 0 ? Math.min(...prices) : 0,
    highestPrice: prices.length > 0 ? Math.max(...prices) : 0,
    averagePrice: prices.length > 0 ? prices.reduce((sum, p) => sum + p, 0) / prices.length : 0
  };

  console.log('💰 Resumo de preços calculado:', priceSummary);

  return {
    productTitle,
    analysis,
    priceSummary
  };
}

function calculateRelevanceScore(result: RawResult, searchTerm: string): number {
  let score = 0;
  const title = result.title.toLowerCase();
  const searchLower = searchTerm.toLowerCase();

  // +10 points for title similarity
  const searchWords = searchLower.split(' ');
  const matchingWords = searchWords.filter(word => title.includes(word));
  score += (matchingWords.length / searchWords.length) * 10;

  // +5 points for official sellers or good reputation indicators
  const seller = result.seller.toLowerCase();
  if (seller.includes('oficial') || seller.includes('amazon') || seller.includes('loja') || 
      seller.includes('magazine') || seller.includes('casas') || seller.includes('extra')) {
    score += 5;
  }

  // +5 points for high sales count
  if (result.sales_count && result.sales_count > 50) {
    score += 5;
  } else if (result.sales_count && result.sales_count > 10) {
    score += 2;
  }

  // +3 points for free shipping
  if (result.shipping_cost === 0) {
    score += 3;
  }

  return score;
}

async function searchMercadoLibre(searchTerm: string): Promise<RawResult[]> {
  try {
    console.log('🛒 Buscando no MercadoLibre...');
    
    // Use MercadoLibre's public API with improved filters
    const searchUrl = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(searchTerm)}&condition=new&sort=relevance&limit=10`;
    
    console.log('📞 Chamada API MercadoLibre:', searchUrl);
    
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      }
    });
    
    if (!response.ok) {
      console.error(`❌ MercadoLibre API error: ${response.status} - ${response.statusText}`);
      throw new Error(`MercadoLibre API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('📦 Dados brutos do MercadoLibre recebidos:', data.results?.length || 0, 'items');
    
    if (!data.results || !Array.isArray(data.results)) {
      console.log('⚠️ Nenhum resultado encontrado na resposta da API MercadoLibre');
      return [];
    }

    // Apply intelligent filtering
    const negativeKeywords = ['capa', 'película', 'suporte', 'adesivo', 'controle', 'peça', 'usado', 'case', 'cabo', 'carregador', 'fonte', 'adaptador', 'protetor', 'skin', 'acessório', 'kit', 'peças'];
    
    const results: RawResult[] = data.results
      .filter((item: any) => {
        const title = (item.title || '').toLowerCase();
        
        // Filter out accessories and irrelevant products
        if (negativeKeywords.some(keyword => title.includes(keyword))) {
          console.log('🚫 Filtrado por palavra-chave negativa:', title);
          return false;
        }
        
        // Price validation based on search term
        const price = item.price || 0;
        const searchLower = searchTerm.toLowerCase();
        
        // Apply minimum price filters for expensive products
        if (searchLower.includes('playstation') || searchLower.includes('xbox') || searchLower.includes('console')) {
          if (price < 1000) {
            console.log('🚫 Filtrado por preço baixo (console):', title, 'R$', price);
            return false;
          }
        } else if (searchLower.includes('iphone') || searchLower.includes('samsung galaxy')) {
          if (price < 800) {
            console.log('🚫 Filtrado por preço baixo (smartphone):', title, 'R$', price);
            return false;
          }
        } else if (searchLower.includes('notebook') || searchLower.includes('laptop')) {
          if (price < 1200) {
            console.log('🚫 Filtrado por preço baixo (notebook):', title, 'R$', price);
            return false;
          }
        }
        
        // General minimum price filter
        if (price < 50) {
          console.log('🚫 Filtrado por preço muito baixo:', title, 'R$', price);
          return false;
        }
        
        return true;
      })
      .map((item: any) => ({
        platform: 'Mercado Livre' as const,
        title: item.title || 'Produto sem título',
        price: item.price || 0,
        seller: item.seller?.nickname || 'Vendedor não informado',
        sales_count: item.sold_quantity || undefined,
        shipping_cost: item.shipping?.free_shipping ? 0 : undefined,
        url: item.permalink || `https://mercadolivre.com.br`,
        image_url: item.thumbnail || undefined
      }));

    console.log('✅ MercadoLibre: filtrados', results.length, 'resultados válidos');
    return results;

  } catch (error) {
    console.error('❌ Erro ao buscar no MercadoLibre:', error);
    // Return mock data for demonstration
    console.log('🎭 Retornando dados mock para MercadoLibre');
    return [{
      platform: 'Mercado Livre' as const,
      title: `${searchTerm} - MercadoLibre Demo`,
      price: Math.floor(Math.random() * 1000) + 100,
      seller: 'Vendedor ML',
      sales_count: Math.floor(Math.random() * 100) + 1,
      url: 'https://mercadolivre.com.br',
      image_url: undefined
    }];
  }
}

async function searchShopee(searchTerm: string): Promise<RawResult[]> {
  try {
    console.log('🛍️ Buscando na Shopee...');
    
    // Apply smart filtering to mock data as well
    const searchLower = searchTerm.toLowerCase();
    let basePrice = 100;
    let maxPrice = 500;
    
    // Adjust price ranges based on search term
    if (searchLower.includes('playstation') || searchLower.includes('xbox') || searchLower.includes('console')) {
      basePrice = 2800;
      maxPrice = 4500;
    } else if (searchLower.includes('iphone') || searchLower.includes('samsung galaxy')) {
      basePrice = 1500;
      maxPrice = 3500;
    } else if (searchLower.includes('notebook') || searchLower.includes('laptop')) {
      basePrice = 2000;
      maxPrice = 6000;
    }
    
    console.log('🎭 Gerando dados mock para Shopee com faixa de preço:', basePrice, '-', maxPrice);
    
    const mockResults: RawResult[] = [
      {
        platform: 'Shopee' as const,
        title: `${searchTerm} - Shopee Original`,
        price: Math.floor(Math.random() * (maxPrice - basePrice)) + basePrice,
        seller: 'Shopee Seller',
        sales_count: Math.floor(Math.random() * 200) + 10,
        url: `https://shopee.com.br/search?keyword=${encodeURIComponent(searchTerm)}`,
        image_url: undefined
      },
      {
        platform: 'Shopee' as const,
        title: `${searchTerm} - Premium Edition`,
        price: Math.floor(Math.random() * (maxPrice - basePrice)) + basePrice + 200,
        seller: 'Premium Store',
        sales_count: Math.floor(Math.random() * 150) + 5,
        url: `https://shopee.com.br/search?keyword=${encodeURIComponent(searchTerm)}`,
        image_url: undefined
      }
    ];

    console.log('✅ Shopee: gerados', mockResults.length, 'resultados mock');
    return mockResults;
  } catch (error) {
    console.error('❌ Erro na busca Shopee:', error);
    return [];
  }
}

async function searchAmazon(searchTerm: string): Promise<RawResult[]> {
  try {
    console.log('📦 Buscando na Amazon...');
    
    // Apply smart filtering to mock data as well
    const searchLower = searchTerm.toLowerCase();
    let basePrice = 150;
    let maxPrice = 800;
    
    // Adjust price ranges based on search term
    if (searchLower.includes('playstation') || searchLower.includes('xbox') || searchLower.includes('console')) {
      basePrice = 3000;
      maxPrice = 5000;
    } else if (searchLower.includes('iphone') || searchLower.includes('samsung galaxy')) {
      basePrice = 1800;
      maxPrice = 4000;
    } else if (searchLower.includes('notebook') || searchLower.includes('laptop')) {
      basePrice = 2500;
      maxPrice = 8000;
    }
    
    console.log('🎭 Gerando dados mock para Amazon com faixa de preço:', basePrice, '-', maxPrice);
    
    const mockResults: RawResult[] = [
      {
        platform: 'Amazon' as const,
        title: `${searchTerm} - Amazon's Choice`,
        price: Math.floor(Math.random() * (maxPrice - basePrice)) + basePrice,
        seller: 'Amazon',
        sales_count: Math.floor(Math.random() * 500) + 50,
        url: `https://www.amazon.com.br/s?k=${encodeURIComponent(searchTerm)}`,
        image_url: undefined
      },
      {
        platform: 'Amazon' as const,
        title: `${searchTerm} - Prime Delivery`,
        price: Math.floor(Math.random() * (maxPrice - basePrice)) + basePrice - 100,
        seller: 'Prime Seller',
        sales_count: Math.floor(Math.random() * 300) + 20,
        url: `https://www.amazon.com.br/s?k=${encodeURIComponent(searchTerm)}`,
        image_url: undefined
      }
    ];

    console.log('✅ Amazon: gerados', mockResults.length, 'resultados mock');
    return mockResults;
  } catch (error) {
    console.error('❌ Erro na busca Amazon:', error);
    return [];
  }
}

async function analyzeProductUrl(url: string): Promise<ComparativeAnalysis> {
  try {
    console.log('🔗 Analisando URL do produto:', url);
    
    // Extract product ID from MercadoLibre URL if possible
    const mlbMatch = url.match(/MLB(\d+)/);
    
    if (mlbMatch) {
      const productId = `MLB${mlbMatch[1]}`;
      console.log('🏷️ ID do produto MercadoLibre extraído:', productId);
      
      const apiUrl = `https://api.mercadolibre.com/items/${productId}`;
      console.log('📞 Buscando detalhes do produto:', apiUrl);
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`Product API error: ${response.status}`);
      }
      
      const product = await response.json();
      console.log('📦 Detalhes do produto obtidos:', product.title);
      
      // Get seller info
      let sellerName = 'Vendedor não informado';
      try {
        console.log('👤 Buscando informações do vendedor...');
        const sellerResponse = await fetch(`https://api.mercadolibre.com/users/${product.seller_id}`);
        if (sellerResponse.ok) {
          const seller = await sellerResponse.json();
          sellerName = seller.nickname || sellerName;
          console.log('✅ Vendedor identificado:', sellerName);
        }
      } catch (error) {
        console.log('⚠️ Não foi possível obter info do vendedor:', error);
      }
      
      // Create a single result and perform analysis
      const singleResult: RawResult = {
        platform: 'Mercado Livre' as const,
        title: product.title || 'Produto sem título',
        price: product.price || 0,
        seller: sellerName,
        sales_count: product.sold_quantity || undefined,
        shipping_cost: product.shipping?.free_shipping ? 0 : undefined,
        url: product.permalink || url,
        image_url: product.thumbnail || undefined
      };
      
      console.log('✅ Análise de URL concluída para produto individual');
      
      // Return a single-platform analysis
      return {
        productTitle: singleResult.title,
        analysis: [{
          platform: 'Mercado Livre',
          bestOffer: {
            title: singleResult.title,
            price: singleResult.price,
            seller: singleResult.seller,
            link: singleResult.url
          }
        }],
        priceSummary: {
          lowestPrice: singleResult.price,
          highestPrice: singleResult.price,
          averagePrice: singleResult.price
        }
      };
    } else {
      throw new Error('URL format not supported. Currently only MercadoLibre URLs are supported.');
    }
    
  } catch (error) {
    console.error('❌ Erro ao analisar URL do produto:', error);
    throw new Error('Failed to analyze product URL');
  }
}