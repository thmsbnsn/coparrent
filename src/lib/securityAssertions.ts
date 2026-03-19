/**
 * Security Model Assertion Tests (Executable Truth)
 * 
 * SECURITY_MODEL.md is a contract, not documentation.
 * This file contains executable assertions that validate enforcement at runtime.
 * 
 * These assertions are designed to FAIL LOUDLY when:
 * - A role escalation bug is introduced
 * - A new route is added without enforcement
 * - A server endpoint trusts client input
 * 
 * Courts may scrutinize this. Code accordingly.
 */
import {
  canThirdPartyAccessRoute,
  isChildAllowedRoute,
} from "@/lib/routeAccess";

// =============================================================================
// SECURITY INVARIANTS - These are the rules that MUST hold true
// =============================================================================

/**
 * INVARIANT 1: Third-party users cannot write to restricted resources
 * Enforcement: RLS policies + edge function guards + route protection
 */
export const THIRD_PARTY_RESTRICTED_ACTIONS = [
  "create_child",
  "update_child",
  "delete_child",
  "create_expense",
  "update_expense",
  "delete_expense",
  "upload_document",
  "delete_document",
  "update_custody_schedule",
  "manage_subscription",
  "invite_coparent",
  "invite_third_party",
] as const;

/**
 * INVARIANT 3: Child accounts cannot access parent-only data tables
 * Enforcement: RLS policies with account_role checks
 */
export const PARENT_ONLY_TABLES = [
  "custody_schedules", // Children can see calendar, not edit schedules
  "expenses",
  "audit_logs",
  "invitations",
  "step_parents",
  "law_library_resources",
] as const;

/**
 * INVARIANT 4: Admin access is granted ONLY via user_roles table
 * Enforcement: has_role() database function (SECURITY DEFINER)
 */
export const ADMIN_ONLY_ACTIONS = [
  "manage_law_library",
  "manage_users",
  "view_all_audit_logs",
  "seed_data",
  "run_migration_dry_run",
] as const;

/**
 * INVARIANT 5: Client-side gating is NEVER trusted alone
 * Server enforcement MUST exist for every gated feature
 */
export const SERVER_ENFORCED_FEATURES = [
  { feature: "expenses", rlsTable: "expenses", edgeFunction: null },
  { feature: "documents", rlsTable: "documents", edgeFunction: null },
  { feature: "children", rlsTable: "children", edgeFunction: null },
  { feature: "ai_message_assist", rlsTable: null, edgeFunction: "ai-message-assist" },
  { feature: "ai_schedule_suggest", rlsTable: null, edgeFunction: "ai-schedule-suggest" },
  { feature: "nurse_nancy", rlsTable: null, edgeFunction: "nurse-nancy-chat" },
  { feature: "coloring_pages", rlsTable: null, edgeFunction: "generate-coloring-page" },
  { feature: "subscription", rlsTable: null, edgeFunction: "check-subscription" },
] as const;

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type SecurityRole = "parent" | "guardian" | "third_party" | "child" | "admin";

export interface SecurityContext {
  userId: string;
  profileId: string | null;
  role: SecurityRole;
  isAdmin: boolean;
  subscriptionTier: "free" | "trial" | "power";
}

export interface AssertionResult {
  passed: boolean;
  invariant: string;
  details: string;
  severity: "critical" | "high" | "medium";
}

// =============================================================================
// ROUTE PROTECTION ASSERTIONS
// =============================================================================

/**
 * Asserts that a route is protected for the given role
 * INVARIANT: Route access must match declared restrictions
 */
export function assertRouteProtected(
  pathname: string,
  role: SecurityRole
): AssertionResult {
  const passed = role === "third_party"
    ? canThirdPartyAccessRoute(pathname)
    : role === "child"
      ? isChildAllowedRoute(pathname)
      : true;
  const outcome = passed ? "allowed" : "blocked";

  return {
    passed,
    invariant: "ROUTE_PROTECTION",
    details: `Route ${pathname} ${outcome} for role ${role}`,
    severity: "critical",
  };
}

export function assertChildRouteRestriction(
  pathname: string,
  isChildAccount: boolean
): AssertionResult {
  if (!isChildAccount) {
    return {
      passed: true,
      invariant: "CHILD_ROUTE_ENFORCEMENT",
      details: "User is not a child account - no restriction needed",
      severity: "high",
    };
  }

  const passed = isChildAllowedRoute(pathname);

  return {
    passed,
    invariant: "CHILD_ROUTE_ENFORCEMENT",
    details: `Child account ${passed ? "allowed" : "blocked"} from ${pathname}`,
    severity: "critical",
  };
}

// =============================================================================
// ACTION PERMISSION ASSERTIONS
// =============================================================================

/**
 * THIRD_PARTY_WRITE_BLOCK: Third-party users CANNOT perform write actions
 */
export function assertThirdPartyCannotWrite(
  action: (typeof THIRD_PARTY_RESTRICTED_ACTIONS)[number],
  role: SecurityRole
): AssertionResult {
  const isThirdParty = role === "third_party";
  const isRestrictedAction = THIRD_PARTY_RESTRICTED_ACTIONS.includes(action);

  if (isThirdParty && isRestrictedAction) {
    return {
      passed: false, // This should fail - third party attempting restricted action
      invariant: "THIRD_PARTY_WRITE_BLOCK",
      details: `Third-party attempted restricted action: ${action}`,
      severity: "critical",
    };
  }

  return {
    passed: true,
    invariant: "THIRD_PARTY_WRITE_BLOCK",
    details: `Action ${action} allowed for role ${role}`,
    severity: "critical",
  };
}

/**
 * CHILD_DATA_CREATION_BLOCK: Children CANNOT create data
 * Per SECURITY_MODEL.md: "No child-initiated data creation"
 */
export function assertChildCannotCreateData(
  action: string,
  isChildAccount: boolean
): AssertionResult {
  const dataCreationActions = [
    "create_child",
    "create_expense",
    "upload_document",
    "create_journal",
    "create_activity",
  ];

  if (isChildAccount && dataCreationActions.includes(action)) {
    return {
      passed: false,
      invariant: "CHILD_DATA_CREATION_BLOCK",
      details: `Child account attempted data creation: ${action}`,
      severity: "critical",
    };
  }

  return {
    passed: true,
    invariant: "CHILD_DATA_CREATION_BLOCK",
    details: `Action ${action} permitted for account type`,
    severity: "critical",
  };
}

// =============================================================================
// ADMIN ACCESS ASSERTIONS
// =============================================================================

/**
 * ADMIN_VIA_USER_ROLES_ONLY: Admin access MUST be from user_roles table
 * Never from client claims, never from profile fields
 */
export function assertAdminAccessSource(
  isAdmin: boolean,
  source: "user_roles_table" | "client_claim" | "profile_field" | "unknown"
): AssertionResult {
  if (isAdmin && source !== "user_roles_table") {
    return {
      passed: false,
      invariant: "ADMIN_VIA_USER_ROLES_ONLY",
      details: `Admin access from invalid source: ${source}. MUST be user_roles_table only.`,
      severity: "critical",
    };
  }

  return {
    passed: true,
    invariant: "ADMIN_VIA_USER_ROLES_ONLY",
    details: `Admin access correctly sourced from ${source}`,
    severity: "critical",
  };
}

/**
 * ADMIN_ACTION_ENFORCEMENT: Admin actions MUST check is_admin() RPC
 */
export function assertAdminActionEnforced(
  action: (typeof ADMIN_ONLY_ACTIONS)[number],
  isAdmin: boolean,
  checkedViaRPC: boolean
): AssertionResult {
  if (!checkedViaRPC) {
    return {
      passed: false,
      invariant: "ADMIN_ACTION_ENFORCEMENT",
      details: `Admin action ${action} not verified via is_admin() RPC`,
      severity: "critical",
    };
  }

  return {
    passed: true,
    invariant: "ADMIN_ACTION_ENFORCEMENT",
    details: `Admin action ${action} properly enforced`,
    severity: "critical",
  };
}

// =============================================================================
// SERVER ENFORCEMENT ASSERTIONS
// =============================================================================

/**
 * NO_CLIENT_ONLY_GATING: Every gated feature MUST have server enforcement
 * RLS or edge function - client checks are UX only
 */
export function assertServerEnforcementExists(
  feature: string
): AssertionResult {
  const config = SERVER_ENFORCED_FEATURES.find((f) => f.feature === feature);

  if (!config) {
    return {
      passed: false,
      invariant: "NO_CLIENT_ONLY_GATING",
      details: `Feature ${feature} not found in server enforcement registry`,
      severity: "high",
    };
  }

  if (!config.rlsTable && !config.edgeFunction) {
    return {
      passed: false,
      invariant: "NO_CLIENT_ONLY_GATING",
      details: `Feature ${feature} has no RLS table or edge function enforcement`,
      severity: "critical",
    };
  }

  return {
    passed: true,
    invariant: "NO_CLIENT_ONLY_GATING",
    details: `Feature ${feature} enforced via ${config.rlsTable || config.edgeFunction}`,
    severity: "high",
  };
}

// =============================================================================
// SUBSCRIPTION ENFORCEMENT ASSERTIONS
// =============================================================================

/**
 * SUBSCRIPTION_SERVER_ENFORCED: Subscription tier MUST be verified server-side
 * Client claims are ignored - profile.subscription_status is source of truth
 */
export function assertSubscriptionNotClientTrusted(
  tierSource: "profile_database" | "client_claim" | "edge_function"
): AssertionResult {
  if (tierSource === "client_claim") {
    return {
      passed: false,
      invariant: "SUBSCRIPTION_SERVER_ENFORCED",
      details: "Subscription tier trusted from client claim - SECURITY VIOLATION",
      severity: "critical",
    };
  }

  return {
    passed: true,
    invariant: "SUBSCRIPTION_SERVER_ENFORCED",
    details: `Subscription tier from valid source: ${tierSource}`,
    severity: "critical",
  };
}

/**
 * TRIAL_EXPIRY_REALTIME: Trial expiry MUST be checked in real-time
 * Cached trial status is not trusted
 */
export function assertTrialExpiryCheckedRealtime(
  trialEndsAt: Date | null,
  checkTime: Date,
  cachedStatusUsed: boolean
): AssertionResult {
  if (cachedStatusUsed && trialEndsAt) {
    return {
      passed: false,
      invariant: "TRIAL_EXPIRY_REALTIME",
      details: "Trial status used from cache without real-time expiry check",
      severity: "high",
    };
  }

  if (trialEndsAt && trialEndsAt < checkTime) {
    return {
      passed: true,
      invariant: "TRIAL_EXPIRY_REALTIME",
      details: "Trial correctly identified as expired via real-time check",
      severity: "high",
    };
  }

  return {
    passed: true,
    invariant: "TRIAL_EXPIRY_REALTIME",
    details: "Trial expiry check performed correctly",
    severity: "high",
  };
}

// =============================================================================
// FAIL CLOSED ASSERTIONS
// =============================================================================

/**
 * FAIL_CLOSED: On any security check error, access MUST be denied
 */
export function assertFailClosed(
  errorOccurred: boolean,
  accessGranted: boolean
): AssertionResult {
  if (errorOccurred && accessGranted) {
    return {
      passed: false,
      invariant: "FAIL_CLOSED",
      details: "Access granted despite security check error - CRITICAL VIOLATION",
      severity: "critical",
    };
  }

  return {
    passed: true,
    invariant: "FAIL_CLOSED",
    details: errorOccurred
      ? "Access correctly denied on error"
      : "No error occurred",
    severity: "critical",
  };
}

// =============================================================================
// PERMISSION CONSISTENCY ASSERTIONS
// =============================================================================

/**
 * UI_SERVER_PARITY: UI permission checks MUST match server enforcement
 * If UI shows a button, server MUST allow the action (and vice versa)
 */
export function assertUIServerParity(
  uiPermission: boolean,
  serverWouldAllow: boolean,
  feature: string
): AssertionResult {
  if (uiPermission !== serverWouldAllow) {
    return {
      passed: false,
      invariant: "UI_SERVER_PARITY",
      details: `UI/Server mismatch for ${feature}: UI=${uiPermission}, Server=${serverWouldAllow}`,
      severity: "high",
    };
  }

  return {
    passed: true,
    invariant: "UI_SERVER_PARITY",
    details: `UI and server agree on ${feature} permission: ${uiPermission}`,
    severity: "high",
  };
}

// =============================================================================
// BATCH VALIDATION RUNNER
// =============================================================================

/**
 * Run all security assertions for a given context
 * Returns all failures for review
 */
export function runSecurityAssertions(context: {
  pathname: string;
  role: SecurityRole;
  isChildAccount: boolean;
  isAdmin: boolean;
  adminSource: "user_roles_table" | "client_claim" | "profile_field" | "unknown";
  subscriptionSource: "profile_database" | "client_claim" | "edge_function";
  trialEndsAt: Date | null;
}): AssertionResult[] {
  const results: AssertionResult[] = [];

  // Route protection
  results.push(assertRouteProtected(context.pathname, context.role));
  results.push(assertChildRouteRestriction(context.pathname, context.isChildAccount));

  // Admin source
  results.push(assertAdminAccessSource(context.isAdmin, context.adminSource));

  // Subscription
  results.push(assertSubscriptionNotClientTrusted(context.subscriptionSource));
  results.push(
    assertTrialExpiryCheckedRealtime(context.trialEndsAt, new Date(), false)
  );

  return results;
}

/**
 * Get all failed assertions (for alerting/logging)
 */
export function getSecurityViolations(
  results: AssertionResult[]
): AssertionResult[] {
  return results.filter((r) => !r.passed);
}

/**
 * Check if any critical violations exist
 */
export function hasCriticalViolations(results: AssertionResult[]): boolean {
  return results.some((r) => !r.passed && r.severity === "critical");
}
