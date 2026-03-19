import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { strictCors, getCorsHeaders } from "../_shared/cors.ts";

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

// Product ID to tier mapping - maps to "power" (the only paid tier)
// Includes legacy products for migration safety
const PRODUCT_TIERS: Record<string, string> = {
  // Current live Power product
  "prod_TwwA5VNxPgt62D": "power",
  // Previous live Power product
  "prod_Tpx49PIJ26wzPc": "power",
  // Legacy Live mode products (map to power for migration)
  "prod_TnoLYRDnjKqtA8": "power", // Old Premium
  "prod_TnoLKasOQOvLwL": "power", // Old MVP
  // Legacy Test mode products (map to power for migration)
  "prod_Tf1Qq9jGVEyUOM": "power", // Old Premium (test)
  "prod_Tf1QUUhL8Tx1Ks": "power", // Old MVP (test)
};

// Map Stripe subscription status to our internal status
const mapStripeStatus = (stripeStatus: string): string => {
  switch (stripeStatus) {
    case "active":
      return "active";
    case "trialing":
      return "trial";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
      return "expired";
    default:
      return "none";
  }
};

/**
 * INVARIANT: Expired trial = Free immediately
 * Real-time check, not cached
 */
function isTrialExpired(trialEndsAt: string | null): boolean {
  if (!trialEndsAt) return false;
  return new Date(trialEndsAt) <= new Date();
}

serve(async (req) => {
  // Strict CORS validation
  const corsResponse = strictCors(req);
  if (corsResponse) return corsResponse;
  
  const corsHeaders = getCorsHeaders(req);

  // Create Supabase client with service role for profile updates
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
          error: "Subscription service temporarily unavailable",
          code: "SERVICE_UNAVAILABLE"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 503 }
      );
    }
    logStep("Stripe key verified");

    // Authenticate user
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

    // Check for free premium access first (promotional/admin access)
    const { data: profileData, error: profileError } = await supabaseClient
      .from("profiles")
      .select("id, free_premium_access, access_reason, trial_started_at, trial_ends_at, subscription_status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) {
      logStep("ERROR: Failed to fetch profile", { error: profileError.message });
    }

    if (profileData?.free_premium_access === true) {
      logStep("User has free premium access", { reason: profileData.access_reason });
      
      // Update profile to reflect power status
      await supabaseClient
        .from("profiles")
        .update({ 
          subscription_status: "active", 
          subscription_tier: "power" 
        })
        .eq("user_id", user.id);

      return new Response(JSON.stringify({
        subscribed: true,
        tier: "power",
        free_access: true,
        access_reason: profileData.access_reason || "Complimentary access",
        subscription_end: null
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Check Stripe subscription
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    logStep("Searching for Stripe customer");
    
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      logStep("No Stripe customer found");
      
      // Check if user is in trial period (co-parent linked trial)
      if (profileData?.trial_ends_at) {
        // INVARIANT 2: Check expiration in real-time!
        const expired = isTrialExpired(profileData.trial_ends_at);
        
        if (!expired) {
          logStep("User is in trial period", { trialEndsAt: profileData.trial_ends_at });
          
          await supabaseClient
            .from("profiles")
            .update({ subscription_status: "trial", subscription_tier: "power" })
            .eq("user_id", user.id);

          return new Response(JSON.stringify({
            subscribed: true,
            tier: "power",
            trial: true,
            trial_ends_at: profileData.trial_ends_at,
            subscription_end: profileData.trial_ends_at
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        } else {
          // INVARIANT 2: Expired trial = Free IMMEDIATELY
          logStep("Trial has expired - reverting to free", { 
            trialEndsAt: profileData.trial_ends_at,
            now: new Date().toISOString() 
          });
          
          await supabaseClient
            .from("profiles")
            .update({ subscription_status: "expired", subscription_tier: "free" })
            .eq("user_id", user.id);
          
          // Return explicit expired state for UI
          return new Response(JSON.stringify({ 
            subscribed: false, 
            tier: "free",
            trial_expired: true,
            trial_ends_at: profileData.trial_ends_at
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
      } else {
        // Update profile to reflect no subscription
        await supabaseClient
          .from("profiles")
          .update({ subscription_status: "none", subscription_tier: "free" })
          .eq("user_id", user.id);
      }

      return new Response(JSON.stringify({ 
        subscribed: false, 
        tier: "free" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Get all subscriptions (not just active) to handle various states
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 5,
      expand: ["data.items.data.price.product"],
    });

    logStep("Retrieved subscriptions", { count: subscriptions.data.length });

    // Find the most relevant subscription (prioritize active, then trialing, then past_due)
    const priorityOrder = ["active", "trialing", "past_due", "canceled"];
    const sortedSubs = [...subscriptions.data].sort((a: Stripe.Subscription, b: Stripe.Subscription) => {
      return priorityOrder.indexOf(a.status) - priorityOrder.indexOf(b.status);
    });

    const subscription = sortedSubs[0];
    
    if (!subscription || !["active", "trialing", "past_due"].includes(subscription.status)) {
      logStep("No active/trialing/past_due subscription found");
      
      // Check local trial as fallback
      if (profileData?.trial_ends_at) {
        // INVARIANT 2: Check expiration in real-time!
        const expired = isTrialExpired(profileData.trial_ends_at);
        
        if (!expired) {
          await supabaseClient
            .from("profiles")
            .update({ subscription_status: "trial", subscription_tier: "power" })
            .eq("user_id", user.id);

          return new Response(JSON.stringify({
            subscribed: true,
            tier: "power",
            trial: true,
            trial_ends_at: profileData.trial_ends_at,
            subscription_end: profileData.trial_ends_at
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
        
        // Trial expired - immediately free
        logStep("Local trial expired during Stripe check fallback");
      }
      
      // Update profile to reflect expired/no subscription
      await supabaseClient
        .from("profiles")
        .update({ subscription_status: "expired", subscription_tier: "free" })
        .eq("user_id", user.id);

      return new Response(JSON.stringify({ 
        subscribed: false, 
        tier: "free",
        trial_expired: profileData?.trial_ends_at ? true : undefined,
        trial_ends_at: profileData?.trial_ends_at || undefined
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Process active/trialing/past_due subscription
    const productId = subscription.items.data[0]?.price?.product as string;
    // All paid products map to "power" tier
    const tier = PRODUCT_TIERS[productId] || "power";
    const internalStatus = mapStripeStatus(subscription.status);
    
    let subscriptionEnd = null;
    const endTimestamp = subscription.current_period_end;
    if (endTimestamp && typeof endTimestamp === 'number') {
      subscriptionEnd = new Date(endTimestamp * 1000).toISOString();
    }

    logStep("Subscription details", { 
      status: subscription.status, 
      internalStatus,
      tier, 
      productId,
      endsAt: subscriptionEnd 
    });

    // Update profile with subscription info
    await supabaseClient
      .from("profiles")
      .update({ 
        subscription_status: internalStatus, 
        subscription_tier: tier 
      })
      .eq("user_id", user.id);

    logStep("Profile updated successfully");

    return new Response(JSON.stringify({
      subscribed: true,
      tier,
      status: internalStatus,
      product_id: productId,
      subscription_end: subscriptionEnd,
      past_due: subscription.status === "past_due"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR: Unexpected error", { message: errorMessage });
    
    return new Response(
      JSON.stringify({ 
        error: "Unable to check subscription status. Please try again.",
        code: "CHECK_FAILED"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
