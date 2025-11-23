import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============= CONFIGURAÇÕES =============
const TIMEOUT_MS = 45000; // 45 segundos
const MAX_RETRIES = 3;
const CACHE_TTL_SECONDS = 3600; // 1 hora

// ============= VALIDAÇÃO DE DADOS =============
interface PriceBreakdown {
  price: number;
  sales: number;
}

interface PlatformAnalysis {
  platform: string;
  averagePrice: number;
  sampleSize: number;
  totalSales: number;
  priceBreakdown: PriceBreakdown[];
  priceRange: {
    min: number;
    max: number;
  };
}

interface AnalysisData {
  productTitle: string;
  analysis: PlatformAnalysis[];
  priceSummary: {
    lowestPrice: number;
    highestPrice: number;
    averagePrice: number;
  };
}

function validatePrice(price: number): boolean {
  return typeof price === 'number' && price > 0 && price < 999999 && !isNaN(price);
}

function calculateStats(prices: number[]): { mean: number; median: number; stdDev: number } {
  if (prices.length === 0) return { mean: 0, median: 0, stdDev: 0 };
  
  const sorted = [...prices].sort((a, b) => a - b);
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
  
  const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices.length;
  const stdDev = Math.sqrt(variance);
  
  return { 
    mean: parseFloat(mean.toFixed(2)),
    median: parseFloat(median.toFixed(2)),
    stdDev: parseFloat(stdDev.toFixed(2))
  };
}

function detectPriceAnomalies(prices: number[]): {
  valid: number[];
  anomalies: number[];
  stats: ReturnType<typeof calculateStats>;
} {
  const stats = calculateStats(prices);
  
  if (prices.length < 2) {
    return {
      valid: prices,
      anomalies: [],
      stats
    };
  }
  
  const valid: number[] = [];
  const anomalies: number[] = [];
  
  prices.forEach(price => {
    const zScore = Math.abs((price - stats.mean) / (stats.stdDev || 1));
    if (zScore > 2.5) {
      anomalies.push(price);
    } else {
      valid.push(price);
    }
  });
  
  return { valid, anomalies, stats };
}

function validatePriceWithContext(
  price: number,
  platform: string,
  allPrices: number[]
): { 
  isValid: boolean;
  confidence: 'high' | 'medium' | 'low'; 
  isOutlier: boolean;
  note?: string;
} {
  if (!validatePrice(price)) {
    return { 
      isValid: false,
      confidence: 'low', 
      isOutlier: true,
      note: 'Preço fora do intervalo válido (0 < preço < 999999)'
    };
  }
  
  if (allPrices.length <= 1) {
    return { 
      isValid: true,
      confidence: 'medium', 
      isOutlier: false,
      note: 'Único preço encontrado'
    };
  }
  
  const { stats, anomalies } = detectPriceAnomalies(allPrices);
  
  if (anomalies.includes(price)) {
    return { 
      isValid: true,
      confidence: 'low', 
      isOutlier: true,
      note: `Preço muito desviante (${((price - stats.mean) / stats.mean * 100).toFixed(0)}% diferença). SEMPRE verifique.`
    };
  }
  
  const deviation = Math.abs((price - stats.mean) / stats.mean * 100);
  
  if (deviation < 5) {
    return { 
      isValid: true,
      confidence: 'high', 
      isOutlier: false
    };
  } else if (deviation < 15) {
    return { 
      isValid: true,
      confidence: 'medium', 
      isOutlier: false,
      note: `Preço ${price > stats.mean ? 'acima' : 'abaixo'} da média em ${deviation.toFixed(0)}%`
    };
  }
  
  return { 
    isValid: true,
    confidence: 'low', 
    isOutlier: false,
    note: `Preço discrepante em ${deviation.toFixed(0)}%. Possível produto diferente.`
  };
}

function sanitizeAnalysisData(data: any, searchTerm: string): AnalysisData {
  const productTitle = data?.productTitle?.trim() || searchTerm;
  
  if (!Array.isArray(data?.analysis)) {
    return {
      productTitle,
      analysis: [],
      priceSummary: {
        lowestPrice: 0,
        highestPrice: 0,
        averagePrice: 0
      }
    };
  }
  
  const validAnalysis = data.analysis
    .filter((item: any) => {
      if (!item?.platform) return false;
      return validatePrice(item.averagePrice) && 
             typeof item.sampleSize === 'number' && 
             item.sampleSize > 0;
    })
    .map((item: any) => ({
      platform: item.platform,
      averagePrice: parseFloat(item.averagePrice.toFixed(2)),
      sampleSize: item.sampleSize,
      totalSales: typeof item.totalSales === 'number' ? item.totalSales : 0,
      priceBreakdown: Array.isArray(item.priceBreakdown) 
        ? item.priceBreakdown.map((pb: any) => ({
            price: parseFloat(pb.price.toFixed(2)),
            sales: typeof pb.sales === 'number' ? pb.sales : 0
          }))
        : [],
      priceRange: {
        min: parseFloat((item.priceRange?.min || item.averagePrice).toFixed(2)),
        max: parseFloat((item.priceRange?.max || item.averagePrice).toFixed(2))
      }
    }));

  let priceSummary = {
    lowestPrice: 0,
    highestPrice: 0,
    averagePrice: 0
  };
  
  if (validAnalysis.length > 0) {
    const prices = validAnalysis.map((item: any) => item.averagePrice);
    priceSummary = {
      lowestPrice: parseFloat(Math.min(...prices).toFixed(2)),
      highestPrice: parseFloat(Math.max(...prices).toFixed(2)),
      averagePrice: parseFloat((prices.reduce((a: number, b: number) => a + b, 0) / prices.length).toFixed(2))
    };
  }

  return {
    productTitle,
    analysis: validAnalysis,
    priceSummary
  };
}

// Removida função enhanceAnalysisWithValidation - não mais necessária

// ============= Validation Functions =============

/**
 * Valida se a resposta da AI é um JSON válido
 */
function isValidJsonResponse(aiResponse: string | null): boolean {
  if (!aiResponse || typeof aiResponse !== 'string') return false;
  if (aiResponse.length < 50) return false;
  if (!aiResponse.includes('{') || !aiResponse.includes('}')) return false;
  if (!aiResponse.includes('analysis')) return false;
  if (!aiResponse.includes('productTitle')) return false;
  return true;
}

async function buildFallbackAnalysis(searchTerm: string): Promise<AnalysisData> {
  console.log('⚠️ Nenhum resultado encontrado');
  
  return {
    productTitle: searchTerm,
    analysis: [],
    priceSummary: {
      lowestPrice: 0,
      highestPrice: 0,
      averagePrice: 0
    }
  };
}

// ============= CACHE COM DENO.KV =============
async function getCachedResult(searchTerm: string): Promise<AnalysisData | null> {
  try {
    const kv = await Deno.openKv();
    const key = ["market_analysis", searchTerm.toLowerCase().trim()];
    const result = await kv.get(key);
    await kv.close();
    
    if (result.value) {
      console.log('💾 Cache HIT para:', searchTerm);
      return result.value as AnalysisData;
    }
    console.log('💾 Cache MISS para:', searchTerm);
    return null;
  } catch (error) {
    console.error('⚠️ Erro ao acessar cache:', error);
    return null;
  }
}

async function setCachedResult(searchTerm: string, data: AnalysisData): Promise<void> {
  try {
    const kv = await Deno.openKv();
    const key = ["market_analysis", searchTerm.toLowerCase().trim()];
    await kv.set(key, data, { expireIn: CACHE_TTL_SECONDS * 1000 });
    await kv.close();
    console.log('💾 Resultado armazenado em cache');
  } catch (error) {
    console.error('⚠️ Erro ao salvar em cache:', error);
  }
}

function buildOptimizedPrompt(searchTerm: string): string {
  return `Tarefa: Buscar o produto "${searchTerm}" e detalhar PREÇOS INDIVIDUAIS + VENDAS em cada marketplace brasileiro.

🎯 OBJETIVO: Para CADA plataforma, busque entre 3-5 ofertas do mesmo produto e retorne:
1. Cada oferta individual com preço e vendas
2. MÉDIA de preços
3. TOTAL de vendas somadas

PLATAFORMAS (analisar todas):
1. Mercado Livre (mercadolivre.com.br)
2. Shopee (shopee.com.br)
3. Amazon Brasil (amazon.com.br)

📊 MODO DE ANÁLISE - DETALHAMENTO POR PREÇO:
Para CADA plataforma:
1. Busque entre 3-5 ofertas diferentes do produto "${searchTerm}"
2. Para CADA oferta, anote:
   - Preço exato
   - Quantidade de vendas (vendidos, sold, purchases, etc.)
3. Retorne array com cada combinação preço/vendas
4. Calcule a MÉDIA dos preços
5. SOME todas as vendas encontradas
6. Anote o menor e maior preço encontrado

Exemplo de análise:
- Encontrou iPhone 15 no Mercado Livre com 5 ofertas:
  * Oferta 1: R$ 3.899,00 - 1.234 vendas
  * Oferta 2: R$ 4.050,00 - 892 vendas
  * Oferta 3: R$ 3.999,00 - 2.100 vendas
  * Oferta 4: R$ 4.100,00 - 543 vendas
  * Oferta 5: R$ 3.950,00 - 1.876 vendas

Resultado esperado:
- priceBreakdown: [{price: 3899, sales: 1234}, {price: 4050, sales: 892}, ...]
- averagePrice: 3999.60
- totalSales: 6645
- priceRange: {min: 3899, max: 4100}
- sampleSize: 5

REGRAS IMPORTANTES:
✅ Busque PELO MENOS 3 ofertas por plataforma (ideal: 5)
✅ Todas as ofertas devem ser do MESMO produto (mesma especificação)
✅ SEMPRE tente buscar a quantidade de vendas para cada preço
✅ Retorne priceBreakdown com todos os preços encontrados
✅ Se não encontrar vendas, use 0 (mas tente encontrar!)
✅ Preços em formato decimal: 3999.60 (não "R$ 3.999,60")

FORMATO JSON ESPERADO:
{
  "productTitle": "Nome do produto encontrado",
  "analysis": [
    {
      "platform": "Mercado Livre",
      "averagePrice": 3999.60,
      "sampleSize": 5,
      "totalSales": 6645,
      "priceBreakdown": [
        {"price": 3899.00, "sales": 1234},
        {"price": 4050.00, "sales": 892},
        {"price": 3999.00, "sales": 2100},
        {"price": 4100.00, "sales": 543},
        {"price": 3950.00, "sales": 1876}
      ],
      "priceRange": {
        "min": 3899.00,
        "max": 4100.00
      }
    },
    {
      "platform": "Shopee",
      "averagePrice": 3850.30,
      "sampleSize": 4,
      "totalSales": 8234,
      "priceBreakdown": [
        {"price": 3799.00, "sales": 3200},
        {"price": 3850.00, "sales": 2500},
        {"price": 3900.00, "sales": 1534},
        {"price": 3950.00, "sales": 1000}
      ],
      "priceRange": {
        "min": 3799.00,
        "max": 3950.00
      }
    }
  ],
  "priceSummary": {
    "lowestPrice": 3799.00,
    "highestPrice": 4100.00,
    "averagePrice": 3924.95
  }
}

IMPORTANTE: 
- Retorne APENAS JSON válido
- SEM markdown, SEM explicações, SEM blocos de código
- SEMPRE inclua o array priceBreakdown com preço e vendas de cada oferta
- Se não encontrar em uma plataforma, não inclua ela no resultado
- Busque em TODAS as 3 plataformas principais`;
}

// ============= RETRY COM BACKOFF EXPONENCIAL =============
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = MAX_RETRIES
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        console.log(`✅ Requisição bem-sucedida (tentativa ${attempt}/${maxRetries})`);
        return response;
      }
      
      // Se for erro 4xx (exceto rate limit), não retry
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error: any) {
      lastError = error;
      console.warn(`⚠️ Tentativa ${attempt}/${maxRetries} falhou:`, error.message);
      
      // Se for timeout ou erro de rede, fazer retry
      if (attempt < maxRetries && (error.name === 'AbortError' || error.message.includes('fetch'))) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Max 10s
        console.log(`⏳ Aguardando ${delay}ms antes de retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      throw error;
    }
  }
  
  throw lastError || new Error('Falha após múltiplas tentativas');
}


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { searchTerm } = await req.json();
    console.log('🔍 Análise de mercado:', searchTerm);

    if (!searchTerm?.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Termo de busca obrigatório' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Verificar cache
    const cached = await getCachedResult(searchTerm);
    if (cached) {
      console.log('✅ Retornando resultado do cache');
      return new Response(
        JSON.stringify({ success: true, step: 'analysis', data: cached, cached: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
    if (!perplexityApiKey) {
      console.error('❌ PERPLEXITY_API_KEY não configurada');
      return new Response(
        JSON.stringify({ success: false, error: 'API não configurada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const prompt = buildOptimizedPrompt(searchTerm);

    console.log('🤖 Chamando Perplexity - MODO MÉDIA DE PREÇOS + VENDAS');
    
    const perplexityResponse = await fetchWithRetry(
      'https://api.perplexity.ai/chat/completions',
      {
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
              content: 'Você é um assistente especializado em análise de preços e vendas. Para cada marketplace, busque 3-5 ofertas do produto, calcule a MÉDIA de preços e SOME todas as vendas. SEMPRE tente buscar quantidade de vendas. Retorne APENAS JSON válido.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 1500,
          search_recency_filter: 'month',
        }),
      }
    );

    const perplexityData = await perplexityResponse.json();
    const aiResponse = perplexityData.choices?.[0]?.message?.content;
    
    // Validação melhorada de resposta
    if (!isValidJsonResponse(aiResponse)) {
      console.error('❌ Resposta inválida da Perplexity:', aiResponse?.substring(0, 100));
      
      // Em vez de retornar erro, usar fallback
      console.log('⚠️ Usando fallback devido a resposta inválida');
      const fallbackAnalysis = await buildFallbackAnalysis(searchTerm);
      await setCachedResult(searchTerm, fallbackAnalysis);
      
      return new Response(
        JSON.stringify({ 
          success: true,
          step: 'analysis',
          data: fallbackAnalysis,
          cached: false,
          note: 'Resposta da IA inválida - usando fallback'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📄 Resposta recebida:', aiResponse.substring(0, 150) + '...');

    // Extrair e parsear JSON
    let jsonResponse = aiResponse.trim()
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    let rawData;
    try {
      rawData = JSON.parse(jsonResponse);
      console.log('✅ JSON parseado');
    } catch (parseError) {
      console.error('❌ Erro ao parsear JSON:', parseError);
      
      // Fallback em caso de erro de parse
      const fallbackAnalysis = await buildFallbackAnalysis(searchTerm);
      await setCachedResult(searchTerm, fallbackAnalysis);
      
      return new Response(
        JSON.stringify({ 
          success: true,
          step: 'analysis',
          data: fallbackAnalysis,
          cached: false,
          note: 'Erro ao processar resposta - usando fallback'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sanitizedData = sanitizeAnalysisData(rawData, searchTerm);
    
    console.log(`✅ Marketplaces válidos: ${sanitizedData.analysis.length}`);
    
    if (sanitizedData.analysis.length === 0) {
      console.warn('⚠️ Nenhum marketplace com dados válidos');
      const fallbackAnalysis = await buildFallbackAnalysis(searchTerm);
      await setCachedResult(searchTerm, fallbackAnalysis);
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Nenhum marketplace encontrado com dados de preço'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    sanitizedData.analysis.forEach(item => {
      console.log(`✅ ${item.platform}: R$ ${item.averagePrice.toFixed(2)} (${item.sampleSize} ofertas) - ${item.totalSales} vendas`);
    });

    await setCachedResult(searchTerm, sanitizedData);
    console.log(`✅ CONCLUÍDO: ${sanitizedData.analysis.length} marketplace(s)`);

    return new Response(
      JSON.stringify({ 
        success: true,
        step: 'analysis',
        data: sanitizedData,
        cached: false
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('💥 Erro:', error);
    
    let errorMessage = 'Erro inesperado';
    let statusCode = 500;
    
    if (error.name === 'AbortError') {
      errorMessage = 'Tempo limite excedido. Tente novamente.';
      statusCode = 504;
    } else if (error.message?.includes('429')) {
      errorMessage = 'Muitas requisições. Aguarde um momento.';
      statusCode = 429;
    } else if (error.message?.includes('fetch')) {
      errorMessage = 'Erro de conexão. Verifique sua internet.';
      statusCode = 503;
    }
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: statusCode }
    );
  }
});
