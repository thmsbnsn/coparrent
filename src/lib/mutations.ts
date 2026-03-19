/**
 * Mutation utilities for preventing double-submits, handling race conditions,
 * and providing consistent error handling across all data mutations.
 */

import { handleError, ERROR_MESSAGES, sanitizeErrorForUser } from "./errorMessages";

/**
 * In-flight mutation tracker to prevent double-submits
 */
const inFlightMutations = new Set<string>();

/**
 * Generate a unique mutation key
 */
export const getMutationKey = (action: string, ...identifiers: (string | undefined)[]): string => {
  return [action, ...identifiers.filter(Boolean)].join(":");
};

/**
 * Check if a mutation is currently in progress
 */
export const isMutationInProgress = (key: string): boolean => {
  return inFlightMutations.has(key);
};

/**
 * Guard against double-submits and race conditions
 * Returns true if the mutation can proceed, false if it should be blocked
 */
export const acquireMutationLock = (key: string): boolean => {
  if (inFlightMutations.has(key)) {
    console.warn(`[Mutation] Blocked duplicate: ${key}`);
    return false;
  }
  inFlightMutations.add(key);
  return true;
};

/**
 * Release a mutation lock
 */
export const releaseMutationLock = (key: string): void => {
  inFlightMutations.delete(key);
};

/**
 * Wrapper for async mutations with automatic locking and error handling
 */
export async function withMutationGuard<T>(
  key: string,
  mutationFn: () => Promise<T>,
  options?: {
    onBlocked?: () => void;
    feature?: string;
    action?: string;
  }
): Promise<T | null> {
  if (!acquireMutationLock(key)) {
    options?.onBlocked?.();
    return null;
  }

  try {
    return await mutationFn();
  } catch (error) {
    const message = handleError(error, {
      feature: options?.feature || "Mutation",
      action: options?.action || key,
    });
    throw new Error(message);
  } finally {
    releaseMutationLock(key);
  }
}

/**
 * Error types for consistent UI handling
 */
export type MutationErrorType = 
  | "permission"     // User lacks permission
  | "limit"          // Plan limit reached
  | "validation"     // Input validation failed
  | "network"        // Network/connectivity issue
  | "conflict"       // Concurrent modification conflict
  | "not_found"      // Resource doesn't exist
  | "unknown";       // Generic error

/**
 * Parse an error into a typed error for consistent UI handling
 */
export const parseMutationError = (error: unknown): { type: MutationErrorType; message: string } => {
  const message = sanitizeErrorForUser(error);
  
  // Check for specific error patterns
  if (typeof error === "object" && error !== null) {
    const err = error as Record<string, unknown>;
    
    // RPC error codes
    if (err.code === "NOT_PARENT" || err.code === "NOT_AUTHENTICATED" || err.code === "ACCESS_DENIED") {
      return { type: "permission", message };
    }
    if (err.code === "LIMIT_REACHED") {
      return { type: "limit", message };
    }
    if (err.code === "VALIDATION_ERROR") {
      return { type: "validation", message };
    }
    
    // Supabase/Postgres errors
    if (typeof err.message === "string") {
      const msg = err.message.toLowerCase();
      if (msg.includes("permission") || msg.includes("rls") || msg.includes("denied")) {
        return { type: "permission", message };
      }
      if (msg.includes("duplicate") || msg.includes("conflict")) {
        return { type: "conflict", message };
      }
      if (msg.includes("not found") || msg.includes("no rows")) {
        return { type: "not_found", message };
      }
      if (msg.includes("network") || msg.includes("fetch") || msg.includes("timeout")) {
        return { type: "network", message: ERROR_MESSAGES.NETWORK };
      }
    }
  }
  
  return { type: "unknown", message };
};

/**
 * Permission check utilities
 */
export interface PermissionContext {
  isAuthenticated: boolean;
  isParent: boolean;
  isThirdParty: boolean;
  isChildAccount?: boolean;
  profileId?: string | null;
}

/**
 * Check if user can perform parent-only mutations
 * Third-party and child accounts should be blocked
 */
export const canPerformParentMutation = (ctx: PermissionContext): boolean => {
  return ctx.isAuthenticated && ctx.isParent && !ctx.isChildAccount;
};

/**
 * Check if user can perform any authenticated mutation
 */
export const canPerformMutation = (ctx: PermissionContext): boolean => {
  return ctx.isAuthenticated && !!ctx.profileId;
};

/**
 * Tier/subscription status snapshot
 * Used to detect stale cached tier data
 */
export interface TierSnapshot {
  tier: string;
  timestamp: number;
}

const TIER_CACHE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Check if a cached tier snapshot is still valid
 */
export const isTierSnapshotValid = (snapshot: TierSnapshot | null): boolean => {
  if (!snapshot) return false;
  return Date.now() - snapshot.timestamp < TIER_CACHE_MAX_AGE_MS;
};

/**
 * Create a fresh tier snapshot
 */
export const createTierSnapshot = (tier: string): TierSnapshot => ({
  tier,
  timestamp: Date.now(),
});
