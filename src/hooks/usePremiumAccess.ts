import { useSubscription } from "@/hooks/useSubscription";
import { 
  isTrialExpired, 
  getTrialRemainingMs,
  type SubscriptionState 
} from "@/lib/subscriptionInvariants";

interface PremiumAccessResult {
  hasAccess: boolean;
  loading: boolean;
  reason: SubscriptionState;
  daysRemaining: number | null;
  /** Time until trial expires in ms (for refresh scheduling) */
  trialExpiresIn: number | null;
}

/**
 * Hook to check premium access with real-time trial expiration
 * 
 * INVARIANTS ENFORCED:
 * 1. Trial users ≠ Premium users (tracked via reason)
 * 2. Expired trial = Free immediately (checks in real-time, not cached)
 * 3. Stripe webhook is source of truth (reads from subscription hook)
 */
export const usePremiumAccess = (): PremiumAccessResult => {
  const { subscribed, trial, trialEndsAt, freeAccess, loading, pastDue } = useSubscription();

  if (loading) {
    return { 
      hasAccess: false, 
      loading: true, 
      reason: "free", 
      daysRemaining: null,
      trialExpiresIn: null 
    };
  }

  // INVARIANT: Admin-granted free access (highest priority)
  if (freeAccess) {
    return { 
      hasAccess: true, 
      loading: false, 
      reason: "admin_granted", 
      daysRemaining: null,
      trialExpiresIn: null 
    };
  }

  // INVARIANT: Active paid subscription (not trial)
  if (subscribed && !trial) {
    // Check for past due state
    if (pastDue) {
      return { 
        hasAccess: true, 
        loading: false, 
        reason: "past_due", 
        daysRemaining: null,
        trialExpiresIn: null 
      };
    }
    
    return { 
      hasAccess: true, 
      loading: false, 
      reason: "subscribed", 
      daysRemaining: null,
      trialExpiresIn: null 
    };
  }

  // INVARIANT: Active trial - check expiration IN REAL-TIME (not cached!)
  if (trial && trialEndsAt) {
    // Real-time expiration check (Invariant 2: expired = free immediately)
    const expired = isTrialExpired(trialEndsAt);
    
    if (!expired) {
      const remainingMs = getTrialRemainingMs(trialEndsAt);
      const daysRemaining = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
      
      return { 
        hasAccess: true, 
        loading: false, 
        reason: "trial_active", 
        daysRemaining,
        trialExpiresIn: remainingMs
      };
    }
    
    // Trial expired - return free immediately (no grace period)
    return { 
      hasAccess: false, 
      loading: false, 
      reason: "trial_expired", 
      daysRemaining: 0,
      trialExpiresIn: 0
    };
  }

  return { 
    hasAccess: false, 
    loading: false, 
    reason: "free", 
    daysRemaining: null,
    trialExpiresIn: null 
  };
};
