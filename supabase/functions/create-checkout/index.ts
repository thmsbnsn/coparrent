import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { strictCors, getCorsHeaders } from "../_shared/cors.ts";

// Zod schema for input validation
const CheckoutRequestSchema = z.object({
  priceId: z.string().min(1, "Price ID is required").max(100, "Price ID too long"),
});

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

// Valid price IDs for Power plan ($5/month)
const VALID_PRICE_IDS = [
  // Current live Power product
  "price_1Sz2IZHpttmwwVs1H4deOgQe", // Power $5/mo
  // Legacy live price IDs kept for migration safety
  "price_1SsHAdHH6NsbcWgZb3ghZzFc", // Previous live Power
  "price_1SqCiwHH6NsbcWgZB7TfWnhQ", // Old Premium $5/mo
  // Test mode
  "price_1ShhNiHH6NsbcWgZd5TaJRr3", // Test Premium (used as Power in test)
];

serve(async (req) => {
  // Strict CORS validation
  const corsResponse = strictCors(req);
  if (corsResponse) return corsResponse;
  
  const corsHeaders = getCorsHeaders(req);

  // Create Supabase client (JWT is verified by Supabase with verify_jwt=true)
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    // Authenticate user (JWT already verified by Supabase)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logStep("ERROR: No authorization header");
      return new Response(
        JSON.stringify({ 
          error: "Authentication required",
          code: "AUTH_REQUIRED"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !data.user?.email) {
      logStep("ERROR: Authentication failed", { error: authError?.message });
      return new Response(
        JSON.stringify({ 
          error: "Authentication failed. Please sign in again.",
          code: "AUTH_FAILED"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const user = data.user;
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Parse and validate request body
    let rawBody;
    try {
      rawBody = await req.json();
    } catch {
      logStep("ERROR: Invalid JSON body");
      return new Response(
        JSON.stringify({ 
          error: "Invalid request format",
          code: "INVALID_REQUEST"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const parseResult = CheckoutRequestSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      logStep("ERROR: Validation failed", { errors: parseResult.error.flatten() });
      return new Response(
        JSON.stringify({ 
          error: "Invalid request data. Please try again.",
          code: "VALIDATION_FAILED"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const { priceId } = parseResult.data;
    logStep("Price ID received", { priceId });

    // Verify price ID is valid
    if (!VALID_PRICE_IDS.includes(priceId)) {
      logStep("ERROR: Invalid price ID", { priceId });
      return new Response(
        JSON.stringify({ 
          error: "Invalid subscription plan. Please contact support.",
          code: "INVALID_PRICE"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      logStep("ERROR: STRIPE_SECRET_KEY not configured");
      return new Response(
        JSON.stringify({ 
          error: "Payment service temporarily unavailable. Please try again later.",
          code: "SERVICE_UNAVAILABLE"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 503 }
      );
    }
    logStep("Stripe key verified");

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
    });

    // Check if customer exists
    logStep("Checking for existing Stripe customer");
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing customer", { customerId });
      
      // Check if user already has an active subscription
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "active",
        limit: 1,
      });
      
      if (subscriptions.data.length > 0) {
        logStep("User already has active subscription");
        return new Response(
          JSON.stringify({ 
            error: "You already have an active subscription. Visit Settings to manage it.",
            code: "ALREADY_SUBSCRIBED"
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
    } else {
      logStep("No existing customer found, will create new");
    }

    const origin = req.headers.get("origin") || "https://coparrent.com";
    logStep("Creating checkout session", { origin });

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${origin}/settings?success=true`,
      cancel_url: `${origin}/pricing?canceled=true`,
      metadata: {
        user_id: user.id,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
        },
      },
    });

    logStep("Checkout session created", { sessionId: session.id });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR: Unexpected error", { message: errorMessage });
    
    // Check for specific Stripe errors
    if (errorMessage.includes("No such price")) {
      return new Response(
        JSON.stringify({ 
          error: "The selected plan is no longer available. Please refresh and try again.",
          code: "PRICE_NOT_FOUND"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }
    
    return new Response(
      JSON.stringify({ 
        error: "Unable to create checkout session. Please try again.",
        code: "CHECKOUT_FAILED"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
