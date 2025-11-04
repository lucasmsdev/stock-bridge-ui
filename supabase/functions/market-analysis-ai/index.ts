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
interface ProductOffer {
  title: string;
  price: number;
  seller: string;
  link: string;
  urlConfidence?: 'high' | 'medium' | 'low';
  priceConfidence?: 'high' | 'medium' | 'low';
}

interface PlatformAnalysis {
  platform: string;
  bestOffer: ProductOffer;
}

interface AnalysisData {
  productTitle: string;
  analysis: PlatformAnalysis[];
  priceSummary: {
    lowestPrice: number;
    highestPrice: number;
    averagePrice: number;
  };
  confidence?: {
    urls: {
      verified: number;
      total: number;
      averageConfidence: 'high' | 'medium' | 'low';
    };
    prices: {
      hasOutliers: boolean;
      anomaliesCount: number;
      averageConfidence: 'high' | 'medium' | 'low';
    };
  };
  disclaimer?: string;
}

// ============= PADRÕES DE URL POR PLATAFORMA =============
const URL_PATTERNS: Record<string, RegExp> = {
  'Mercado Livre': /https?:\/\/(?:produto\.)?mercadolivre\.com\.br\/.*(MLB-\d{10})/i,
  'Shopee': /https?:\/\/(?:shopee\.com\.br\/product\/\d{12}\/\d{11}|shp\.ee\/[a-zA-Z0-9]+)/,
  'Amazon': /https?:\/\/(?:www\.)?amazon\.com\.br\/(?:dp|gp\/product)\/[A-Z0-9]{10}/,
  'Magazine Luiza': /https?:\/\/(?:www\.)?magazineluiza\.com\.br\/[a-z0-9-]+\/p(?:[/?]|$)/i,
  'Americanas': /https?:\/\/(?:www\.)?americanas\.com\.br\/(?:produto|p)\/\d{9}/,
  'Shopify': /https?:\/\/[a-z0-9-]+\.(?:myshopify\.com|[a-z0-9-]+\.com\.br)\/products\/[a-z0-9-]+/i,
};

const SEARCH_URLS: Record<string, string> = {
  'Mercado Livre': 'https://lista.mercadolivre.com.br',
  'Shopee': 'https://shopee.com.br/search?keyword=',
  'Amazon': 'https://www.amazon.com.br/s?k=',
  'Magazine Luiza': 'https://www.magazineluiza.com.br/busca/',
  'Americanas': 'https://www.americanas.com.br/busca/',
  'Shopify': 'https://www.google.com/search?q='
};

function validatePrice(price: number): boolean {
  return typeof price === 'number' && price > 0 && price < 999999 && !isNaN(price);
}

function validateUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidUrlForPlatform(url: string | null, platform: string): boolean {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return false;
  }
  const pattern = URL_PATTERNS[platform];
  if (!pattern) return false;
  return pattern.test(url);
}

async function verifyUrlExists(url: string, timeout: number = 5000): Promise<boolean> {
  if (!url) return false;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PriceBot/1.0)'
      }
    });
    
    clearTimeout(timeoutId);
    return response.status >= 200 && response.status < 400;
  } catch (error) {
    return false;
  }
}

function sanitizeUrlForPlatform(url: string, platform: string): string {
  try {
    const urlObj = new URL(url);
    
    const trackingParams = [
      'ref', 'utm_source', 'utm_medium', 'utm_campaign', 
      'fbclid', '_gl', 'gclid', 'msclkid', 'dp_url'
    ];
    
    trackingParams.forEach(param => urlObj.searchParams.delete(param));
    
    if (platform === 'Amazon') {
      const urlStr = urlObj.toString();
      const dpIndex = urlStr.indexOf('/dp/');
      if (dpIndex !== -1) {
        const asinMatch = urlStr.substring(dpIndex).match(/\/dp\/([A-Z0-9]{10})/);
        if (asinMatch) {
          return `https://www.amazon.com.br/dp/${asinMatch[1]}`;
        }
      }
    }
    
    if (platform === 'Mercado Livre') {
      const baseUrl = urlObj.toString().split('#')[0];
      return baseUrl.replace(/\?.*$/, '');
    }
    
    if (platform === 'Magazine Luiza') {
      let result = urlObj.toString().split('?')[0];
      if (!result.endsWith('/p')) {
        result += '/p';
      }
      return result;
    }
    
    return urlObj.toString();
  } catch {
    return url;
  }
}

function generateSearchUrl(platform: string, searchTerm: string): string {
  const encoded = encodeURIComponent(searchTerm);
  const baseUrl = SEARCH_URLS[platform];
  
  if (!baseUrl) {
    return `https://www.google.com/search?q=${encoded}`;
  }
  
  if (platform === 'Mercado Livre') {
    return `${baseUrl}/${encoded}`;
  }
  
  if (platform === 'Shopify') {
    return `https://www.google.com/search?q=${encoded}+site:myshopify.com`;
  }
  
  return `${baseUrl}${encoded}`;
}

async function validateAndFixUrl(
  originalUrl: string | null,
  platform: string,
  searchTerm: string,
  attemptVerification: boolean = true
): Promise<{
  url: string;
  isVerified: boolean;
  confidence: 'high' | 'medium' | 'low';
  isGenericSearch: boolean;
}> {
  if (!originalUrl) {
    console.warn(`⚠️ URL nula para ${platform}`);
    return {
      url: generateSearchUrl(platform, searchTerm),
      isVerified: false,
      confidence: 'low',
      isGenericSearch: true
    };
  }
  
  const cleanedUrl = sanitizeUrlForPlatform(originalUrl, platform);
  
  if (!isValidUrlForPlatform(cleanedUrl, platform)) {
    console.warn(`⚠️ URL não segue padrão ${platform}: ${cleanedUrl}`);
    return {
      url: generateSearchUrl(platform, searchTerm),
      isVerified: false,
      confidence: 'low',
      isGenericSearch: true
    };
  }
  
  if (attemptVerification) {
    if (await verifyUrlExists(cleanedUrl)) {
      return {
        url: cleanedUrl,
        isVerified: true,
        confidence: 'high',
        isGenericSearch: false
      };
    }
    console.warn(`⚠️ URL retornou 404: ${platform}`);
  }
  
  return {
    url: generateSearchUrl(platform, searchTerm),
    isVerified: false,
    confidence: 'low',
    isGenericSearch: true
  };
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
  // Se productTitle vazio, usar searchTerm
  const productTitle = data?.productTitle?.trim() || searchTerm;
  
  // Se analysis não é array, inicializar vazio
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
  
  // Filtrar apenas ofertas válidas
  const validAnalysis = data.analysis.filter((item: any) => {
    if (!item?.platform || !item?.bestOffer) return false;
    
    const offer = item.bestOffer;
    const hasValidPrice = validatePrice(offer.price);
    const hasValidUrl = validateUrl(offer.link);
    const hasValidTitle = offer.title && typeof offer.title === 'string' && offer.title.trim().length > 0;
    const hasValidSeller = offer.seller && typeof offer.seller === 'string' && offer.seller.trim().length > 0;
    
    return hasValidPrice && hasValidUrl && hasValidTitle && hasValidSeller;
  });

  // Calcular priceSummary apenas se houver ofertas válidas
  let priceSummary = {
    lowestPrice: 0,
    highestPrice: 0,
    averagePrice: 0
  };
  
  if (validAnalysis.length > 0) {
    const prices = validAnalysis.map((item: any) => item.bestOffer.price);
    priceSummary = {
      lowestPrice: parseFloat(Math.min(...prices).toFixed(2)),
      highestPrice: parseFloat(Math.max(...prices).toFixed(2)),
      averagePrice: parseFloat((prices.reduce((a: number, b: number) => a + b, 0) / prices.length).toFixed(2))
    };
  }

  return {
    productTitle,
    analysis: validAnalysis.map((item: any) => ({
      platform: item.platform,
      bestOffer: item.bestOffer
    })),
    priceSummary
  };
}

async function enhanceAnalysisWithValidation(
  analysisData: AnalysisData,
  searchTerm: string
): Promise<AnalysisData> {
  const urlStats = { verified: 0, generic: 0, total: 0 };
  const priceAnomalies = new Set<number>();
  
  // Validar e melhorar URLs
  const enhancedAnalysis = await Promise.all(
    analysisData.analysis.map(async (item) => {
      urlStats.total++;
      
      const { url, isVerified, confidence, isGenericSearch } = await validateAndFixUrl(
        item.bestOffer.link,
        item.platform,
        searchTerm,
        true
      );
      
      if (isVerified) urlStats.verified++;
      if (isGenericSearch) urlStats.generic++;
      
      return {
        platform: item.platform,
        bestOffer: {
          ...item.bestOffer,
          link: url,
          urlConfidence: confidence
        }
      };
    })
  );
  
  // Validar preços
  const prices = enhancedAnalysis.map(a => a.bestOffer.price);
  const lowestPrice = Math.min(...prices);
  const highestPrice = Math.max(...prices);
  const averagePrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  
  // Marcar preços com confiança
  const enhancedWithPrices = enhancedAnalysis.map((item) => {
    const priceValidation = validatePriceWithContext(
      item.bestOffer.price,
      item.platform,
      prices
    );
    
    if (priceValidation.isOutlier) {
      priceAnomalies.add(item.bestOffer.price);
    }
    
    return {
      ...item,
      bestOffer: {
        ...item.bestOffer,
        priceConfidence: priceValidation.confidence
      }
    };
  });
  
  // Gerar disclaimer
  const urlPercentage = Math.round((urlStats.verified / urlStats.total) * 100);
  const now = new Date().toLocaleString('pt-BR', { 
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  let disclaimer = `⚠️ ${urlStats.verified}/${urlStats.total} URLs verificadas (${urlPercentage}%). `;
  
  if (urlStats.generic > 0) {
    disclaimer += `${urlStats.generic} são buscas genéricas (click leva a página de busca). `;
  }
  
  if (priceAnomalies.size > 0) {
    disclaimer += `${priceAnomalies.size} preço(s) anômalo(s) detectado(s). `;
  } else {
    disclaimer += 'Preços parecem consistentes. ';
  }
  
  disclaimer += `Dados de ${now}. SEMPRE verifique no site antes de comprar.`;
  
  const urlConfidenceAvg = urlPercentage > 70 ? 'high' : urlPercentage > 40 ? 'medium' : 'low';
  const priceConfidenceAvg = priceAnomalies.size === 0 ? 'high' :
                             priceAnomalies.size <= enhancedWithPrices.length * 0.3 ? 'medium' : 'low';
  
  return {
    productTitle: analysisData.productTitle,
    analysis: enhancedWithPrices,
    priceSummary: {
      lowestPrice: parseFloat(lowestPrice.toFixed(2)),
      highestPrice: parseFloat(highestPrice.toFixed(2)),
      averagePrice: parseFloat(averagePrice.toFixed(2))
    },
    confidence: {
      urls: {
        verified: urlStats.verified,
        total: urlStats.total,
        averageConfidence: urlConfidenceAvg
      },
      prices: {
        hasOutliers: priceAnomalies.size > 0,
        anomaliesCount: priceAnomalies.size,
        averageConfidence: priceConfidenceAvg
      }
    },
    disclaimer
  };
}

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

/**
 * Gera análise de fallback quando nenhum produto é encontrado
 */
async function buildFallbackAnalysis(searchTerm: string): Promise<AnalysisData> {
  console.log('⚠️ Nenhum resultado específico encontrado, gerando fallback...');
  
  const platforms = ['Mercado Livre', 'Shopee', 'Amazon', 'Magazine Luiza', 'Americanas'];
  
  const analysis = platforms.map(platform => ({
    platform,
    bestOffer: {
      title: `Buscar "${searchTerm}" em ${platform}`,
      price: 0,
      seller: 'Não encontrado - clique para buscar',
      link: generateSearchUrl(platform, searchTerm),
      urlConfidence: 'low' as const,
      priceConfidence: 'low' as const
    }
  }));
  
  return {
    productTitle: searchTerm,
    analysis,
    priceSummary: {
      lowestPrice: 0,
      highestPrice: 0,
      averagePrice: 0
    },
    confidence: {
      urls: {
        verified: 0,
        total: 0,
        averageConfidence: 'low'
      },
      prices: {
        hasOutliers: false,
        anomaliesCount: 0,
        averageConfidence: 'low'
      }
    },
    disclaimer: `⚠️ Produto não encontrado nas buscas diretas. Clique nos links para buscar manualmente em cada plataforma. Os resultados abaixo são páginas de busca, não produtos específicos.`
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

// ============= PROMPT OTIMIZADO COM PADRÕES DE URL =============
function buildOptimizedPrompt(searchTerm: string): string {
  return `Tarefa: Buscar o produto "${searchTerm}" em plataformas brasileiras de e-commerce.

PLATAFORMAS OBRIGATÓRIAS (buscar em TODAS):
1. Mercado Livre (mercadolivre.com.br)
2. Shopee (shopee.com.br)
3. Amazon Brasil (amazon.com.br)
4. Magazine Luiza (magazineluiza.com.br)
5. Americanas (americanas.com.br)

INSTRUÇÕES:
- Procure pelo melhor preço disponível
- Se encontrar em uma plataforma: retorne TÍTULO EXATO, PREÇO e URL DIRETA
- Se NÃO encontrar em uma plataforma: IGNORE COMPLETAMENTE (não inclua no resultado)
- Se ENCONTRAR MÚLTIPLOS SELLERS: escolha o com melhor preço

FORMATO DE URL ESPERADO:
- Mercado Livre: deve conter "MLB-" seguido de 10 dígitos
- Shopee: deve conter "/product/" ou "shp.ee"
- Amazon: deve conter "/dp/" ou "/gp/product/"
- Magazine Luiza: deve terminar em "/p"
- Americanas: deve conter "/produto/" ou "/p/"

REGRA DE PREÇO:
- Sempre número decimal: 1999.90 (não "R$ 1.999,90")
- Intervalo válido: maior que 0 e menor que 999999
- Se preço não faz sentido (ex: 1.90 para notebook), não inclua

REGRA DE QUALIDADE:
- Não invente URLs
- Não retorne produtos muito diferentes do buscado
- Se absolutamente não encontrar em nenhuma plataforma, retorne analysis vazio

FORMATO JSON (copie exatamente):
{
  "productTitle": "Nome do produto encontrado",
  "analysis": [
    {
      "platform": "Nome Plataforma",
      "bestOffer": {
        "title": "Título exato como aparece no site",
        "price": 1999.90,
        "seller": "Nome do vendedor ou loja",
        "link": "https://url-que-funciona"
      }
    }
  ],
  "priceSummary": {
    "lowestPrice": 1999.90,
    "highestPrice": 2999.90,
    "averagePrice": 2499.90
  }
}

EXEMPLO (3 plataformas encontraram):
{
  "productTitle": "Notebook Intel i5 16GB",
  "analysis": [
    {"platform": "Mercado Livre", "bestOffer": {"title": "Notebook Positivo Intel i5 16GB", "price": 2499.90, "seller": "Tech Store", "link": "https://produto.mercadolivre.com.br/MLB-2973405859-notebook"}},
    {"platform": "Shopee", "bestOffer": {"title": "Notebook i5 16GB 256GB", "price": 2599.90, "seller": "Shop Tech", "link": "https://shopee.com.br/product/447801038/22393211083"}},
    {"platform": "Amazon", "bestOffer": {"title": "Notebook Intel Core i5 16GB", "price": 2699.90, "seller": "Amazon.com.br", "link": "https://www.amazon.com.br/dp/B07FZ8S74R"}}
  ],
  "priceSummary": {"lowestPrice": 2499.90, "highestPrice": 2699.90, "averagePrice": 2599.90}
}

EXEMPLO (nenhuma encontrou - retorne vazio):
{
  "productTitle": "${searchTerm}",
  "analysis": [],
  "priceSummary": {"lowestPrice": 0, "highestPrice": 0, "averagePrice": 0}
}

RETORNE APENAS JSON, SEM MARKDOWN, SEM EXPLICAÇÕES.`;
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

    console.log('🤖 Chamando Perplexity API com retry e timeout...');
    
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
              content: 'Você é um assistente de pesquisa de preços. Retorne APENAS JSON válido, sem markdown, sem explicações, sem blocos de código.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.2,
          max_tokens: 2500,
          search_recency_filter: 'week',
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

    // Sanitizar dados
    const sanitizedData = sanitizeAnalysisData(rawData, searchTerm);
    
    console.log(`📊 Análise sanitizada: ${sanitizedData.analysis.length} plataformas encontradas`);

    // SE NENHUMA PLATAFORMA ENCONTROU, USAR FALLBACK
    if (sanitizedData.analysis.length === 0) {
      console.warn('⚠️ Nenhum resultado específico encontrado');
      const fallbackAnalysis = await buildFallbackAnalysis(searchTerm);
      
      // Salvar fallback no cache para evitar retry
      await setCachedResult(searchTerm, fallbackAnalysis);
      
      return new Response(
        JSON.stringify({ 
          success: true,
          step: 'analysis',
          data: fallbackAnalysis,
          cached: false,
          note: 'Produto não encontrado - usando URLs de busca'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SE TEM RESULTADOS, FAZER VALIDAÇÃO COMPLETA
    console.log('🔍 Validando URLs e preços...');
    const analysisData = await enhanceAnalysisWithValidation(sanitizedData, searchTerm);

    // Salvar no cache
    await setCachedResult(searchTerm, analysisData);

    console.log('✅ Análise concluída');
    console.log(`📊 ${analysisData.productTitle} | ${analysisData.analysis.length} plataformas`);

    return new Response(
      JSON.stringify({ 
        success: true,
        step: 'analysis',
        data: analysisData,
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
