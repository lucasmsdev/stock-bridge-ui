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
    
    // Verify webhook secret is configured
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret) {
      logStep("ERROR: STRIPE_WEBHOOK_SECRET not configured");
      return new Response("Webhook secret not configured", { status: 500 });
    }

    if (!signature) {
      logStep("ERROR: No stripe-signature header provided");
      return new Response("No signature provided", { status: 400 });
    }
    
    let event;
    try {
      // Verify the webhook signature to ensure the request is from Stripe
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        webhookSecret
      );
      logStep("Event verified and parsed", { type: event.type, id: event.id });
    } catch (err) {
      logStep("ERROR: Webhook signature verification failed", { error: err.message });
      return new Response(`Webhook signature verification failed: ${err.message}`, { status: 400 });
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

      // Map Stripe price IDs to plan types (PRODUCTION)
      const priceToPlantMap = {
        'price_1SPocGKdlB8Nu9cynoGjpe2V': 'estrategista',
        'price_1SPocVKdlB8Nu9cyHYEa8b2m': 'competidor', 
        'price_1SPpumKRFmEnuZwjDVJSIOZ2': 'dominador',
        'price_1SPodWKdlB8Nu9cyShTWmTES': 'unlimited'
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

      const stripeCustomerId = session.customer;
      logStep("Updating organization plan and Stripe customer ID", { userId, planType: finalPlanType, stripeCustomerId });

      // Find user's organization via organization_members
      const { data: memberData, error: memberError } = await supabaseClient
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', userId)
        .single();

      if (memberError || !memberData) {
        logStep("ERROR: User organization not found", { userId, error: memberError });
        return new Response("User organization not found", { status: 400 });
      }

      // Update organization's plan and stripe_customer_id
      const { error: updateError } = await supabaseClient
        .from('organizations')
        .update({ 
          plan: finalPlanType,
          stripe_customer_id: stripeCustomerId 
        })
        .eq('id', memberData.organization_id);

      if (updateError) {
        logStep("ERROR updating organization plan", { error: updateError });
        return new Response(`Database error: ${updateError.message}`, { status: 500 });
      }

      logStep("Organization plan updated successfully", { orgId: memberData.organization_id, planType: finalPlanType });
    }

    // Handle subscription events
    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      logStep(`Processing ${event.type}`, { subscriptionId: subscription.id });

      const stripeCustomerId = subscription.customer;

      // Find organization by stripe_customer_id
      const { data: orgData, error: orgError } = await supabaseClient
        .from('organizations')
        .select('id')
        .eq('stripe_customer_id', stripeCustomerId)
        .single();

      if (orgError || !orgData) {
        logStep("ERROR: Organization not found by stripe_customer_id", { stripeCustomerId, error: orgError });
        return new Response("Organization not found", { status: 400 });
      }

      let newPlan = 'iniciante'; // Default plan

      if (event.type === 'customer.subscription.updated' && subscription.status === 'active') {
        // Get the price ID from the subscription
        const priceId = subscription.items.data[0]?.price?.id;
        const priceToPlantMap = {
          'price_1SPocGKdlB8Nu9cynoGjpe2V': 'estrategista',
          'price_1SPocVKdlB8Nu9cyHYEa8b2m': 'competidor', 
          'price_1SPpumKRFmEnuZwjDVJSIOZ2': 'dominador',
          'price_1SPodWKdlB8Nu9cyShTWmTES': 'unlimited'
        };
        newPlan = priceToPlantMap[priceId as keyof typeof priceToPlantMap] || 'iniciante';
      }

      logStep("Updating organization plan from subscription event", { orgId: orgData.id, newPlan });

      const { error: updateError } = await supabaseClient
        .from('organizations')
        .update({ plan: newPlan })
        .eq('id', orgData.id);

      if (updateError) {
        logStep("ERROR updating organization plan", { error: updateError });
        return new Response(`Database error: ${updateError.message}`, { status: 500 });
      }

      logStep("Organization plan updated from subscription event", { orgId: orgData.id, newPlan });
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