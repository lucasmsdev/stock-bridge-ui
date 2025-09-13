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

// Fetch competitor price using Browserless API to bypass anti-scraping
async function fetchCompetitorPrice(url: string): Promise<number | null> {
  console.log(`(v4) 🌐 [BROWSERLESS] Starting fetch for: ${url}`);
  
  try {
    const BROWSERLESS_API_KEY = Deno.env.get('BROWSERLESS_API_KEY');
    if (!BROWSERLESS_API_KEY) {
      console.log(`(v4) ⚠️ [FALLBACK] BROWSERLESS_API_KEY not configured, using direct fetch`);
      return await fetchWithDirectMethod(url);
    }

    // ETAPA 1: Chamada para Browserless API
    const api_url = `https://chrome.browserless.io/content?token=${BROWSERLESS_API_KEY}`;
    console.log(`(v4) 🚀 [API CALL] Calling Browserless API...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // Timeout de 15s

    const response = await fetch(api_url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify({
        url: url,
        waitFor: 2000, // Espera 2s para o JS da página carregar
        options: {
          viewport: { width: 1920, height: 1080 }
        }
      }),
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`(v4) ❌ [API ERROR] Browserless API error ${response.status}, falling back to direct fetch`);
      return await fetchWithDirectMethod(url);
    }

    // ETAPA 2: Parse do HTML retornado
    const html = await response.text();
    console.log(`(v4) 📄 [HTML OK] HTML received, length: ${html.length}`);

    if (!html || html.length < 100) {
      console.error(`(v4) ❌ [HTML ERROR] Invalid HTML response, falling back to direct fetch`);
      return await fetchWithDirectMethod(url);
    }

    return await extractPriceFromHtml(html, url);

  } catch (error) {
    console.error(`(v4) 💥 [BROWSERLESS ERROR] Browserless failed, trying direct fetch:`, error);
    return await fetchWithDirectMethod(url);
  }
}

// Fallback method using direct fetch
async function fetchWithDirectMethod(url: string): Promise<number | null> {
  console.log(`(v4) 🔄 [DIRECT] Trying direct fetch for: ${url}`);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // Timeout de 10s

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`(v4) ❌ [DIRECT ERROR] HTTP error ${response.status}`);
      return null;
    }

    const html = await response.text();
    console.log(`(v4) 📄 [DIRECT HTML] HTML received, length: ${html.length}`);

    return await extractPriceFromHtml(html, url);

  } catch (error) {
    console.error(`(v4) 💥 [DIRECT FATAL] Direct fetch failed:`, error);
    return null;
  }
}

// Extract price from HTML content
async function extractPriceFromHtml(html: string, url: string): Promise<number | null> {
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    if (!doc) {
      console.error(`(v4) ❌ [PARSE FAIL] Could not parse HTML document.`);
      return null;
    }
    console.log(`(v4) ⚙️ [PARSE OK] Document parsed successfully.`);

    // ETAPA 3: Extração do Preço com Seletores Priorizados
    let priceText: string | null = null;
    const selectors = {
      mercadolivre: [
        '.ui-pdp-price__figure .andes-money-amount__fraction', // P1: Preço principal
        '.andes-money-amount__fraction', // P2: Fallback
        '[data-testid="price"] .andes-money-amount__fraction' // P3: Testid fallback
      ],
      amazon: [
        '#corePrice_feature_div .a-offscreen', // P1: Preço principal
        '#priceblock_ourprice', // P2: Fallback
        '.a-price .a-offscreen' // P3: General price fallback
      ]
    };

    let platform: 'mercadolivre' | 'amazon' | null = null;
    if (url.includes('mercadolivre.com') || url.includes('mercadolibre.com')) platform = 'mercadolivre';
    if (url.includes('amazon.com')) platform = 'amazon';

    if (platform) {
      console.log(`(v4) 🎯 [PLATFORM] Detected: ${platform}`);
      for (const selector of selectors[platform]) {
        const element = doc.querySelector(selector);
        if (element && element.textContent?.trim()) {
          priceText = element.textContent.trim();
          console.log(`(v4) ✅ [SELECTOR OK] Found price text "${priceText}" with selector "${selector}"`);
          break; // Para no primeiro seletor que funcionar
        }
      }
    } else {
      console.log(`(v4) ⚠️ [PLATFORM] Unknown platform, trying generic selectors`);
      // Fallback para plataformas desconhecidas
      const genericSelectors = [
        '[class*="price"]', 
        '[id*="price"]', 
        '[data-testid*="price"]'
      ];
      for (const selector of genericSelectors) {
        const elements = doc.querySelectorAll(selector);
        for (const element of elements) {
          const text = element.textContent?.trim();
          if (text && /[\d,.]/.test(text)) {
            priceText = text;
            console.log(`(v4) ✅ [GENERIC] Found price text "${priceText}" with selector "${selector}"`);
            break;
          }
        }
        if (priceText) break;
      }
    }

    if (!priceText) {
      console.error(`(v4) ❌ [EXTRACTION FAIL] Could not extract any price text.`);
      return null;
    }

    // ETAPA 4: Limpeza do Preço
    console.log(`(v4) 🧹 [CLEANING] Raw price text: "${priceText}"`);
    const numericPrice = cleanPrice(priceText);

    if (numericPrice > 0) {
      console.log(`(v4) 💰 [SUCCESS] Final price: ${numericPrice}`);
      return numericPrice;
    } else {
      console.error(`(v4) ❌ [CLEAN FAIL] Failed to clean price text: "${priceText}" -> ${numericPrice}`);
      return null;
    }

  } catch (error) {
    console.error(`(v4) 💥 [EXTRACTION ERROR] HTML parsing failed:`, error);
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