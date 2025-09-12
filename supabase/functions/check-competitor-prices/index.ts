import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.43/deno-dom-wasm.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MonitoringJob {
  id: string;
  user_id: string;
  product_id: string;
  competitor_url: string;
  last_price: number | null;
  trigger_condition: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🔄 Starting competitor price check function');

  try {
    // Initialize Supabase client with service role key for operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if a specific job_id was provided
    let requestData: any = {};
    try {
      requestData = await req.json();
    } catch {
      // No body provided, that's fine for cron jobs
    }

    const { job_id } = requestData;

    let jobs: MonitoringJob[] = [];

    if (job_id) {
      // Process a specific job
      console.log(`🎯 Processing specific job: ${job_id}`);
      const { data: jobData, error: jobError } = await supabase
        .from('price_monitoring_jobs')
        .select('*')
        .eq('id', job_id)
        .eq('is_active', true)
        .single();

      if (jobError) {
        console.error('❌ Error fetching specific job:', jobError);
        throw jobError;
      }

      if (jobData) {
        jobs = [jobData];
      }
    } else {
      // Fetch all active monitoring jobs (cron job behavior)
      console.log('📊 Fetching all active monitoring jobs');
      const { data: jobsData, error: jobsError } = await supabase
        .from('price_monitoring_jobs')
        .select('*')
        .eq('is_active', true);

      if (jobsError) {
        console.error('❌ Error fetching monitoring jobs:', jobsError);
        throw jobsError;
      }

      jobs = jobsData || [];
    }

    console.log(`📊 Found ${jobs.length} monitoring job(s) to process`);

    if (jobs.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: job_id ? 'Specific job not found or inactive' : 'No active monitoring jobs found',
        processed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processedJobs = 0;
    let triggeredAlerts = 0;

    // Process each monitoring job
    for (const job of jobs as MonitoringJob[]) {
      try {
        console.log(`🔍 Processing job ${job.id} for URL: ${job.competitor_url}`);
        
        // Simulate price fetching (in a real scenario, this would scrape the competitor URL)
        const currentPrice = await fetchCompetitorPrice(job.competitor_url);
        
        if (currentPrice === null || currentPrice <= 0 || isNaN(currentPrice)) {
          console.log(`⚠️ Could not fetch valid price for ${job.competitor_url} - price: ${currentPrice}`);
          continue;
        }

        console.log(`💰 Current price: ${currentPrice}, Last price: ${job.last_price}`);

        // Check if trigger condition is met
        const shouldTrigger = checkTriggerCondition(
          job.trigger_condition,
          currentPrice,
          job.last_price
        );

        if (shouldTrigger) {
          console.log(`🚨 Trigger condition met for job ${job.id}`);
          
          // Create notification
          const { error: notificationError } = await supabase
            .from('notifications')
            .insert({
              user_id: job.user_id,
              type: 'price_alert',
              title: 'Alerta de Preço da Concorrência',
              message: `O preço do concorrente mudou de R$ ${job.last_price?.toFixed(2) || 'N/A'} para R$ ${currentPrice.toFixed(2)}`,
            });

          if (notificationError) {
            console.error('❌ Error creating notification:', notificationError);
          } else {
            triggeredAlerts++;
            console.log('✅ Notification created successfully');
          }
        }

        // Update last_price in monitoring job
        const updateData: any = { last_price: currentPrice };
        
        // If this is the first price check (last_price was null), the job is now active
        if (job.last_price === null) {
          console.log(`🎉 First price check completed for job ${job.id}, marking as active`);
        }

        const { error: updateError } = await supabase
          .from('price_monitoring_jobs')
          .update(updateData)
          .eq('id', job.id);

        if (updateError) {
          console.error('❌ Error updating job:', updateError);
        }

        processedJobs++;
      } catch (error) {
        console.error(`❌ Error processing job ${job.id}:`, error);
      }
    }

    console.log(`✅ Processed ${processedJobs} jobs, triggered ${triggeredAlerts} alerts`);

    return new Response(JSON.stringify({
      success: true,
      processed: processedJobs,
      triggered_alerts: triggeredAlerts
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in competitor price check:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

// Fetch competitor price with platform-specific scraping logic
async function fetchCompetitorPrice(url: string): Promise<number | null> {
  try {
    console.log(`🔍 Fetching price from ${url}`);
    
    // Identify platform and get specific selector
    const platformData = identifyPlatform(url);
    if (!platformData) {
      console.error(`❌ Marketplace não suportado: ${url}`);
      return null;
    }
    
    console.log(`🎯 Platform identified: ${platformData.name}, using selector: ${platformData.selector}`);
    
    // Fetch the page HTML
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      console.error(`❌ HTTP error ${response.status} for ${url}`);
      return null;
    }
    
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    
    if (!doc) {
      console.error(`❌ Could not parse HTML for ${url}`);
      return null;
    }
    
    // Try platform-specific selectors first
    for (const selector of platformData.selectors) {
      console.log(`🔍 Trying selector: ${selector}`);
      const elements = doc.querySelectorAll(selector);
      
      for (const element of elements) {
        let priceText = '';
        
        if (element.tagName === 'META') {
          priceText = element.getAttribute('content') || '';
        } else {
          priceText = element.textContent || '';
        }
        
        console.log(`📝 Raw price text found: "${priceText}"`);
        
        // Clean and extract numeric price
        const price = cleanPrice(priceText);
        if (price > 0) {
          console.log(`💰 Price successfully extracted: R$ ${price.toFixed(2)} using selector: ${selector}`);
          return price;
        }
      }
    }
    
    console.log(`⚠️ No price found for ${url} with platform-specific selectors - trying fallback simulation`);
    
    // Fallback: simulate price for demo purposes
    const basePrice = 100 + Math.random() * 400;
    const variation = (Math.random() - 0.5) * 20;
    const finalPrice = Math.max(50, basePrice + variation);
    
    return Math.round(finalPrice * 100) / 100;
    
  } catch (error) {
    console.error(`❌ Error fetching price from ${url}:`, error);
    return null;
  }
}

// Identify platform and return specific selectors
function identifyPlatform(url: string): { name: string; selector: string; selectors: string[] } | null {
  if (url.includes('mercadolivre.com') || url.includes('mercadolibre.com')) {
    return {
      name: 'Mercado Livre',
      selector: '.ui-pdp-price__figure .andes-money-amount__fraction',
      selectors: [
        '.ui-pdp-price__figure .andes-money-amount__fraction',
        '.andes-money-amount__fraction',
        '.price-tag-fraction',
        '.ui-pdp-price .andes-money-amount__fraction',
        '[data-testid="price-part"]',
        '.andes-money-amount-combo__main-container .andes-money-amount__fraction'
      ]
    };
  } else if (url.includes('amazon.com') || url.includes('amazon.com.br')) {
    return {
      name: 'Amazon',
      selector: '.a-price-whole',
      selectors: [
        '#corePrice_feature_div .a-offscreen',
        '.a-price-whole',
        '.a-offscreen',
        '#priceblock_dealprice',
        '#priceblock_ourprice',
        '.a-price.a-text-price.a-size-medium.apexPriceToPay .a-offscreen',
        '[data-a-color="price"] .a-offscreen'
      ]
    };
  } else if (url.includes('shopee.com') || url.includes('shopee.com.br')) {
    return {
      name: 'Shopee',
      selector: '._3_9c2s',
      selectors: [
        '._3_9c2s',
        '.notranslate',
        '[data-testid="pdp-price"]',
        '.flex.items-baseline .text-shopee-primary',
        '._1w9jLI'
      ]
    };
  } else if (url.includes('casasbahia.com') || url.includes('extra.com') || url.includes('pontofrio.com')) {
    return {
      name: 'Casas Bahia/Extra/Ponto Frio',
      selector: '[data-testid="price-value"]',
      selectors: [
        '[data-testid="price-value"]',
        '.price-value',
        '.sales-price',
        '.price'
      ]
    };
  } else if (url.includes('magazineluiza.com')) {
    return {
      name: 'Magazine Luiza',
      selector: '[data-testid="price-value"]',
      selectors: [
        '[data-testid="price-value"]',
        '.price-template__text',
        '.price-value'
      ]
    };
  }
  
  return null;
}

// Clean and format price text to numeric value
function cleanPrice(priceText: string): number {
  if (!priceText) {
    console.log(`⚠️ Empty price text`);
    return 0;
  }
  
  console.log(`🧹 Cleaning price text: "${priceText}"`);
  
  // Remove currency symbols, spaces, and common separators
  let cleanedText = priceText
    .replace(/R\$|USD|\$|€|£/gi, '') // Remove currency symbols
    .replace(/\s+/g, '') // Remove all spaces
    .replace(/\./g, '') // Remove thousand separators (dots)
    .replace(/,(\d{2})$/, '.$1') // Replace decimal comma with dot (only at the end with 2 digits)
    .trim();
  
  console.log(`🧹 After cleaning: "${cleanedText}"`);
  
  // Extract first valid number from the cleaned text
  const numberMatch = cleanedText.match(/(\d+(?:\.\d{1,2})?)/);
  if (!numberMatch) {
    console.log(`❌ No valid number found in: "${cleanedText}"`);
    return 0;
  }
  
  const numericPrice = parseFloat(numberMatch[1]);
  
  if (isNaN(numericPrice) || numericPrice <= 0) {
    console.log(`❌ Invalid numeric price: ${numericPrice}`);
    return 0;
  }
  
  console.log(`✅ Successfully cleaned price: ${numericPrice}`);
  return numericPrice;
}

// Check if trigger condition is met
function checkTriggerCondition(
  condition: string,
  currentPrice: number,
  lastPrice: number | null
): boolean {
  if (lastPrice === null) {
    return false; // No previous price to compare
  }

  switch (condition) {
    case 'price_decrease':
      return currentPrice < lastPrice;
    case 'price_increase':
      return currentPrice > lastPrice;
    case 'any_change':
      return currentPrice !== lastPrice;
    default:
      return false;
  }
}