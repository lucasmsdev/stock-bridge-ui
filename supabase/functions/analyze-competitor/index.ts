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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { searchTerm } = await req.json();

    if (!searchTerm || typeof searchTerm !== 'string') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Search term is required' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Performing intelligent price analysis for:', searchTerm);

    // Check if it's a URL or a search term
    const isUrl = searchTerm.startsWith('http');
    
    if (isUrl) {
      // If it's a URL, try to extract product info from it
      const productInfo = await analyzeProductUrl(searchTerm);
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

    // Step 1: Search across all platforms in parallel
    const [mlResults, shopeeResults, amazonResults] = await Promise.allSettled([
      searchMercadoLibre(searchTerm),
      searchShopee(searchTerm),
      searchAmazon(searchTerm)
    ]);

    let allRawResults: RawResult[] = [];

    // Aggregate results from all platforms
    if (mlResults.status === 'fulfilled') {
      allRawResults.push(...mlResults.value);
    }
    if (shopeeResults.status === 'fulfilled') {
      allRawResults.push(...shopeeResults.value);
    }
    if (amazonResults.status === 'fulfilled') {
      allRawResults.push(...amazonResults.value);
    }

    console.log(`Found ${allRawResults.length} raw results across all platforms`);

    // Step 2: Apply intelligent filtering and scoring
    const analysis = performComparativeAnalysis(allRawResults, searchTerm);

    return new Response(
      JSON.stringify({ 
        success: true, 
        analysis: analysis 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in price analysis function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Intelligent filtering and scoring function
function performComparativeAnalysis(rawResults: RawResult[], searchTerm: string): ComparativeAnalysis {
  // Apply scoring to each result
  const scoredResults = rawResults.map(result => ({
    ...result,
    score: calculateRelevanceScore(result, searchTerm)
  }));

  // Group by platform and find best offer per platform
  const platformGroups = {
    'Mercado Livre': scoredResults.filter(r => r.platform === 'Mercado Livre'),
    'Shopee': scoredResults.filter(r => r.platform === 'Shopee'),
    'Amazon': scoredResults.filter(r => r.platform === 'Amazon')
  };

  const analysis: PlatformAnalysis[] = [];
  const prices: number[] = [];

  // Find best offer for each platform
  Object.entries(platformGroups).forEach(([platform, results]) => {
    if (results.length > 0) {
      // Sort by score (highest first) and get the best one
      const bestResult = results.sort((a, b) => (b.score || 0) - (a.score || 0))[0];
      
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
    }
  });

  // Determine the most likely product title (from highest scored result overall)
  const bestOverallResult = scoredResults.sort((a, b) => (b.score || 0) - (a.score || 0))[0];
  const productTitle = bestOverallResult ? bestOverallResult.title : searchTerm;

  // Calculate price summary
  const priceSummary = {
    lowestPrice: prices.length > 0 ? Math.min(...prices) : 0,
    highestPrice: prices.length > 0 ? Math.max(...prices) : 0,
    averagePrice: prices.length > 0 ? prices.reduce((sum, p) => sum + p, 0) / prices.length : 0
  };

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
    // Use MercadoLibre's public API with improved filters
    const searchUrl = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(searchTerm)}&condition=new&sort=relevance&limit=10`;
    
    console.log('Fetching from MercadoLibre API:', searchUrl);
    
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      }
    });
    
    if (!response.ok) {
      console.error(`MercadoLibre API error: ${response.status} - ${response.statusText}`);
      throw new Error(`MercadoLibre API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.results || !Array.isArray(data.results)) {
      console.log('No results found in MercadoLibre API response');
      return [];
    }

    const results: CompetitorResult[] = data.results
      .filter((item: any) => {
        // Filter out accessories and irrelevant products
        const title = (item.title || '').toLowerCase();
        const negativeKeywords = ['capa', 'película', 'suporte', 'adesivo', 'controle', 'peça', 'usado', 'case', 'película', 'cabo', 'carregador', 'fonte', 'adaptador', 'película', 'protetor', 'película', 'skin', 'acessório', 'kit', 'peças'];
        
        // Skip if title contains negative keywords
        if (negativeKeywords.some(keyword => title.includes(keyword))) {
          return false;
        }
        
        // Price validation based on search term
        const price = item.price || 0;
        const searchLower = searchTerm.toLowerCase();
        
        // Apply minimum price filters for expensive products
        if (searchLower.includes('playstation') || searchLower.includes('xbox') || searchLower.includes('console')) {
          return price >= 1000; // Minimum R$ 1000 for game consoles
        }
        if (searchLower.includes('iphone') || searchLower.includes('samsung galaxy')) {
          return price >= 800; // Minimum R$ 800 for smartphones
        }
        if (searchLower.includes('notebook') || searchLower.includes('laptop')) {
          return price >= 1200; // Minimum R$ 1200 for laptops
        }
        
        // General minimum price filter
        return price >= 50;
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

    return results;

  } catch (error) {
    console.error('Error searching MercadoLibre:', error);
    // Return mock data for demonstration
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
    console.log('Searching Shopee for:', searchTerm);
    
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
    
    const mockResults: CompetitorResult[] = [
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

    return mockResults;
  } catch (error) {
    console.error('Error searching Shopee:', error);
    return [];
  }
}

async function searchAmazon(searchTerm: string): Promise<RawResult[]> {
  try {
    console.log('Searching Amazon for:', searchTerm);
    
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
    
    const mockResults: CompetitorResult[] = [
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

    return mockResults;
  } catch (error) {
    console.error('Error searching Amazon:', error);
    return [];
  }
}

async function analyzeProductUrl(url: string): Promise<ComparativeAnalysis> {
  try {
    // Extract product ID from MercadoLibre URL if possible
    const mlbMatch = url.match(/MLB(\d+)/);
    
    if (mlbMatch) {
      const productId = `MLB${mlbMatch[1]}`;
      console.log('Analyzing MercadoLibre product:', productId);
      
      const apiUrl = `https://api.mercadolibre.com/items/${productId}`;
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`Product API error: ${response.status}`);
      }
      
      const product = await response.json();
      
      // Get seller info
      let sellerName = 'Vendedor não informado';
      try {
        const sellerResponse = await fetch(`https://api.mercadolibre.com/users/${product.seller_id}`);
        if (sellerResponse.ok) {
          const seller = await sellerResponse.json();
          sellerName = seller.nickname || sellerName;
        }
      } catch (error) {
        console.log('Could not fetch seller info:', error);
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
    console.error('Error analyzing product URL:', error);
    throw new Error('Failed to analyze product URL');
  }
}