import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

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

  console.log('🔄 Starting competitor price check cron job');

  try {
    // Initialize Supabase client with service role key for cron operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch all active monitoring jobs
    const { data: jobs, error: jobsError } = await supabase
      .from('price_monitoring_jobs')
      .select('*')
      .eq('is_active', true);

    if (jobsError) {
      console.error('❌ Error fetching monitoring jobs:', jobsError);
      throw jobsError;
    }

    console.log(`📊 Found ${jobs?.length || 0} active monitoring jobs`);

    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No active monitoring jobs found',
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
        
        if (currentPrice === null) {
          console.log(`⚠️ Could not fetch price for ${job.competitor_url}`);
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
        const { error: updateError } = await supabase
          .from('price_monitoring_jobs')
          .update({ last_price: currentPrice })
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

// Simulate fetching competitor price (placeholder implementation)
async function fetchCompetitorPrice(url: string): Promise<number | null> {
  try {
    // In a real implementation, this would scrape the competitor website
    // For demo purposes, we'll return a random price
    console.log(`🎭 Simulating price fetch for ${url}`);
    
    // Generate a random price between 50 and 500
    const basePrice = 100 + Math.random() * 400;
    const variation = (Math.random() - 0.5) * 20; // ±10 variation
    const finalPrice = Math.max(50, basePrice + variation);
    
    return Math.round(finalPrice * 100) / 100; // Round to 2 decimal places
  } catch (error) {
    console.error(`❌ Error fetching price from ${url}:`, error);
    return null;
  }
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