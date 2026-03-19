/**
 * Subscription State Invariants
 * 
 * This module defines code-level invariants for subscription/trial state management.
 * These rules ensure billing state is always consistent and predictable.
 * 
 * INVARIANTS:
 * 1. Trial users ≠ Premium users (distinct states, same access during trial)
 * 2. Expired trial = Free immediately (no grace period on client)
 * 3. Stripe webhook is source of truth (profile.subscription_* fields)
 * 4. Server-side always re-validates (never trust client tier claims)
 */

import { PLAN_LIMITS, type PlanTier } from "./planLimits";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Canonical subscription states - mutually exclusive
 */
export type SubscriptionState = 
  | "free"           // No subscription, no trial
  | "trial_active"   // In trial period (trial_ends_at > now)
  | "trial_expired"  // Trial ended, no paid subscription
  | "subscribed"     // Active paid subscription
  | "past_due"       // Payment failed, grace period
  | "admin_granted"; // Free access granted by admin

/**
 * Result of validating subscription state
 */
export interface SubscriptionValidation {
  state: SubscriptionState;
  hasAccess: boolean;
  tier: PlanTier;
  expiresAt: Date | null;
  isGracePeriod: boolean;
}

/**
 * Profile subscription fields from database
 */
export interface ProfileSubscriptionData {
  subscription_status: string | null;
  subscription_tier: string | null;
  trial_ends_at: string | null;
  trial_started_at: string | null;
  free_premium_access: boolean | null;
  access_reason: string | null;
}

// ============================================================================
// INVARIANT RULES (Code-level, not docs)
// ============================================================================

/**
 * INVARIANT 1: Trial users ≠ Premium users
 * 
 * - Trial grants temporary access to Power features
 * - Trial state is tracked separately from subscription state
 * - When trial expires, user becomes "free" unless they subscribed
 */
export function isTrialUser(data: ProfileSubscriptionData): boolean {
  // Must have a trial end date
  if (!data.trial_ends_at) return false;
  
  // Must not have active subscription (that would make them subscribed)
  if (data.subscription_status === "active" && data.subscription_tier) {
    return false;
  }
  
  // Trial status is explicitly set
  return data.subscription_status === "trial";
}

/**
 * INVARIANT 2: Expired trial = Free immediately
 * 
 * - No grace period for expired trials
 * - Client must check expiration in real-time, not rely on cached status
 * - Server always validates trial_ends_at before granting access
 */
export function isTrialExpired(trialEndsAt: string | Date | null): boolean {
  if (!trialEndsAt) return false; // No trial = not expired
  
  const endDate = typeof trialEndsAt === "string" 
    ? new Date(trialEndsAt) 
    : trialEndsAt;
    
  // Expired if end date is in the past
  return endDate <= new Date();
}

/**
 * Get remaining trial time in milliseconds
 * Returns 0 if expired or no trial
 */
export function getTrialRemainingMs(trialEndsAt: string | Date | null): number {
  if (!trialEndsAt) return 0;
  
  const endDate = typeof trialEndsAt === "string" 
    ? new Date(trialEndsAt) 
    : trialEndsAt;
    
  const remaining = endDate.getTime() - Date.now();
  return Math.max(0, remaining);
}

/**
 * INVARIANT 3: Stripe webhook is source of truth
 * 
 * - profile.subscription_status is set by webhook
 * - profile.subscription_tier is set by webhook
 * - Client reads these values, never writes them
 */
export function validateSubscriptionState(
  data: ProfileSubscriptionData,
  options?: { strictMode?: boolean }
): SubscriptionValidation {
  const strictMode = options?.strictMode ?? true;
  
  // PRIORITY 1: Admin-granted free access (highest priority)
  if (data.free_premium_access === true) {
    return {
      state: "admin_granted",
      hasAccess: true,
      tier: "power",
      expiresAt: null,
      isGracePeriod: false,
    };
  }
  
  // PRIORITY 2: Active paid subscription
  if (data.subscription_status === "active" && 
      normalizeTierFromDb(data.subscription_tier) === "power") {
    return {
      state: "subscribed",
      hasAccess: true,
      tier: "power",
      expiresAt: null, // Ongoing subscription
      isGracePeriod: false,
    };
  }
  
  // PRIORITY 3: Past due subscription (grace period)
  if (data.subscription_status === "past_due") {
    return {
      state: "past_due",
      hasAccess: true, // Still has access during grace
      tier: "power",
      expiresAt: null,
      isGracePeriod: true,
    };
  }
  
  // PRIORITY 4: Active trial (must check expiration in real-time!)
  if (data.subscription_status === "trial" && data.trial_ends_at) {
    const expired = isTrialExpired(data.trial_ends_at);
    
    if (!expired) {
      return {
        state: "trial_active",
        hasAccess: true,
        tier: "power", // Trial gets power features
        expiresAt: new Date(data.trial_ends_at),
        isGracePeriod: false,
      };
    }
    
    // Trial expired - IMMEDIATELY becomes free (Invariant 2)
    if (strictMode) {
      return {
        state: "trial_expired",
        hasAccess: false,
        tier: "free",
        expiresAt: new Date(data.trial_ends_at),
        isGracePeriod: false,
      };
    }
  }
  
  // PRIORITY 5: Expired or no subscription
  return {
    state: "free",
    hasAccess: false,
    tier: "free",
    expiresAt: null,
    isGracePeriod: false,
  };
}

/**
 * Normalize tier from database (handles legacy values)
 */
function normalizeTierFromDb(tier: string | null | undefined): PlanTier {
  if (!tier) return "free";
  const normalized = tier.toLowerCase();
  
  // All legacy paid tiers map to "power"
  if (normalized === "power" || normalized === "premium" || normalized === "mvp") {
    return "power";
  }
  
  return "free";
}

// ============================================================================
// ACCESS CHECKING UTILITIES
// ============================================================================

/**
 * Check if user has access to premium features
 * This is the SINGLE function that should be used for all access checks
 */
export function hasPremiumAccess(data: ProfileSubscriptionData): boolean {
  const validation = validateSubscriptionState(data);
  return validation.hasAccess;
}

/**
 * Get detailed access reason for UI display
 */
export function getAccessReason(
  data: ProfileSubscriptionData
): { canAccess: boolean; reason: string; action?: string } {
  const validation = validateSubscriptionState(data);
  
  switch (validation.state) {
    case "admin_granted":
      return { canAccess: true, reason: "Complimentary access" };
      
    case "subscribed":
      return { canAccess: true, reason: "Power subscriber" };
      
    case "past_due":
      return { 
        canAccess: true, 
        reason: "Payment issue - please update payment method",
        action: "update_payment"
      };
      
    case "trial_active":
      return { canAccess: true, reason: "Trial period active" };
      
    case "trial_expired":
      return { 
        canAccess: false, 
        reason: "Trial expired",
        action: "upgrade"
      };
      
    case "free":
    default:
      return { 
        canAccess: false, 
        reason: "Power subscription required",
        action: "upgrade"
      };
  }
}

// ============================================================================
// CONSISTENCY CHECKS (for debugging/auditing)
// ============================================================================

/**
 * Check if profile subscription state is consistent
 * Returns array of issues found (empty = consistent)
 */
export function auditSubscriptionConsistency(
  data: ProfileSubscriptionData
): string[] {
  const issues: string[] = [];
  
  // Check: trial status should have trial_ends_at
  if (data.subscription_status === "trial" && !data.trial_ends_at) {
    issues.push("Trial status set but no trial_ends_at date");
  }
  
  // Check: active subscription should have a tier
  if (data.subscription_status === "active" && !data.subscription_tier) {
    issues.push("Active subscription but no tier specified");
  }
  
  // Check: expired trial should not have status="trial"
  if (data.subscription_status === "trial" && 
      data.trial_ends_at && 
      isTrialExpired(data.trial_ends_at)) {
    issues.push("Trial expired but status still shows 'trial' - needs webhook sync");
  }
  
  // Check: free_premium_access should be boolean, not null
  if (data.free_premium_access === null && data.access_reason) {
    issues.push("access_reason set but free_premium_access is null");
  }
  
  return issues;
}

/**
 * Log subscription state for debugging
 */
export function logSubscriptionState(
  data: ProfileSubscriptionData,
  prefix = "[Subscription]"
): void {
  const validation = validateSubscriptionState(data);
  
  console.log(`${prefix} State:`, {
    state: validation.state,
    hasAccess: validation.hasAccess,
    tier: validation.tier,
    expiresAt: validation.expiresAt?.toISOString() || null,
    isGracePeriod: validation.isGracePeriod,
    rawStatus: data.subscription_status,
    rawTier: data.subscription_tier,
  });
}
