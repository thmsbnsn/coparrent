/**
 * Security Invariants - Compile-time and runtime invariant checks
 * 
 * These are the non-negotiable rules of the security model.
 * Violations are logged and, in development, throw errors.
 * 
 * SECURITY_MODEL.md Section: "Intentional Security Limitations"
 * - No public share links
 * - No client-controlled permission elevation
 * - No child-initiated data creation
 * - No background monitoring of user activity
 * - No automated decision-making affecting custody or care
 */

import { logger } from "./logger";

// =============================================================================
// INVARIANT ENFORCEMENT
// =============================================================================

const IS_DEV = import.meta.env.DEV;

/**
 * Asserts a security invariant at runtime
 * In development: throws an error
 * In production: logs and returns false
 */
export function assertInvariant(
  condition: boolean,
  invariantName: string,
  details: string
): boolean {
  if (condition) {
    return true;
  }

  const message = `SECURITY INVARIANT VIOLATION: ${invariantName} - ${details}`;
  
  logger.error(message, {
    invariant: invariantName,
    details,
    timestamp: new Date().toISOString(),
  });

  if (IS_DEV) {
    throw new Error(message);
  }

  return false;
}

/**
 * Logs a security event for audit trail
 */
export function logSecurityEvent(
  event: "ACCESS_DENIED" | "PRIVILEGE_CHECK" | "RATE_LIMITED" | "SUSPICIOUS_ACTIVITY",
  details: Record<string, unknown>
): void {
  logger.info(`Security event: ${event}`, {
    event,
    ...details,
    timestamp: new Date().toISOString(),
  });
}

// =============================================================================
// ROLE INVARIANTS
// =============================================================================

/**
 * INVARIANT: Roles cannot be escalated client-side
 * Only these transitions are valid server-side:
 * - null -> parent (on signup)
 * - null -> third_party (on invite accept)
 * - third_party -> removed (on revocation)
 */
export const VALID_ROLE_TRANSITIONS = {
  null: ["parent", "third_party", "child"],
  parent: [], // Parents cannot be demoted
  guardian: [], // Guardians cannot be demoted
  third_party: ["removed"], // Can only be removed
  child: [], // Children cannot change role
} as const;

export function assertValidRoleTransition(
  fromRole: string | null,
  toRole: string
): boolean {
  const validTargets = VALID_ROLE_TRANSITIONS[fromRole as keyof typeof VALID_ROLE_TRANSITIONS] || [];
  
  return assertInvariant(
    validTargets.includes(toRole as never),
    "ROLE_TRANSITION",
    `Invalid transition from ${fromRole} to ${toRole}`
  );
}

// =============================================================================
// DATA ACCESS INVARIANTS
// =============================================================================

/**
 * INVARIANT: Third-party users cannot modify any data
 */
export function assertThirdPartyReadOnly(
  isThirdParty: boolean,
  operation: "read" | "create" | "update" | "delete"
): boolean {
  if (!isThirdParty) return true;
  
  return assertInvariant(
    operation === "read",
    "THIRD_PARTY_READ_ONLY",
    `Third-party attempted ${operation} operation`
  );
}

/**
 * INVARIANT: Child accounts cannot create data
 */
export function assertChildNoDataCreation(
  isChildAccount: boolean,
  operation: "create" | "update" | "delete"
): boolean {
  if (!isChildAccount) return true;
  
  // Children can only update limited things (like mood check-ins if permitted)
  if (operation === "create" || operation === "delete") {
    return assertInvariant(
      false,
      "CHILD_NO_DATA_CREATION",
      `Child account attempted ${operation} operation`
    );
  }
  
  return true;
}

/**
 * INVARIANT: Data ownership is immutable (cannot transfer)
 */
export function assertOwnershipImmutable(
  originalOwnerId: string,
  newOwnerId: string
): boolean {
  return assertInvariant(
    originalOwnerId === newOwnerId,
    "OWNERSHIP_IMMUTABLE",
    `Attempted to transfer ownership from ${originalOwnerId} to ${newOwnerId}`
  );
}

// =============================================================================
// SUBSCRIPTION INVARIANTS
// =============================================================================

/**
 * INVARIANT: Client cannot claim subscription tier
 * Tier must come from profile.subscription_status (set by Stripe webhook)
 */
export function assertSubscriptionFromServer(
  source: "webhook" | "profile_db" | "client_claim"
): boolean {
  return assertInvariant(
    source !== "client_claim",
    "SUBSCRIPTION_FROM_SERVER",
    `Subscription tier from ${source}`
  );
}

/**
 * INVARIANT: Trial users are NOT premium users
 * Trial has separate limits and tracking
 */
export function assertTrialNotPremium(
  status: string,
  tier: string
): boolean {
  if (status === "trialing") {
    return assertInvariant(
      tier === "trial" || tier === "power", // During trial, tier should indicate trial
      "TRIAL_NOT_PREMIUM",
      `Trial user incorrectly marked as tier: ${tier}`
    );
  }
  return true;
}

/**
 * INVARIANT: Expired trial = Free immediately
 * No grace period for trials
 */
export function assertTrialExpiryEnforced(
  trialEndsAt: Date | null,
  accessGranted: boolean
): boolean {
  if (!trialEndsAt) return true;
  
  const now = new Date();
  if (trialEndsAt < now) {
    return assertInvariant(
      !accessGranted,
      "TRIAL_EXPIRY_IMMEDIATE",
      `Premium access granted despite expired trial (ended: ${trialEndsAt.toISOString()})`
    );
  }
  
  return true;
}

// =============================================================================
// AI SAFETY INVARIANTS
// =============================================================================

/**
 * INVARIANT: AI outputs are non-diagnostic and non-authoritative
 */
export const AI_SAFETY_DISCLAIMERS = {
  NURSE_NANCY: "This is general wellness information only. For medical emergencies, call 911.",
  SCHEDULE_ASSIST: "This is a suggestion only. Review carefully before accepting.",
  MESSAGE_ASSIST: "Suggested rewording. Review before sending.",
} as const;

/**
 * INVARIANT: Emergency scenarios defer to local services
 */
export const EMERGENCY_KEYWORDS = [
  "emergency",
  "urgent",
  "911",
  "poison",
  "bleeding",
  "unconscious",
  "not breathing",
  "overdose",
  "suicide",
  "abuse",
] as const;

export function checkForEmergencyContent(content: string): {
  isEmergency: boolean;
  matchedKeyword: string | null;
} {
  const lowerContent = content.toLowerCase();
  
  for (const keyword of EMERGENCY_KEYWORDS) {
    if (lowerContent.includes(keyword)) {
      return { isEmergency: true, matchedKeyword: keyword };
    }
  }
  
  return { isEmergency: false, matchedKeyword: null };
}

// =============================================================================
// AUDIT INVARIANTS
// =============================================================================

/**
 * INVARIANT: Sensitive content is not logged in plaintext
 */
export const REDACTED_FIELDS = [
  "password",
  "secret",
  "token",
  "api_key",
  "medical_notes",
  "content", // Message content
] as const;

export function redactSensitiveFields<T extends Record<string, unknown>>(
  obj: T
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (REDACTED_FIELDS.some(field => key.toLowerCase().includes(field))) {
      result[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      result[key] = redactSensitiveFields(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

// =============================================================================
// ROUTE INVARIANTS
// =============================================================================

/**
 * INVARIANT: All protected routes must have server enforcement
 * This list must match ProtectedRoute.tsx
 */
export interface RouteEnforcementConfig {
  requiresParent?: boolean;
  requiresAdmin?: boolean;
  rlsProtected: boolean;
}

export const ROUTE_ENFORCEMENT_MAP: Record<string, RouteEnforcementConfig> = {
  "/dashboard/settings": { requiresParent: true, rlsProtected: true },
  "/dashboard/audit": { requiresParent: true, rlsProtected: true },
  "/dashboard/children": { requiresParent: true, rlsProtected: true },
  "/dashboard/documents": { requiresParent: true, rlsProtected: true },
  "/dashboard/expenses": { requiresParent: true, rlsProtected: true },
  "/dashboard/law-library": { requiresParent: true, rlsProtected: false },
  "/dashboard/kids-hub": { requiresParent: true, rlsProtected: true },
  "/admin": { requiresAdmin: true, rlsProtected: true },
};

/**
 * Check if a route has proper enforcement configured
 */
export function isRouteEnforced(pathname: string): boolean {
  for (const [route, config] of Object.entries(ROUTE_ENFORCEMENT_MAP)) {
    if (pathname === route || pathname.startsWith(route + "/")) {
      // Route is in the map, check if it has enforcement
      return !!(config.requiresParent || config.requiresAdmin || config.rlsProtected);
    }
  }
  
  // Unknown route - log warning
  logger.warn("Route not in enforcement map", { pathname });
  return false;
}
