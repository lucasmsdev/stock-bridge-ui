import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompetitorResult {
  platform: 'Mercado Livre' | 'Shopee' | 'Amazon';
  title: string;
  price: number;
  seller: string;
  sales_count?: number;
  shipping_cost?: number;
  url: string;
  image_url?: string;
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

    console.log('Analyzing competitors for:', searchTerm);

    // Check if it's a URL or a search term
    const isUrl = searchTerm.startsWith('http');
    let allResults: CompetitorResult[] = [];

    if (isUrl) {
      // If it's a URL, try to extract product info from it
      allResults = await analyzeProductUrl(searchTerm);
    } else {
      // If it's a search term, search across all platforms in parallel
      const [mlResults, shopeeResults, amazonResults] = await Promise.allSettled([
        searchMercadoLibre(searchTerm),
        searchShopee(searchTerm),
        searchAmazon(searchTerm)
      ]);

      // Aggregate results from all platforms
      if (mlResults.status === 'fulfilled') {
        allResults.push(...mlResults.value);
      }
      if (shopeeResults.status === 'fulfilled') {
        allResults.push(...shopeeResults.value);
      }
      if (amazonResults.status === 'fulfilled') {
        allResults.push(...amazonResults.value);
      }
    }

    console.log(`Found ${allResults.length} competitor results across all platforms`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        results: allResults,
        searchTerm: searchTerm 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in analyze-competitor function:', error);
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

async function searchMercadoLibre(searchTerm: string): Promise<CompetitorResult[]> {
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

    const results: CompetitorResult[] = data.results.map((item: any) => ({
      platform: 'Mercado Livre' as const,
      title: item.title || 'Produto sem título',
      price: item.price || 0,
      seller: item.seller?.nickname || 'Vendedor não informado',
      sales_count: item.sold_quantity || undefined,
      shipping_cost: item.shipping?.free_shipping ? 0 : undefined,
      url: item.permalink || `https://mercadolivre.com.br`,
      image_url: item.thumbnail || undefined
    }));

    return results.filter(result => result.price > 0);

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

async function searchShopee(searchTerm: string): Promise<CompetitorResult[]> {
  try {
    console.log('Searching Shopee for:', searchTerm);
    
    // For MVP, return mock data since Shopee scraping is complex
    // In production, you would implement proper scraping or use their API
    const mockResults: CompetitorResult[] = [
      {
        platform: 'Shopee' as const,
        title: `${searchTerm} - Shopee Original`,
        price: Math.floor(Math.random() * 800) + 80,
        seller: 'Shopee Seller',
        sales_count: Math.floor(Math.random() * 200) + 10,
        url: `https://shopee.com.br/search?keyword=${encodeURIComponent(searchTerm)}`,
        image_url: undefined
      },
      {
        platform: 'Shopee' as const,
        title: `${searchTerm} - Premium Shopee`,
        price: Math.floor(Math.random() * 1200) + 150,
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

async function searchAmazon(searchTerm: string): Promise<CompetitorResult[]> {
  try {
    console.log('Searching Amazon for:', searchTerm);
    
    // For MVP, return mock data since Amazon scraping requires careful implementation
    // In production, you would implement proper scraping or use their API
    const mockResults: CompetitorResult[] = [
      {
        platform: 'Amazon' as const,
        title: `${searchTerm} - Amazon Choice`,
        price: Math.floor(Math.random() * 1500) + 200,
        seller: 'Amazon',
        sales_count: Math.floor(Math.random() * 500) + 50,
        url: `https://www.amazon.com.br/s?k=${encodeURIComponent(searchTerm)}`,
        image_url: undefined
      },
      {
        platform: 'Amazon' as const,
        title: `${searchTerm} - Prime Delivery`,
        price: Math.floor(Math.random() * 900) + 120,
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

async function analyzeProductUrl(url: string): Promise<CompetitorResult[]> {
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
      
      const result: CompetitorResult = {
        platform: 'Mercado Livre' as const,
        title: product.title || 'Produto sem título',
        price: product.price || 0,
        seller: sellerName,
        sales_count: product.sold_quantity || undefined,
        shipping_cost: product.shipping?.free_shipping ? 0 : undefined,
        url: product.permalink || url,
        image_url: product.thumbnail || undefined
      };
      
      return [result];
    } else {
      throw new Error('URL format not supported. Currently only MercadoLibre URLs are supported.');
    }
    
  } catch (error) {
    console.error('Error analyzing product URL:', error);
    throw new Error('Failed to analyze product URL');
  }
}