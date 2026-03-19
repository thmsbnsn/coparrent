import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { STRIPE_TIERS, StripeTier } from "@/lib/stripe";
import { useToast } from "@/hooks/use-toast";
import { ERROR_MESSAGES } from "@/lib/errorMessages";

interface SubscriptionStatus {
  subscribed: boolean;
  tier: StripeTier | "free";
  subscriptionEnd: string | null;
  loading: boolean;
  freeAccess: boolean;
  accessReason: string | null;
  error: string | null;
  trial: boolean;
  trialEndsAt: string | null;
  pastDue: boolean;
}

export const useSubscription = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<SubscriptionStatus>({
    subscribed: false,
    tier: "free",
    subscriptionEnd: null,
    loading: true,
    freeAccess: false,
    accessReason: null,
    error: null,
    trial: false,
    trialEndsAt: null,
    pastDue: false,
  });
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const checkSubscription = useCallback(async (retry = false) => {
    if (!user) {
      setStatus({ 
        subscribed: false, 
        tier: "free", 
        subscriptionEnd: null, 
        loading: false, 
        freeAccess: false, 
        accessReason: null,
        error: null,
        trial: false,
        trialEndsAt: null,
        pastDue: false,
      });
      return;
    }

    try {
      console.log("[useSubscription] Checking subscription status...");
      const { data, error } = await supabase.functions.invoke("check-subscription");
      
      if (error) {
        console.error("[useSubscription] Error checking subscription:", error);
        
        // Retry logic for network failures
        if (retry && retryCount < 3) {
          setRetryCount(prev => prev + 1);
          setTimeout(() => checkSubscription(true), 2000 * (retryCount + 1));
          return;
        }
        
        throw error;
      }

      console.log("[useSubscription] Subscription data received:", data);
      setRetryCount(0);

      // Handle error responses from the function
      if (data.error) {
        console.warn("[useSubscription] Function returned error:", data.error);
        setStatus(prev => ({ 
          ...prev, 
          loading: false, 
          error: data.error,
          subscribed: false,
          tier: "free",
        }));
        return;
      }

      setStatus({
        subscribed: data.subscribed || data.free_access || false,
        tier: (data.tier as StripeTier | "free") || "free",
        subscriptionEnd: data.subscription_end || null,
        loading: false,
        freeAccess: data.free_access || false,
        accessReason: data.access_reason || null,
        error: null,
        trial: data.trial || false,
        trialEndsAt: data.trial_ends_at || null,
        pastDue: data.past_due || false,
      });
    } catch (error: unknown) {
      console.error("[useSubscription] Error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to check subscription";
      setStatus(prev => ({ 
        ...prev, 
        loading: false, 
        error: errorMessage,
      }));
    }
  }, [user, retryCount]);

  useEffect(() => {
    checkSubscription(true);
    
    // Auto-refresh every minute
    const interval = setInterval(() => checkSubscription(false), 60000);
    return () => clearInterval(interval);
  }, [checkSubscription]);

  const createCheckout = async (tier: StripeTier) => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to subscribe.",
        variant: "destructive",
      });
      return;
    }

    setCheckoutLoading(true);
    console.log("[useSubscription] Creating checkout for tier:", tier);

    try {
      const priceId = STRIPE_TIERS[tier].priceId;
      console.log("[useSubscription] Using price ID:", priceId);
      
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId },
      });

      if (error) {
        console.error("[useSubscription] Checkout error:", error);
        throw error;
      }

      // Handle specific error codes from the function
      if (data.error) {
        console.error("[useSubscription] Checkout function error:", data);
        
        // Show appropriate message based on error code
        const errorMessages: Record<string, string> = {
          ALREADY_SUBSCRIBED: "You already have an active subscription. Visit Settings to manage it.",
          INVALID_PRICE: "This plan is no longer available. Please refresh the page.",
          SERVICE_UNAVAILABLE: "Payment service is temporarily unavailable. Please try again later.",
          AUTH_REQUIRED: "Please sign in to continue.",
          AUTH_FAILED: "Your session has expired. Please sign in again.",
        };
        
        toast({
          title: "Unable to start checkout",
          description: errorMessages[data.code] || data.error,
          variant: "destructive",
        });
        return;
      }

      console.log("[useSubscription] Checkout session created:", data);

      if (data.url) {
        window.open(data.url, "_blank");
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error: unknown) {
      console.error("[useSubscription] Checkout failed:", error);
      toast({
        title: "Checkout failed",
        description: ERROR_MESSAGES.CHECKOUT_ERROR,
        variant: "destructive",
      });
    } finally {
      setCheckoutLoading(false);
    }
  };

  const openCustomerPortal = async () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to manage your subscription.",
        variant: "destructive",
      });
      return;
    }

    setPortalLoading(true);
    console.log("[useSubscription] Opening customer portal...");

    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");

      if (error) {
        console.error("[useSubscription] Portal error:", error);
        throw error;
      }

      // Handle specific error codes from the function
      if (data.error) {
        console.error("[useSubscription] Portal function error:", data);
        
        if (data.action === "subscribe") {
          toast({
            title: "No subscription found",
            description: "Please subscribe to a plan first to access billing management.",
          });
          return;
        }
        
        if (data.code === "FREE_ACCESS") {
          toast({
            title: "Complimentary access",
            description: "Your premium access is free and doesn't require billing management.",
          });
          return;
        }
        
        toast({
          title: "Portal access failed",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      console.log("[useSubscription] Portal session created:", data);

      if (data.url) {
        window.open(data.url, "_blank");
      } else {
        throw new Error("No portal URL returned");
      }
    } catch (error: unknown) {
      console.error("[useSubscription] Portal failed:", error);
      toast({
        title: "Portal access failed",
        description: "Unable to access billing portal. Please try again.",
        variant: "destructive",
      });
    } finally {
      setPortalLoading(false);
    }
  };

  // Helper to check if user has premium access (either paid or free)
  const hasPremiumAccess = status.subscribed || status.freeAccess;

  return {
    ...status,
    hasPremiumAccess,
    checkoutLoading,
    portalLoading,
    checkSubscription,
    createCheckout,
    openCustomerPortal,
  };
};
