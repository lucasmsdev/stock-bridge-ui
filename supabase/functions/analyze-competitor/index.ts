import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompetitorResult {
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
    let results: CompetitorResult[] = [];

    if (isUrl) {
      // If it's a URL, try to extract product info from it
      results = await analyzeProductUrl(searchTerm);
    } else {
      // If it's a search term, search for products
      results = await searchCompetitors(searchTerm);
    }

    console.log(`Found ${results.length} competitor results`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        results: results,
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

async function searchCompetitors(searchTerm: string): Promise<CompetitorResult[]> {
  try {
    // Use MercadoLibre's public API to search for products
    const searchUrl = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(searchTerm)}&limit=20`;
    
    console.log('Fetching from MercadoLibre API:', searchUrl);
    
    const response = await fetch(searchUrl);
    
    if (!response.ok) {
      throw new Error(`MercadoLibre API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.results || !Array.isArray(data.results)) {
      console.log('No results found in API response');
      return [];
    }

    const results: CompetitorResult[] = data.results.map((item: any) => ({
      title: item.title || 'Produto sem título',
      price: item.price || 0,
      seller: item.seller?.nickname || 'Vendedor não informado',
      sales_count: item.sold_quantity || undefined,
      shipping_cost: item.shipping?.free_shipping ? 0 : undefined,
      url: item.permalink || `https://mercadolivre.com.br`,
      image_url: item.thumbnail || undefined
    }));

    // Filter out products with invalid prices
    return results.filter(result => result.price > 0);

  } catch (error) {
    console.error('Error searching competitors:', error);
    throw new Error('Failed to search for competitors');
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