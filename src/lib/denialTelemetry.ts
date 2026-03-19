/**
 * Gated Feature Denial Telemetry
 * 
 * Lightweight telemetry for tracking when users are denied access to features.
 * Used for product decisions - identifies friction points without storing sensitive content.
 * 
 * PRIVACY: Only tracks action + role + gate reason. No personal data, no content.
 */

import { logger } from "./logger";

// Denial event types
export type DenialReason =
  | "premium_required"
  | "trial_expired"
  | "role_restricted"
  | "child_restricted"
  | "rate_limited"
  | "plan_limit_reached"
  | "feature_disabled";

export type GateType =
  | "premium"
  | "role"
  | "child"
  | "admin"
  | "rate_limit";

export interface DenialEvent {
  /** Feature or action that was denied */
  feature: string;
  /** Type of gate that blocked access */
  gateType: GateType;
  /** Reason for denial */
  reason: DenialReason;
  /** User's current role (parent, third_party, child) */
  role: string;
  /** User's current subscription tier (free, trial, power) */
  tier: string;
  /** Whether this is temporary (rate limit) or permanent (role-based) */
  isTemporary: boolean;
  /** Optional: what action user could take */
  suggestedAction?: "upgrade" | "contact_parent" | "wait" | "none";
}

// In-memory deduplication to prevent spam
const recentDenials = new Map<string, number>();
const DEDUP_WINDOW_MS = 60_000; // 1 minute

function getDenialKey(event: DenialEvent): string {
  return `${event.feature}:${event.gateType}:${event.reason}`;
}

/**
 * Record a denial event for telemetry
 * 
 * SECURITY: Does not store user IDs, content, or sensitive data.
 * Only aggregatable metadata for product decisions.
 */
export function recordDenial(event: DenialEvent): void {
  const key = getDenialKey(event);
  const now = Date.now();
  
  // Deduplicate rapid-fire denials (e.g., repeated clicks)
  const lastDenial = recentDenials.get(key);
  if (lastDenial && now - lastDenial < DEDUP_WINDOW_MS) {
    return;
  }
  recentDenials.set(key, now);
  
  // Cleanup old entries periodically
  if (recentDenials.size > 100) {
    for (const [k, timestamp] of recentDenials.entries()) {
      if (now - timestamp > DEDUP_WINDOW_MS) {
        recentDenials.delete(k);
      }
    }
  }
  
  // Log for analytics pipeline
  logger.info("Feature denial", {
    event: "FEATURE_DENIAL",
    feature: event.feature,
    gateType: event.gateType,
    reason: event.reason,
    role: event.role,
    tier: event.tier,
    isTemporary: event.isTemporary,
    suggestedAction: event.suggestedAction,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Record a premium feature denial
 */
export function recordPremiumDenial(
  feature: string,
  tier: string,
  reason: "premium_required" | "trial_expired" = "premium_required"
): void {
  recordDenial({
    feature,
    gateType: "premium",
    reason,
    role: "parent", // Only parents see premium gates
    tier,
    isTemporary: false,
    suggestedAction: "upgrade",
  });
}

/**
 * Record a role-restricted feature denial
 */
export function recordRoleDenial(
  feature: string,
  role: string,
  tier: string
): void {
  recordDenial({
    feature,
    gateType: "role",
    reason: "role_restricted",
    role,
    tier,
    isTemporary: false,
    suggestedAction: role === "third_party" ? "none" : "contact_parent",
  });
}

/**
 * Record a child account restriction
 */
export function recordChildDenial(
  feature: string,
  tier: string
): void {
  recordDenial({
    feature,
    gateType: "child",
    reason: "child_restricted",
    role: "child",
    tier,
    isTemporary: false,
    suggestedAction: "contact_parent",
  });
}

/**
 * Record a rate limit hit
 */
export function recordRateLimitDenial(
  feature: string,
  role: string,
  tier: string
): void {
  recordDenial({
    feature,
    gateType: "rate_limit",
    reason: "rate_limited",
    role,
    tier,
    isTemporary: true,
    suggestedAction: "wait",
  });
}

/**
 * Record a plan limit (e.g., max children) denial
 */
export function recordPlanLimitDenial(
  feature: string,
  role: string,
  tier: string
): void {
  recordDenial({
    feature,
    gateType: "premium",
    reason: "plan_limit_reached",
    role,
    tier,
    isTemporary: false,
    suggestedAction: "upgrade",
  });
}

// =============================================================================
// USER-FACING DENIAL CONTEXT
// =============================================================================

export interface DenialContext {
  /** Short title for the denial */
  title: string;
  /** Human-readable explanation */
  description: string;
  /** Whether this is temporary or permanent */
  isTemporary: boolean;
  /** Action user can take */
  action: {
    label: string;
    href?: string;
    type: "link" | "button" | "none";
  };
}

/**
 * Get user-friendly denial context
 * 
 * This transforms a denial reason into clear, actionable messaging.
 * Users understand: Why, Whether temporary, What to do next.
 */
export function getDenialContext(
  reason: DenialReason,
  featureName: string = "This feature"
): DenialContext {
  switch (reason) {
    case "premium_required":
      return {
        title: "Power Feature",
        description: `${featureName} is available with the Power plan. Upgrade to unlock all features.`,
        isTemporary: false,
        action: { label: "View Plans", href: "/pricing", type: "link" },
      };
    
    case "trial_expired":
      return {
        title: "Trial Ended",
        description: `Your free trial has ended. Upgrade to Power to continue using ${featureName.toLowerCase()}.`,
        isTemporary: false,
        action: { label: "Upgrade Now", href: "/pricing", type: "link" },
      };
    
    case "role_restricted":
      return {
        title: "Parent Access Only",
        description: `${featureName} is only available to parents. As a family member, you have view-only access.`,
        isTemporary: false,
        action: { label: "Return to Dashboard", href: "/dashboard", type: "link" },
      };
    
    case "child_restricted":
      return {
        title: "Not Available",
        description: `${featureName} isn't available for your account. Ask a parent if you need help.`,
        isTemporary: false,
        action: { label: "Go Home", href: "/kids", type: "link" },
      };
    
    case "rate_limited":
      return {
        title: "Daily Limit Reached",
        description: "You've reached your daily limit. This resets at midnight and you can try again tomorrow.",
        isTemporary: true,
        action: { label: "Got It", type: "none" },
      };
    
    case "plan_limit_reached":
      return {
        title: "Plan Limit Reached",
        description: "You've reached the limit for your current plan. Upgrade to add more.",
        isTemporary: false,
        action: { label: "Upgrade", href: "/pricing", type: "link" },
      };
    
    case "feature_disabled":
      return {
        title: "Feature Unavailable",
        description: `${featureName} is currently unavailable. Please try again later.`,
        isTemporary: true,
        action: { label: "Dismiss", type: "none" },
      };
    
    default:
      return {
        title: "Access Restricted",
        description: `You don't have access to ${featureName.toLowerCase()}.`,
        isTemporary: false,
        action: { label: "Go Back", type: "button" },
      };
  }
}
