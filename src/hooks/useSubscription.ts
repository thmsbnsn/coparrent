import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { STRIPE_TIERS, StripeTier } from "@/lib/stripe";
import { useToast } from "@/hooks/use-toast";
import { ERROR_MESSAGES } from "@/lib/errorMessages";
import {
  cloneSnapshot,
  FREE_SUBSCRIPTION_SNAPSHOT,
  normalizeSubscriptionSnapshot,
  type SubscriptionSnapshot,
  type SubscriptionStatus,
} from "@/hooks/subscriptionSnapshot";

const SUBSCRIPTION_CACHE_TTL_MS = 30_000;

let cachedSubscriptionUserId: string | null = null;
let cachedSubscriptionSnapshot: SubscriptionSnapshot | null = null;
let cachedSubscriptionAt = 0;
let inFlightSubscriptionUserId: string | null = null;
let inFlightSubscriptionPromise: Promise<SubscriptionSnapshot> | null = null;

function readCachedSubscriptionSnapshot(userId: string): SubscriptionSnapshot | null {
  if (
    cachedSubscriptionUserId === userId &&
    cachedSubscriptionSnapshot &&
    Date.now() - cachedSubscriptionAt < SUBSCRIPTION_CACHE_TTL_MS
  ) {
    return cloneSnapshot(cachedSubscriptionSnapshot);
  }

  return null;
}

function storeCachedSubscriptionSnapshot(userId: string, snapshot: SubscriptionSnapshot): void {
  cachedSubscriptionUserId = userId;
  cachedSubscriptionSnapshot = cloneSnapshot(snapshot);
  cachedSubscriptionAt = Date.now();
}

function clearCachedSubscriptionSnapshot(userId?: string): void {
  if (!userId || cachedSubscriptionUserId === userId) {
    cachedSubscriptionUserId = null;
    cachedSubscriptionSnapshot = null;
    cachedSubscriptionAt = 0;
  }
}

async function fetchSubscriptionSnapshot(
  userId: string,
  accessToken: string,
  forceRefresh: boolean,
): Promise<SubscriptionSnapshot> {
  if (!forceRefresh) {
    const cached = readCachedSubscriptionSnapshot(userId);
    if (cached) {
      return cached;
    }

    if (inFlightSubscriptionPromise && inFlightSubscriptionUserId === userId) {
      return inFlightSubscriptionPromise;
    }
  }

  inFlightSubscriptionUserId = userId;
  inFlightSubscriptionPromise = (async () => {
    const { data, error } = await supabase.functions.invoke("check-subscription", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (error) {
      throw error;
    }

    if (data?.error) {
      throw new Error(String(data.error));
    }

    const snapshot = normalizeSubscriptionSnapshot((data || {}) as Record<string, unknown>);
    storeCachedSubscriptionSnapshot(userId, snapshot);
    return snapshot;
  })();

  try {
    return await inFlightSubscriptionPromise;
  } finally {
    if (inFlightSubscriptionUserId === userId) {
      inFlightSubscriptionUserId = null;
      inFlightSubscriptionPromise = null;
    }
  }
}

export const useSubscription = () => {
  const { user, session, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<SubscriptionStatus>({
    ...FREE_SUBSCRIPTION_SNAPSHOT,
    loading: true,
    error: null,
  });
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const checkSubscription = useCallback(
    async (retry = false, forceRefresh = false) => {
      if (authLoading) {
        return;
      }

      if (!user || !session?.access_token) {
        clearCachedSubscriptionSnapshot();
        setStatus({
          ...FREE_SUBSCRIPTION_SNAPSHOT,
          loading: false,
          error: null,
        });
        return;
      }

      const attemptCheck = async (attempt: number): Promise<void> => {
        setStatus((prev) => ({
          ...prev,
          loading: true,
          error: null,
        }));

        try {
          const snapshot = await fetchSubscriptionSnapshot(
            user.id,
            session.access_token,
            forceRefresh || attempt > 0,
          );

          setStatus({
            ...snapshot,
            loading: false,
            error: null,
          });
        } catch (error: unknown) {
          if (retry && attempt < 2) {
            await new Promise((resolve) => {
              window.setTimeout(resolve, 1500 * (attempt + 1));
            });
            await attemptCheck(attempt + 1);
            return;
          }

          clearCachedSubscriptionSnapshot(user.id);
          const errorMessage =
            error instanceof Error ? error.message : "Failed to check subscription";

          setStatus((prev) => ({
            ...prev,
            loading: false,
            error: errorMessage,
          }));
        }
      };

      await attemptCheck(0);
    },
    [authLoading, session?.access_token, user],
  );

  useEffect(() => {
    if (authLoading) {
      return;
    }

    void checkSubscription(true);

    const interval = window.setInterval(() => {
      void checkSubscription(false);
    }, 60000);

    return () => window.clearInterval(interval);
  }, [authLoading, checkSubscription]);

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

    try {
      const priceId = STRIPE_TIERS[tier].priceId;

      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId },
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        const errorMessages: Record<string, string> = {
          ALREADY_SUBSCRIBED:
            "You already have an active subscription. Visit Settings to manage it.",
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

    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");

      if (error) {
        throw error;
      }

      if (data.error) {
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
