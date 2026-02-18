import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PARTNER_ID = Deno.env.get("SHOPEE_PARTNER_ID")?.trim()?.replace(/[^\d]/g, '') || "";
    const PARTNER_KEY_RAW = Deno.env.get("SHOPEE_PARTNER_KEY")?.trim() || "";
    // Remove any invisible/zero-width characters, keep only valid hex + lowercase alpha
    const PARTNER_KEY = PARTNER_KEY_RAW.replace(/[\s\u200B\u200C\u200D\uFEFF\u00A0]/g, '');
    // Remove "shpk" prefix - Shopee HMAC uses only the hex portion
    const PARTNER_KEY_CLEAN = PARTNER_KEY.startsWith('shpk') 
      ? PARTNER_KEY.slice(4) 
      : PARTNER_KEY;

    const APP_URL = Deno.env.get("APP_URL") || "https://id-preview--be7c1eba-2174-4e2e-a9f0-aa07602a3be7.lovable.app";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

    if (!PARTNER_ID || !PARTNER_KEY_CLEAN) {
      return new Response(JSON.stringify({ error: "Shopee credentials not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate user auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build Shopee auth URL
    const timestamp = Math.floor(Date.now() / 1000);
    const callbackUrl = `${SUPABASE_URL}/functions/v1/shopee-callback`;
    const path = "/api/v2/shop/auth_partner";
    const partnerId = parseInt(PARTNER_ID);

    // Generate sign: HMAC-SHA256(partner_key, partner_id + path + timestamp)
    const baseString = `${partnerId}${path}${timestamp}`;
    const encoder = new TextEncoder();
    
    console.log("🟠 PARTNER_KEY raw length:", PARTNER_KEY.length);
    console.log("🟠 PARTNER_KEY clean (sem prefixo) length:", PARTNER_KEY_CLEAN.length);
    console.log("🟠 baseString:", baseString);
    console.log("🟠 partnerId:", partnerId);
    console.log("🟠 timestamp:", timestamp);
    
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(PARTNER_KEY_CLEAN),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(baseString));
    const sign = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    console.log("🟠 Debug - generated sign:", sign);

    // Encode user_id in the redirect URL so callback can associate the tokens
    const redirectUrl = `${callbackUrl}?state=${user.id}`;

    // Use test endpoint while app is in "Developing" status
    const baseHost = "partner.test-stable.shopeemobile.com";
    const authUrl = `https://${baseHost}${path}` +
      `?partner_id=${partnerId}` +
      `&timestamp=${timestamp}` +
      `&sign=${sign}` +
      `&redirect=${encodeURIComponent(redirectUrl)}`;

    console.log("🟠 Shopee auth URL generated:", authUrl);

    return new Response(JSON.stringify({ url: authUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Shopee auth error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
