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
    console.log('Starting Amazon SP-API authentication');

    // Get Amazon credentials from environment variables
    const clientId = Deno.env.get('AMAZON_CLIENT_ID');
    const clientSecret = Deno.env.get('AMAZON_CLIENT_SECRET');
    const refreshToken = Deno.env.get('AMAZON_REFRESH_TOKEN');

    if (!clientId || !clientSecret || !refreshToken) {
      console.error('Missing Amazon credentials in environment variables');
      return new Response(
        JSON.stringify({ 
          error: 'Amazon credentials not configured',
          details: 'Please configure AMAZON_CLIENT_ID, AMAZON_CLIENT_SECRET, and AMAZON_REFRESH_TOKEN in Supabase Edge Function secrets'
        }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Making request to Amazon LWA token endpoint');

    // Request access token from Amazon LWA
    const response = await fetch("https://api.amazon.com/auth/o2/token", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('Amazon LWA authentication failed:', responseData);
      return new Response(
        JSON.stringify({ 
          error: 'Authentication failed',
          details: responseData.error_description || responseData.error || 'Unknown error',
          status: response.status
        }), 
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Successfully obtained Amazon access token');

    return new Response(
      JSON.stringify({ 
        accessToken: responseData.access_token,
        tokenType: responseData.token_type,
        expiresIn: responseData.expires_in
      }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error in amazon-auth function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
