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

// Fetch competitor price using robust multi-layer scraping strategy
async function fetchCompetitorPrice(url: string): Promise<number | null> {
  try {
    console.log(`[V2] 🔍 Iniciando busca de preço para: ${url}`);

    // ETAPA 1: Usar um User-Agent mais realista para evitar bloqueios simples.
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Connection': 'keep-alive',
    };

    const response = await fetch(url, { headers });

    if (!response.ok) {
      console.error(`[V2] ❌ Erro de HTTP ${response.status} ao buscar a URL.`);
      return null;
    }

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");

    if (!doc) {
      console.error("[V2] ❌ Falha ao parsear o HTML do documento.");
      return null;
    }

    // ETAPA 2: Estratégia de busca em camadas.

    // Camada 1: Buscar dados estruturados (JSON-LD) - A MAIS CONFIÁVEL
    const scriptElement = doc.querySelector('script[type="application/ld+json"]');
    if (scriptElement) {
      try {
        const jsonData = JSON.parse(scriptElement.textContent || '{}');
        // Navegue pela estrutura do JSON para encontrar o preço.
        // O caminho exato pode variar, mas geralmente está em "offers".
        const price = jsonData?.offers?.price || jsonData?.offers?.lowPrice;
        if (price && !isNaN(price)) {
          console.log(`[V2] ✅ Preço encontrado via JSON-LD: ${price}`);
          return parseFloat(price);
        }
      } catch (e) {
        console.log('[V2] ⚠️ JSON-LD encontrado, mas falhou ao parsear ou encontrar o preço.');
      }
    }

    // Camada 2: Buscar por seletores de CSS específicos (Nossa abordagem anterior, agora como fallback)
    const priceSelectors = [
      '.ui-pdp-price__figure .andes-money-amount__fraction', // Seletor principal
      '.andes-money-amount.ui-pdp-price__part--medium .andes-money-amount__fraction', // Outra variação
      'meta[itemprop="price"]' // Meta tag de preço
    ];

    for (const selector of priceSelectors) {
      const element = doc.querySelector(selector);
      if (element) {
        const priceText = element.tagName === 'META' ? element.getAttribute('content') : element.textContent;
        if (priceText) {
          const cleanedPrice = cleanPrice(priceText); // Usa a sua função de limpeza existente
          if (cleanedPrice > 0) {
            console.log(`[V2] ✅ Preço encontrado via seletor de CSS "${selector}": ${cleanedPrice}`);
            return cleanedPrice;
          }
        }
      }
    }

    // Camada 3: Se tudo falhar, registre um erro claro.
    console.error(`[V2] ❌ FALHA TOTAL: Não foi possível extrair o preço para a URL. O site pode ter mudado.`);
    return null;

  } catch (error) {
    console.error(`[V2] ❌ Erro fatal na função fetchCompetitorPrice:`, error);
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