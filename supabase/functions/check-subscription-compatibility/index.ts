import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SUBSCRIPTION-COMPATIBILITY] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Validate Stripe key
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not configured");

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check for Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No Stripe customer found");
      return new Response(JSON.stringify({ 
        hasCustomer: false,
        subscriptions: [],
        isCompatible: false,
        message: "Nenhum cliente Stripe encontrado" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Get all subscriptions for customer
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 10,
    });

    logStep("Found subscriptions", { count: subscriptions.data.length });

    // Valid modern price IDs
    const modernPriceIds = [
      'price_1S6JbRKRFmEnuZwjVgi4VoaG', // Estrategista
      'price_1S6JruKRFmEnuZwj9i1lrCSG', // Competidor
      'price_1S6JsdKRFmEnuZwjCP2X0TiQ'  // Dominador
    ];

    // Analyze subscriptions
    const subscriptionAnalysis = subscriptions.data.map(sub => {
      const priceId = sub.items.data[0]?.price?.id;
      const isModern = modernPriceIds.includes(priceId || '');
      
      return {
        id: sub.id,
        status: sub.status,
        priceId,
        isModern,
        created: sub.created,
        currentPeriodEnd: sub.current_period_end
      };
    });

    const hasActiveModernSubscription = subscriptionAnalysis.some(
      sub => sub.status === 'active' && sub.isModern
    );

    const hasActiveLegacySubscription = subscriptionAnalysis.some(
      sub => sub.status === 'active' && !sub.isModern
    );

    logStep("Subscription analysis", { 
      hasActiveModern: hasActiveModernSubscription,
      hasActiveLegacy: hasActiveLegacySubscription 
    });

    return new Response(JSON.stringify({
      hasCustomer: true,
      customerId,
      subscriptions: subscriptionAnalysis,
      isCompatible: hasActiveModernSubscription,
      hasLegacySubscription: hasActiveLegacySubscription,
      modernPriceIds,
      message: hasActiveModernSubscription 
        ? "Assinatura moderna encontrada - Portal compatível" 
        : hasActiveLegacySubscription
          ? "Assinatura legacy detectada - É necessário fazer upgrade"
          : "Nenhuma assinatura ativa encontrada"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription-compatibility", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});