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
  'Mercado Livre': /https?:\/\/(?:produto\.)?mercadolivre\.com\.br\/MLB-\d{10}/i,
  'Shopee': /https?:\/\/(?:shopee\.com\.br\/product\/\d{9,12}\/\d{9,11}|shp\.ee\/[a-zA-Z0-9]+)/i,
  'Amazon': /https?:\/\/(?:www\.)?amazon\.com\.br\/(?:dp|gp\/product)\/[A-Z0-9]{10}/i,
  'Magazine Luiza': /https?:\/\/(?:www\.)?magazineluiza\.com\.br\/[a-z0-9-]+\/p/i,
  'Americanas': /https?:\/\/(?:www\.)?americanas\.com\.br\/(?:produto|p)\/\d{7,10}/i,
  'Shopify': /https?:\/\/[a-z0-9-]+\.(?:myshopify\.com|[a-z0-9-]+\.com\.br)\/products\/[a-z0-9-]+/i,
};

const SEARCH_URLS: Record<string, string> = {
  'Mercado Livre': 'https://lista.mercadolivre.com.br',
  'Shopee': 'https://shopee.com.br/search?keyword=',
  'Amazon': 'https://www.amazon.com.br/s?k=',
  'Magazine Luiza': 'https://www.magazineluiza.com.br/busca/',
  'Americanas': 'https://www.americanas.com.br/busca/',
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

function isValidUrlForPlatform(url: string, platform: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const pattern = URL_PATTERNS[platform];
  if (!pattern) return false;
  return pattern.test(url);
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
  
  return `${baseUrl}${encoded}`;
}

function calculateStats(prices: number[]): { mean: number; stdDev: number } {
  if (prices.length === 0) return { mean: 0, stdDev: 0 };
  
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices.length;
  const stdDev = Math.sqrt(variance);
  
  return { mean, stdDev };
}

function validatePriceWithContext(
  price: number,
  allPrices: number[]
): { confidence: 'high' | 'medium' | 'low'; isOutlier: boolean } {
  if (!validatePrice(price)) {
    return { confidence: 'low', isOutlier: true };
  }
  
  if (allPrices.length < 2) {
    return { confidence: 'medium', isOutlier: false };
  }
  
  const { mean, stdDev } = calculateStats(allPrices);
  
  if (stdDev === 0) {
    return { confidence: 'high', isOutlier: false };
  }
  
  const zScore = Math.abs((price - mean) / stdDev);
  
  if (zScore > 2.5) {
    return { confidence: 'low', isOutlier: true };
  } else if (zScore > 1.5) {
    return { confidence: 'medium', isOutlier: false };
  }
  
  return { confidence: 'high', isOutlier: false };
}

function sanitizeAnalysisData(data: any, searchTerm: string): AnalysisData | null {
  if (!data?.productTitle || !data?.analysis || !Array.isArray(data.analysis)) {
    return null;
  }

  const validAnalysis = data.analysis.filter((item: any) => {
    if (!item?.platform || !item?.bestOffer) return false;
    
    const offer = item.bestOffer;
    const hasValidPrice = validatePrice(offer.price);
    const hasValidUrl = validateUrl(offer.link);
    const hasValidTitle = offer.title && typeof offer.title === 'string' && offer.title.trim().length > 0;
    const hasValidSeller = offer.seller && typeof offer.seller === 'string' && offer.seller.trim().length > 0;
    
    return hasValidPrice && hasValidUrl && hasValidTitle && hasValidSeller;
  });

  if (validAnalysis.length === 0) return null;

  const prices = validAnalysis.map((item: any) => item.bestOffer.price);
  const lowestPrice = Math.min(...prices);
  const highestPrice = Math.max(...prices);
  const averagePrice = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;

  // Adicionar validação de URLs e preços com confiança
  let urlsVerified = 0;
  let priceOutliers = 0;
  
  const analysisWithConfidence = validAnalysis.map((item: any) => {
    const platform = item.platform;
    const offer = item.bestOffer;
    
    // Validar URL por padrão
    const isValidPattern = isValidUrlForPlatform(offer.link, platform);
    const urlConfidence: 'high' | 'medium' | 'low' = isValidPattern ? 'high' : 'low';
    
    if (isValidPattern) {
      urlsVerified++;
    } else {
      // Fallback para URL de busca
      console.warn(`⚠️ URL não segue padrão ${platform}: ${offer.link}`);
      offer.link = generateSearchUrl(platform, searchTerm);
    }
    
    // Validar preço com contexto
    const priceValidation = validatePriceWithContext(offer.price, prices);
    
    if (priceValidation.isOutlier) {
      priceOutliers++;
    }
    
    return {
      platform,
      bestOffer: {
        ...offer,
        urlConfidence,
        priceConfidence: priceValidation.confidence
      }
    };
  });

  // Calcular confiança média
  const urlConfidenceAvg = urlsVerified > analysisWithConfidence.length * 0.7 ? 'high' : 
                           urlsVerified > analysisWithConfidence.length * 0.4 ? 'medium' : 'low';
  
  const priceConfidenceAvg = priceOutliers === 0 ? 'high' :
                             priceOutliers <= analysisWithConfidence.length * 0.3 ? 'medium' : 'low';

  // Gerar disclaimer
  const now = new Date().toLocaleString('pt-BR', { 
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  let disclaimer = `⚠️ ${urlsVerified}/${analysisWithConfidence.length} URLs verificadas. `;
  
  if (priceOutliers > 0) {
    disclaimer += `Detectados ${priceOutliers} preço(s) anômalo(s) - verifique no site. `;
  } else {
    disclaimer += 'Preços parecem consistentes. ';
  }
  
  disclaimer += `Dados coletados em ${now}. Preços e disponibilidade sujeitos a mudanças. SEMPRE verifique no site antes de comprar.`;

  return {
    productTitle: data.productTitle.trim(),
    analysis: analysisWithConfidence,
    priceSummary: {
      lowestPrice: parseFloat(lowestPrice.toFixed(2)),
      highestPrice: parseFloat(highestPrice.toFixed(2)),
      averagePrice: parseFloat(averagePrice.toFixed(2)),
    },
    confidence: {
      urls: {
        verified: urlsVerified,
        total: analysisWithConfidence.length,
        averageConfidence: urlConfidenceAvg
      },
      prices: {
        hasOutliers: priceOutliers > 0,
        anomaliesCount: priceOutliers,
        averageConfidence: priceConfidenceAvg
      }
    },
    disclaimer
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
  return `Busque EXATAMENTE "${searchTerm}" nas plataformas brasileiras: Mercado Livre, Shopee, Amazon, Magazine Luiza, Americanas.

CRÍTICO - Use APENAS URLs que seguem estes padrões EXATOS:
- Mercado Livre: https://produto.mercadolivre.com.br/MLB-XXXXXXXXXX-[nome-produto]
- Shopee: https://shopee.com.br/product/XXXXXXXXXXXX/XXXXXXXXXXX
- Amazon: https://www.amazon.com.br/dp/XXXXXXXXXX
- Magazine Luiza: https://www.magazineluiza.com.br/[nome-produto]/p
- Americanas: https://www.americanas.com.br/produto/XXXXXXXXX/[nome]

Se não conseguir URL no padrão exato, coloque null no campo "link".

Retorne JSON puro (sem markdown):

{
  "productTitle": "nome do produto",
  "analysis": [
    {"platform": "Mercado Livre", "bestOffer": {"title": "produto", "price": 99.90, "seller": "loja", "link": "https://..."}}
  ],
  "priceSummary": {"lowestPrice": 99.90, "highestPrice": 99.90, "averagePrice": 99.90}
}

Exemplo 1:
Busca: "iPhone 14"
{
  "productTitle": "iPhone 14",
  "analysis": [
    {"platform": "Mercado Livre", "bestOffer": {"title": "iPhone 14 128GB Azul", "price": 3499.00, "seller": "Apple Premium", "link": "https://produto.mercadolivre.com.br/MLB-3273405859-iphone-14-128gb"}},
    {"platform": "Amazon", "bestOffer": {"title": "Apple iPhone 14 128GB", "price": 3599.00, "seller": "Amazon.com.br", "link": "https://www.amazon.com.br/dp/B0BN94DKK1"}}
  ],
  "priceSummary": {"lowestPrice": 3499.00, "highestPrice": 3599.00, "averagePrice": 3549.00}
}

Exemplo 2:
Busca: "notebook gamer"
{
  "productTitle": "Notebook Gamer",
  "analysis": [
    {"platform": "Magazine Luiza", "bestOffer": {"title": "Notebook Gamer Acer Nitro 5", "price": 4299.00, "seller": "Magazine Luiza", "link": "https://www.magazineluiza.com.br/notebook-gamer-acer-nitro-5/p"}},
    {"platform": "Americanas", "bestOffer": {"title": "Notebook Gamer Lenovo Legion", "price": 4599.00, "seller": "Americanas", "link": "https://www.americanas.com.br/produto/123456789/notebook-gamer-lenovo"}}
  ],
  "priceSummary": {"lowestPrice": 4299.00, "highestPrice": 4599.00, "averagePrice": 4449.00}
}

REGRA: URLs devem levar DIRETO ao produto, não à busca. Se não tem certeza, use null.`;
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
              content: 'Assistente de preços. Retorne apenas JSON puro sem markdown.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.1,
          max_tokens: 2000,
          search_recency_filter: 'week',
        }),
      }
    );

    const perplexityData = await perplexityResponse.json();
    const aiResponse = perplexityData.choices?.[0]?.message?.content;
    
    if (!aiResponse) {
      console.error('❌ Resposta vazia');
      return new Response(
        JSON.stringify({ success: false, error: 'Nenhum resultado encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
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
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao processar resultados' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Sanitizar e validar dados (agora com validação de URLs e confiança)
    const analysisData = sanitizeAnalysisData(rawData, searchTerm);
    if (!analysisData) {
      console.error('❌ Dados inválidos após sanitização');
      return new Response(
        JSON.stringify({ success: false, error: 'Dados inválidos retornados pela IA' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

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
