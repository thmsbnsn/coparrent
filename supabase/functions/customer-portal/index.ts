import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { strictCors, getCorsHeaders } from "../_shared/cors.ts";

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CUSTOMER-PORTAL] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Strict CORS validation
  const corsResponse = strictCors(req);
  if (corsResponse) return corsResponse;
  
  const corsHeaders = getCorsHeaders(req);

  // Create Supabase client (JWT is verified by Supabase with verify_jwt=true)
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      logStep("ERROR: STRIPE_SECRET_KEY not configured");
      return new Response(
        JSON.stringify({ 
          error: "Billing service temporarily unavailable. Please try again later.",
          code: "SERVICE_UNAVAILABLE"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 503 }
      );
    }
    logStep("Stripe key verified");

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
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user?.email) {
      logStep("ERROR: Authentication failed", { error: userError?.message });
      return new Response(
        JSON.stringify({ 
          error: "Authentication failed. Please sign in again.",
          code: "AUTH_FAILED"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const user = userData.user;
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Check if user has free premium access (no Stripe customer needed)
    const { data: profileData } = await supabaseClient
      .from("profiles")
      .select("free_premium_access")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileData?.free_premium_access) {
      logStep("User has free premium access - no billing to manage");
      return new Response(
        JSON.stringify({ 
          error: "Your premium access is complimentary and doesn't require billing management.",
          code: "FREE_ACCESS"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    logStep("Searching for Stripe customer");
    
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No Stripe customer found");
      return new Response(
        JSON.stringify({ 
          error: "No billing account found. Please subscribe to a plan first.",
          code: "NO_CUSTOMER",
          action: "subscribe"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Check if customer has any subscription history
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      logStep("Customer has no subscription history");
      return new Response(
        JSON.stringify({ 
          error: "No subscription found. Please subscribe to a plan to access billing management.",
          code: "NO_SUBSCRIPTION",
          action: "subscribe"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    const origin = req.headers.get("origin") || "https://coparrent.com";
    logStep("Creating portal session", { origin });
    
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/settings`,
    });
    
    logStep("Customer portal session created", { sessionId: portalSession.id });

    return new Response(JSON.stringify({ url: portalSession.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR: Unexpected error", { message: errorMessage });
    
    // Check for specific Stripe errors
    if (errorMessage.includes("portal configuration")) {
      return new Response(
        JSON.stringify({ 
          error: "Billing portal is being configured. Please try again in a few minutes.",
          code: "PORTAL_CONFIG_ERROR"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 503 }
      );
    }
    
    return new Response(
      JSON.stringify({ 
        error: "Unable to access billing portal. Please try again.",
        code: "PORTAL_FAILED"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
