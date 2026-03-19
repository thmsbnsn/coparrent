/**
 * React hook for security context and runtime assertion checks
 * 
 * This hook provides a centralized way to access security context
 * and run security assertions in React components.
 * 
 * SECURITY_MODEL.md: "Server-enforced rules over UI checks"
 * This hook enables UI to reflect server-enforced state accurately.
 */

import { useMemo, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "./usePermissions";
import { useFamilyRole } from "./useFamilyRole";
import { useSubscription } from "./useSubscription";
import {
  SecurityRole,
  runSecurityAssertions,
  getSecurityViolations,
  hasCriticalViolations,
  assertRouteProtected,
  assertChildRouteRestriction,
  assertThirdPartyCannotWrite,
  assertChildCannotCreateData,
  THIRD_PARTY_RESTRICTED_ACTIONS,
  type AssertionResult,
} from "@/lib/securityAssertions";
import {
  assertThirdPartyReadOnly,
  assertChildNoDataCreation,
  logSecurityEvent,
} from "@/lib/securityInvariants";
import { logger } from "@/lib/logger";

export interface SecurityContextResult {
  /** Current user's security role */
  role: SecurityRole;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Whether user has admin access (server-verified) */
  isAdmin: boolean;
  /** Current pathname for route checks */
  pathname: string;
  /** Run all security assertions for current context */
  runAssertions: () => AssertionResult[];
  /** Check if a specific action is allowed */
  canPerformAction: (action: string) => { allowed: boolean; reason?: string };
  /** Check if current route is allowed */
  isRouteAllowed: () => boolean;
  /** Log a security event for audit */
  logSecurityEvent: (
    event: "ACCESS_DENIED" | "PRIVILEGE_CHECK" | "RATE_LIMITED" | "SUSPICIOUS_ACTIVITY",
    details: Record<string, unknown>
  ) => void;
  /** Check for violations and log them */
  checkAndLogViolations: () => boolean;
}

export const useSecurityContext = (): SecurityContextResult => {
  const { user } = useAuth();
  const location = useLocation();
  const { isThirdParty, isChildAccount } = usePermissions();
  const { isThirdParty: familyThirdParty } = useFamilyRole();
  const { subscribed, trial, freeAccess } = useSubscription();

  // Determine security role
  const role: SecurityRole = useMemo(() => {
    if (!user) return "third_party"; // Treat unauthenticated as lowest privilege
    if (isChildAccount) return "child";
    if (familyThirdParty) return "third_party";
    return "parent";
  }, [user, isChildAccount, familyThirdParty]);

  // NOTE: Admin status should be checked via server RPC, not cached
  // This is for UI hints only - actual enforcement is server-side
  const isAdmin = false; // Always false client-side - use verifyAdminAccess() for real checks

  // Check if a specific action is allowed
  const canPerformAction = useCallback(
    (action: string): { allowed: boolean; reason?: string } => {
      // Check third-party restrictions
      if (
        isThirdParty &&
        THIRD_PARTY_RESTRICTED_ACTIONS.includes(
          action as (typeof THIRD_PARTY_RESTRICTED_ACTIONS)[number]
        )
      ) {
        logSecurityEvent("ACCESS_DENIED", {
          userId: user?.id,
          action,
          reason: "third_party_restricted",
        });
        return {
          allowed: false,
          reason: "Third-party members cannot perform this action",
        };
      }

      // Check child restrictions for data creation
      if (isChildAccount) {
        const dataCreationActions = [
          "create_child",
          "create_expense",
          "upload_document",
          "create_journal",
          "create_activity",
        ];
        if (dataCreationActions.includes(action)) {
          logSecurityEvent("ACCESS_DENIED", {
            userId: user?.id,
            action,
            reason: "child_data_creation_blocked",
          });
          return {
            allowed: false,
            reason: "Child accounts cannot create data",
          };
        }
      }

      return { allowed: true };
    },
    [user?.id, isThirdParty, isChildAccount]
  );

  // Check if current route is allowed
  const isRouteAllowed = useCallback((): boolean => {
    if (isChildAccount) {
      const result = assertChildRouteRestriction(location.pathname, true);
      if (!result.passed) {
        logSecurityEvent("ACCESS_DENIED", {
          userId: user?.id,
          pathname: location.pathname,
          reason: "child_route_blocked",
        });
        return false;
      }
    }

    if (isThirdParty) {
      const result = assertRouteProtected(location.pathname, "third_party");
      if (!result.passed) {
        logSecurityEvent("ACCESS_DENIED", {
          userId: user?.id,
          pathname: location.pathname,
          reason: "third_party_route_blocked",
        });
        return false;
      }
    }

    return true;
  }, [user?.id, location.pathname, isChildAccount, isThirdParty]);

  // Run all security assertions
  const runAssertions = useCallback((): AssertionResult[] => {
    const tierSource = subscribed || trial || freeAccess 
      ? "profile_database" as const
      : "profile_database" as const;

    return runSecurityAssertions({
      pathname: location.pathname,
      role,
      isChildAccount,
      isAdmin,
      adminSource: "user_roles_table", // Always correct source
      subscriptionSource: tierSource,
      trialEndsAt: null, // Would need actual trial end date
    });
  }, [location.pathname, role, isChildAccount, isAdmin, subscribed, trial, freeAccess]);

  // Check for violations and log them
  const checkAndLogViolations = useCallback((): boolean => {
    const results = runAssertions();
    const violations = getSecurityViolations(results);

    if (violations.length > 0) {
      for (const violation of violations) {
        logger.error("Security assertion failed", {
          invariant: violation.invariant,
          details: violation.details,
          severity: violation.severity,
          pathname: location.pathname,
          role,
        });
      }
    }

    return hasCriticalViolations(results);
  }, [runAssertions, location.pathname, role]);

  return {
    role,
    isAuthenticated: !!user,
    isAdmin,
    pathname: location.pathname,
    runAssertions,
    canPerformAction,
    isRouteAllowed,
    logSecurityEvent,
    checkAndLogViolations,
  };
};

/**
 * Higher-order function for guarding async operations
 * 
 * Usage:
 * const guardedOperation = withSecurityGuard(
 *   async () => { ... },
 *   { requireParent: true, action: 'create_expense' }
 * );
 */
export function withSecurityGuard<T>(
  operation: () => Promise<T>,
  options: {
    requireParent?: boolean;
    requireAdmin?: boolean;
    action?: string;
    isThirdParty: boolean;
    isChildAccount: boolean;
  }
): () => Promise<T | null> {
  return async () => {
    // Check third-party restrictions
    if (options.requireParent && options.isThirdParty) {
      assertThirdPartyReadOnly(true, "create");
      logSecurityEvent("ACCESS_DENIED", {
        action: options.action,
        reason: "third_party_write_blocked",
      });
      return null;
    }

    // Check child restrictions
    if (options.requireParent && options.isChildAccount) {
      assertChildNoDataCreation(true, "create");
      logSecurityEvent("ACCESS_DENIED", {
        action: options.action,
        reason: "child_write_blocked",
      });
      return null;
    }

    return operation();
  };
}
