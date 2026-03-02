import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { category_id, price } = await req.json();

    if (!price) {
      return new Response(
        JSON.stringify({ error: "price is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's ML access token from integrations
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let accessToken: string | null = null;

    if (authHeader) {
      const jwt = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(jwt);

      if (user) {
        // Try to get ML integration token
        const { data: integration } = await supabase
          .from("integrations")
          .select("encrypted_access_token")
          .eq("user_id", user.id)
          .eq("platform", "mercadolivre")
          .single();

        if (integration?.encrypted_access_token) {
          const { data: decrypted } = await supabase.rpc("decrypt_token", {
            encrypted_token: integration.encrypted_access_token,
          });
          accessToken = decrypted;
        }
      }
    }

    // Build URL
    let url = `https://api.mercadolibre.com/sites/MLB/listing_prices?price=${encodeURIComponent(price)}`;
    if (category_id) {
      url += `&category_id=${encodeURIComponent(category_id)}`;
    }

    // Make request with or without auth
    const headers: Record<string, string> = {};
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ML API error:", response.status, errorText);

      // If auth failed, try without token as fallback
      if (response.status === 401 || response.status === 403) {
        const fallbackResponse = await fetch(url);
        if (fallbackResponse.ok) {
          const data = await fallbackResponse.json();
          return processMLResponse(data, price, category_id);
        }
      }

      return new Response(
        JSON.stringify({ 
          error: `Mercado Livre API returned ${response.status}`, 
          details: errorText,
          requires_auth: response.status === 401 || response.status === 403,
          message: "Para consultar taxas do Mercado Livre, conecte sua conta na página de Integrações."
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    return processMLResponse(data, price, category_id);
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function processMLResponse(data: any, price: number, category_id: string | null) {
  // Extract fee information
  const fees = (data || []).map((item: any) => ({
    listing_type_id: item.listing_type_id,
    listing_type_name: item.listing_type_name,
    sale_fee_amount: item.sale_fee_amount,
    sale_fee_percentage: item.sale_fee_amount != null ? (item.sale_fee_amount / price) * 100 : 0,
    currency_id: item.currency_id,
  }));

  // Find gold_pro (Premium) or gold_special (Clássico)
  const premium = fees.find((f: any) => f.listing_type_id === "gold_pro");
  const classico = fees.find((f: any) =>
    f.listing_type_id === "gold_special" || f.listing_type_id === "gold"
  );

  const recommended = premium || classico || fees[0] || null;

  return new Response(
    JSON.stringify({
      category_id,
      price,
      fees,
      recommended,
      commission_percent: recommended?.sale_fee_percentage ?? null,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
