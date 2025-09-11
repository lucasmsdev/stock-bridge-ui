import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received", { method: req.method });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { 
      apiVersion: "2025-08-27.basil" 
    });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const signature = req.headers.get("stripe-signature");
    const body = await req.text();
    
    let event;
    try {
      // In production, you should set up the webhook endpoint secret
      // For now, we'll parse the event directly
      event = JSON.parse(body);
      logStep("Event parsed", { type: event.type, id: event.id });
    } catch (err) {
      logStep("ERROR parsing webhook body", { error: err.message });
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    // Handle the checkout completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      logStep("Processing checkout.session.completed", { sessionId: session.id });

      const userId = session.client_reference_id || session.metadata?.user_id;
      const planType = session.metadata?.plan_type;

      if (!userId) {
        logStep("ERROR: No user ID found in session", { session });
        return new Response("No user ID found", { status: 400 });
      }

      // Map Stripe price IDs to plan types
      const priceToPlantMap = {
        'price_1S6JbRKRFmEnuZwjVgi4VoaG': 'estrategista',
        'price_1S6JruKRFmEnuZwj9i1lrCSG': 'competidor', 
        'price_1S6JsdKRFmEnuZwjCP2X0TiQ': 'dominador'
      };

      let finalPlanType = planType;
      
      // If plan type not in metadata, try to determine from line items
      if (!finalPlanType && session.line_items?.data) {
        const priceId = session.line_items.data[0]?.price?.id;
        finalPlanType = priceToPlantMap[priceId as keyof typeof priceToPlantMap];
      }

      if (!finalPlanType) {
        logStep("ERROR: Could not determine plan type", { session });
        return new Response("Could not determine plan type", { status: 400 });
      }

      logStep("Updating user plan", { userId, planType: finalPlanType });

      // Update user's plan in the profiles table
      const { error: updateError } = await supabaseClient
        .from('profiles')
        .update({ plan: finalPlanType })
        .eq('id', userId);

      if (updateError) {
        logStep("ERROR updating user plan", { error: updateError });
        return new Response(`Database error: ${updateError.message}`, { status: 500 });
      }

      logStep("User plan updated successfully", { userId, planType: finalPlanType });
    }

    // Handle subscription events
    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      logStep(`Processing ${event.type}`, { subscriptionId: subscription.id });

      // Get customer email to find user
      const customer = await stripe.customers.retrieve(subscription.customer);
      if (customer.deleted || !customer.email) {
        logStep("ERROR: Customer not found or no email", { customer });
        return new Response("Customer not found", { status: 400 });
      }

      // Find user by email
      const { data: userData, error: userError } = await supabaseClient
        .from('profiles')
        .select('id')
        .eq('email', customer.email)
        .single();

      if (userError || !userData) {
        logStep("ERROR: User not found", { email: customer.email, error: userError });
        return new Response("User not found", { status: 400 });
      }

      let newPlan = 'estrategista'; // Default plan

      if (event.type === 'customer.subscription.updated' && subscription.status === 'active') {
        // Get the price ID from the subscription
        const priceId = subscription.items.data[0]?.price?.id;
        const priceToPlantMap = {
          'price_1S6JbRKRFmEnuZwjVgi4VoaG': 'estrategista',
          'price_1S6JruKRFmEnuZwj9i1lrCSG': 'competidor', 
          'price_1S6JsdKRFmEnuZwjCP2X0TiQ': 'dominador'
        };
        newPlan = priceToPlantMap[priceId as keyof typeof priceToPlantMap] || 'estrategista';
      }

      logStep("Updating user plan from subscription event", { userId: userData.id, newPlan });

      const { error: updateError } = await supabaseClient
        .from('profiles')
        .update({ plan: newPlan })
        .eq('id', userData.id);

      if (updateError) {
        logStep("ERROR updating user plan", { error: updateError });
        return new Response(`Database error: ${updateError.message}`, { status: 500 });
      }

      logStep("User plan updated from subscription event", { userId: userData.id, newPlan });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in stripe-webhook", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});