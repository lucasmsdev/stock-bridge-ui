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

// Fetch competitor price with prioritized scraping logic
async function fetchCompetitorPrice(url: string): Promise<number | null> {
  try {
    console.log(`(v2) 🕵️‍♂️ Fetching price from: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      console.error(`(v2) ❌ HTTP error ${response.status} for ${url}`);
      return null;
    }

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");

    if (!doc) {
      console.error(`(v2) ❌ Could not parse HTML for ${url}`);
      return null;
    }

    // --- LÓGICA DE EXTRAÇÃO PRIORIZADA ---

    let priceText: string | null = null;

    if (url.includes('mercadolivre.com') || url.includes('mercadolibre.com')) {
      console.log('(v2) 🎯 Platform: Mercado Livre');
      // PRIORIDADE 1: O preço principal dentro da figura de preço. Este é o mais confiável.
      const mainPriceElement = doc.querySelector('.ui-pdp-price__figure .andes-money-amount__fraction');
      if (mainPriceElement) {
        priceText = mainPriceElement.textContent;
        console.log(`(v2) ✅ [ML-P1] Found main price: "${priceText}"`);
      } else {
        // PRIORIDADE 2: Se o primeiro falhar, tente um seletor de fallback comum.
        const fallbackPriceElement = doc.querySelector('.andes-money-amount__fraction');
        if (fallbackPriceElement) {
          priceText = fallbackPriceElement.textContent;
          console.log(`(v2) ⚠️ [ML-P2] Found fallback price: "${priceText}"`);
        } else {
           console.log(`(v2) ❌ [ML] No price element found.`);
        }
      }
    } else if (url.includes('amazon.com')) {
      console.log('(v2) 🎯 Platform: Amazon');
      // PRIORIDADE 1: O preço dentro da "Core Price Box", que é o principal.
      const corePriceElement = doc.querySelector('#corePrice_feature_div .a-offscreen');
      if (corePriceElement) {
        priceText = corePriceElement.textContent;
        console.log(`(v2) ✅ [AMZ-P1] Found core price: "${priceText}"`);
      } else {
        // PRIORIDADE 2: Tente o "priceblock", usado em layouts mais antigos ou ofertas.
        const priceBlockElement = doc.querySelector('#priceblock_ourprice, #priceblock_dealprice');
        if (priceBlockElement) {
          priceText = priceBlockElement.textContent;
          console.log(`(v2) ⚠️ [AMZ-P2] Found price block price: "${priceText}"`);
        } else {
          console.log(`(v2) ❌ [AMZ] No price element found.`);
        }
      }
    }
    // Adicione outras plataformas aqui (else if...)

    if (!priceText) {
      console.error(`(v2) ❌ Could not extract any price text from the page.`);
      return null;
    }

    console.log(`(v2) 📝 Raw price text extracted: "${priceText}"`);
    const numericPrice = cleanPrice(priceText); // Reutilize sua função cleanPrice

    if (numericPrice > 0) {
      console.log(`(v2) 💰 Price successfully extracted and cleaned: ${numericPrice}`);
      return numericPrice;
    } else {
      console.error(`(v2) ❌ Failed to clean or parse price. Final value: ${numericPrice}`);
      return null;
    }

  } catch (error) {
    console.error(`(v2) ❌ Fatal error in fetchCompetitorPrice:`, error);
    return null;
  }
}

// Clean and format price text to numeric value
function cleanPrice(priceText: string): number {
  if (!priceText) {
    console.log(`⚠️ Empty price text provided to cleanPrice()`);
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
  
  console.log(`🧹 After initial cleaning: "${cleanedText}"`);
  
  // Handle special cases like "1234,56" (Brazilian format)
  if (cleanedText.includes(',') && !cleanedText.includes('.')) {
    cleanedText = cleanedText.replace(',', '.');
    console.log(`🇧🇷 Brazilian format detected, converted comma to dot: "${cleanedText}"`);
  }
  
  // Extract first valid number from the cleaned text
  const numberMatch = cleanedText.match(/(\d+(?:\.\d{1,2})?)/);
  if (!numberMatch) {
    console.log(`❌ No valid number pattern found in: "${cleanedText}"`);
    return 0;
  }
  
  const numericPrice = parseFloat(numberMatch[1]);
  
  if (isNaN(numericPrice) || numericPrice <= 0) {
    console.log(`❌ Invalid numeric price after parsing: ${numericPrice}`);
    return 0;
  }
  
  console.log(`✅ Successfully cleaned price: ${numericPrice} (from original: "${priceText}")`);
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