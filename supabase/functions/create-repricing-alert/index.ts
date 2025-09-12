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
    
    // Get Authorization header
    const authHeader = req.headers.get('Authorization');
    console.log('📋 Auth header:', authHeader?.substring(0, 20) + '...');
    
    if (!authHeader) {
      console.error('❌ No Authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialize Supabase client with service role key for server-side operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Verify JWT token manually
    const token = authHeader.replace('Bearer ', '');
    console.log('🔑 Token extracted, length:', token.length);
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    console.log('👤 User authenticated:', !!user, 'User ID:', user?.id);
    
    if (authError || !user) {
      console.error('❌ Authentication error:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: authError?.message }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const requestData: CreateAlertRequest = await req.json();
    const { product_id, competitor_url, trigger_condition } = requestData;

    console.log('📊 Request data:', { product_id, competitor_url, trigger_condition });

    if (!product_id || !competitor_url || !trigger_condition) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Save the alert to database with pending status
    console.log(`💾 Saving alert to database with pending status`);
    
    const { data: newAlert, error: insertError } = await supabaseClient
      .from('price_monitoring_jobs')
      .insert({
        user_id: user.id,
        product_id,
        competitor_url,
        trigger_condition,
        last_price: null, // Will be set after first check
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

    // Start background price check for this specific job
    console.log('🔄 Triggering background price check for job:', newAlert.id);
    try {
      // Call check-competitor-prices function asynchronously for this specific job
      supabaseClient.functions.invoke('check-competitor-prices', {
        body: { job_id: newAlert.id }
      }).then((result) => {
        if (result.error) {
          console.error('❌ Background price check failed:', result.error);
        } else {
          console.log('✅ Background price check completed successfully');
        }
      }).catch((error) => {
        console.error('❌ Background price check error:', error);
      });
    } catch (backgroundError) {
      console.error('❌ Failed to start background price check:', backgroundError);
      // Don't fail the main request if background job fails to start
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        alert: newAlert,
        message: 'Alert created successfully. Price verification in progress.'
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
