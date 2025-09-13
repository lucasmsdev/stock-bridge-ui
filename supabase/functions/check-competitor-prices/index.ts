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

// Fetch competitor price with failsafe scraping logic
async function fetchCompetitorPrice(url: string): Promise<number | null> {
  console.log(`(v3) 🛡️ [START] Fetching price from: ${url}`);
  try {
    // ETAPA 1: Fetch da página com timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // Timeout de 8 segundos

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`(v3) ❌ [FETCH FAIL] HTTP error ${response.status} for ${url}`);
      return null;
    }

    // ETAPA 2: Leitura e Parse do HTML
    const html = await response.text();
    console.log(`(v3) 📄 [HTML OK] HTML received, length: ${html.length}`);

    const doc = new DOMParser().parseFromString(html, "text/html");
    if (!doc) {
      console.error(`(v3) ❌ [PARSE FAIL] Could not parse HTML document.`);
      return null;
    }
    console.log(`(v3) ⚙️ [PARSE OK] Document parsed successfully.`);

    // ETAPA 3: Extração do Preço com Seletores Priorizados
    let priceText: string | null = null;
    const selectors = {
      mercadolivre: [
        '.ui-pdp-price__figure .andes-money-amount__fraction', // P1: Preço principal
        '.andes-money-amount__fraction' // P2: Fallback
      ],
      amazon: [
        '#corePrice_feature_div .a-offscreen', // P1: Preço principal
        '#priceblock_ourprice' // P2: Fallback
      ]
    };

    let platform: 'mercadolivre' | 'amazon' | null = null;
    if (url.includes('mercadolivre.com')) platform = 'mercadolivre';
    if (url.includes('amazon.com')) platform = 'amazon';

    if (platform) {
      for (const selector of selectors[platform]) {
        const element = doc.querySelector(selector);
        if (element) {
          priceText = element.textContent;
          console.log(`(v3) ✅ [SELECTOR OK] Found price text "${priceText}" with selector "${selector}"`);
          break; // Para no primeiro seletor que funcionar
        }
      }
    }

    if (!priceText) {
      console.error(`(v3) ❌ [EXTRACTION FAIL] Could not extract any price text.`);
      return null;
    }

    // ETAPA 4: Limpeza do Preço
    const numericPrice = cleanPrice(priceText); // Reutilize sua função cleanPrice

    if (numericPrice > 0) {
      console.log(`(v3) 💰 [SUCCESS] Final price: ${numericPrice}`);
      return numericPrice;
    } else {
      console.error(`(v3) ❌ [CLEAN FAIL] Failed to clean or parse price text: "${priceText}"`);
      return null;
    }

  } catch (error) {
    console.error(`(v3) 💥 [FATAL ERROR] An exception occurred in fetchCompetitorPrice:`, error);
    return null; // Garante que a função sempre retorne algo em caso de erro
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