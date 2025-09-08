import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Shopify auth callback received');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get the user from the request
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      console.error('Authentication error:', userError);
      return new Response(
        JSON.stringify({ error: 'User not authenticated' }), 
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Authenticated user:', user.id);

    const { code, shop, state } = await req.json();

    if (!code || !shop) {
      console.error('Missing code or shop parameter');
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Processing Shopify auth for shop:', shop);

    // Get Shopify app credentials
    const shopifyApiKey = Deno.env.get('SHOPIFY_API_KEY');
    const shopifyApiSecret = Deno.env.get('SHOPIFY_API_SECRET_KEY');

    if (!shopifyApiKey || !shopifyApiSecret) {
      console.error('Shopify credentials not configured');
      return new Response(
        JSON.stringify({ error: 'Shopify credentials not configured' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Exchange authorization code for access token
    const tokenUrl = `https://${shop}.myshopify.com/admin/oauth/access_token`;
    const tokenData = {
      client_id: shopifyApiKey,
      client_secret: shopifyApiSecret,
      code: code,
    };

    console.log('Exchanging code for access token');

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tokenData),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Error exchanging code for token:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to exchange authorization code' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const tokenResult = await tokenResponse.json();
    const accessToken = tokenResult.access_token;

    if (!accessToken) {
      console.error('No access token received');
      return new Response(
        JSON.stringify({ error: 'No access token received' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Access token received successfully');

    // Store the integration in database
    const integrationData = {
      user_id: user.id,
      platform: 'shopify',
      access_token: accessToken,
      refresh_token: null, // Shopify doesn't use refresh tokens
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: integration, error: insertError } = await supabaseClient
      .from('integrations')
      .upsert(integrationData, { 
        onConflict: 'user_id, platform',
        ignoreDuplicates: false 
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error saving integration:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save integration' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Integration saved successfully:', integration.id);

    return new Response(
      JSON.stringify({ 
        message: 'Shopify integration successful',
        integration_id: integration.id,
        shop: shop
      }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error in shopify-auth function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});