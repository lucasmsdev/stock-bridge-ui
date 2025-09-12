import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateAlertRequest {
  product_id: string;
  competitor_url: string;
  trigger_condition: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Create repricing alert function called');
    
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get user from JWT token
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      console.error('❌ Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const requestData: CreateAlertRequest = await req.json();
    const { product_id, competitor_url, trigger_condition } = requestData;

    if (!product_id || !competitor_url || !trigger_condition) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`📊 Scraping price from: ${competitor_url}`);

    // Fetch and scrape the competitor price
    let initialPrice: number | null = null;
    
    try {
      const scrapeResponse = await fetch(competitor_url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      if (!scrapeResponse.ok) {
        throw new Error(`HTTP ${scrapeResponse.status}: ${scrapeResponse.statusText}`);
      }

      const html = await scrapeResponse.text();
      console.log(`📄 Fetched HTML from ${competitor_url} (${html.length} chars)`);

      // Parse HTML using DOMParser
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Common price selectors for Brazilian e-commerce sites
      const priceSelectors = [
        '.price',
        '.valor',
        '.preco',
        '.price-current',
        '.price-value',
        '.price-box .price',
        '.product-price',
        '.selling-price',
        '.best-price',
        '.skuBestPrice',
        '[data-testid="price-value"]',
        '[data-price]',
        '.pdp-price',
        '.currency',
        '.notranslate',
        // Mercado Livre specific
        '.andes-money-amount__fraction',
        '.price-tag-fraction',
        // Magazine Luiza specific
        '[data-testid="price-value"]',
        // Amazon specific
        '.a-price-whole',
        '.a-offscreen',
        // Americanas specific
        '[data-testid="price-original"]'
      ];

      for (const selector of priceSelectors) {
        const priceElement = doc.querySelector(selector);
        if (priceElement) {
          const priceText = priceElement.textContent?.trim() || '';
          console.log(`🎯 Found price element with selector "${selector}": "${priceText}"`);
          
          const extractedPrice = extractPriceFromText(priceText);
          if (extractedPrice !== null && extractedPrice > 0) {
            initialPrice = extractedPrice;
            console.log(`✅ Successfully extracted price: R$ ${initialPrice}`);
            break;
          }
        }
      }

      // If no price found with selectors, try meta tags
      if (initialPrice === null) {
        console.log('🔍 No price found with selectors, trying meta tags...');
        
        const metaSelectors = [
          'meta[property="product:price:amount"]',
          'meta[property="og:price:amount"]',
          'meta[name="price"]',
          'meta[property="price"]'
        ];

        for (const metaSelector of metaSelectors) {
          const metaElement = doc.querySelector(metaSelector);
          if (metaElement) {
            const content = metaElement.getAttribute('content') || '';
            console.log(`🏷️ Found meta price: "${content}"`);
            
            const extractedPrice = extractPriceFromText(content);
            if (extractedPrice !== null && extractedPrice > 0) {
              initialPrice = extractedPrice;
              console.log(`✅ Successfully extracted price from meta: R$ ${initialPrice}`);
              break;
            }
          }
        }
      }

    } catch (scrapeError) {
      console.error('❌ Error scraping competitor price:', scrapeError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch competitor price. Please check if the URL is valid and accessible.',
          details: scrapeError.message 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Save the alert to database
    console.log(`💾 Saving alert to database with initial price: ${initialPrice}`);
    
    const { data: newAlert, error: insertError } = await supabaseClient
      .from('price_monitoring_jobs')
      .insert({
        user_id: user.id,
        product_id,
        competitor_url,
        trigger_condition,
        last_price: initialPrice,
        is_active: true
      })
      .select(`
        id,
        product_id,
        competitor_url,
        last_price,
        trigger_condition,
        is_active,
        created_at,
        products (
          name,
          sku
        )
      `)
      .single();

    if (insertError) {
      console.error('❌ Database insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create alert', details: insertError.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('✅ Alert created successfully:', newAlert.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        alert: newAlert,
        initialPrice 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Helper function to extract price from text
function extractPriceFromText(text: string): number | null {
  if (!text) return null;
  
  // Remove common currency symbols and clean the text
  let cleanText = text
    .replace(/[R$\s]/g, '') // Remove R$, spaces
    .replace(/\./g, '') // Remove thousands separators (dots in Brazilian format)
    .replace(/,(\d{2})$/, '.$1') // Convert comma decimal separator to dot (e.g., 99,90 -> 99.90)
    .trim();

  // Extract numeric value using regex
  const priceMatch = cleanText.match(/(\d+(?:\.\d{1,2})?)/);
  
  if (priceMatch) {
    const price = parseFloat(priceMatch[1]);
    if (!isNaN(price) && price > 0) {
      return price;
    }
  }
  
  return null;
}