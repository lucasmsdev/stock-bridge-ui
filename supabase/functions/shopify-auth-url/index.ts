import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    console.log('Generating Shopify auth URL');

    const { shop, scopes, redirect_uri, state } = await req.json();

    if (!shop || !scopes || !redirect_uri || !state) {
      console.error('Missing required parameters');
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get Shopify app credentials
    const shopifyApiKey = Deno.env.get('SHOPIFY_API_KEY');

    if (!shopifyApiKey) {
      console.error('Shopify API key not configured');
      return new Response(
        JSON.stringify({ 
          error: 'Shopify API key not configured',
          details: 'Please configure SHOPIFY_API_KEY in Supabase Edge Function secrets'
        }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create OAuth URL
    const authUrl = `https://${shop}.myshopify.com/admin/oauth/authorize` +
      `?client_id=${shopifyApiKey}` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&redirect_uri=${encodeURIComponent(redirect_uri)}` +
      `&state=${state}`;

    console.log('Auth URL generated successfully for shop:', shop);

    return new Response(
      JSON.stringify({ auth_url: authUrl }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error in shopify-auth-url function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});