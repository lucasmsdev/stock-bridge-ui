import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { planType } = await req.json();
    if (!planType) throw new Error("Plan type is required");
    logStep("Plan type received", { planType });

    // Map plan types to Stripe price IDs
    const planPriceMap = {
      'estrategista': 'price_1S6JbRKRFmEnuZwjVgi4VoaG',  // R$ 97 (Iniciante)
      'competidor': 'price_1SPo8UKRFmEnuZwjXoO3C9vB',    // R$ 197 (Profissional)
      'dominador': 'price_1SPo8sKRFmEnuZwjYhvLWJF6',     // R$ 297 (Enterprise)
      'unlimited': 'price_1SPo9dKRFmEnuZwjJzwYTgir'      // R$ 397 (Unlimited)
    };

    const priceId = planPriceMap[planType as keyof typeof planPriceMap];
    if (!priceId) throw new Error(`Invalid plan type: ${planType}`);
    logStep("Price ID resolved", { priceId });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { 
      apiVersion: "2025-08-27.basil" 
    });

    // Check if customer already exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    } else {
      logStep("No existing customer found, will create one via checkout");
    }

    const origin = req.headers.get("origin") || "https://stock-bridge-ui.lovable.app";
    
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      client_reference_id: user.id, // Store user ID for webhook processing
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      subscription_data: {
        trial_period_days: 7, // Período de teste de 7 dias
      },
      allow_promotion_codes: true, // Habilita campo de cupons
      success_url: `${origin}/billing?success=true&plan=${planType}`,
      cancel_url: `${origin}/billing?canceled=true`,
      metadata: {
        user_id: user.id,
        plan_type: planType
      }
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-checkout", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});