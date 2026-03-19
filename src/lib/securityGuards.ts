/**
 * Security Guards - Runtime enforcement utilities
 * 
 * These guards wrap operations and enforce security invariants at runtime.
 * They are designed to be used in conjunction with RLS and edge function checks.
 * 
 * PRINCIPLE: Defense in depth. These guards are ADDITIONAL protection,
 * not a replacement for server-side enforcement.
 */

import { supabase } from "@/integrations/supabase/client";
import { logger } from "./logger";

// =============================================================================
// TYPES
// =============================================================================

export type GuardResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string; code: SecurityErrorCode };

export type SecurityErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "ROLE_REQUIRED"
  | "SUBSCRIPTION_REQUIRED"
  | "ADMIN_REQUIRED"
  | "PARENT_REQUIRED"
  | "SERVER_ERROR";

// =============================================================================
// ADMIN GUARD
// =============================================================================

/**
 * Verifies admin status via server RPC call
 * NEVER trusts client-side state
 * 
 * SECURITY INVARIANT: Admin access ONLY via user_roles table
 */
export async function verifyAdminAccess(): Promise<GuardResult<boolean>> {
  try {
    const { data, error } = await supabase.rpc("is_admin");

    if (error) {
      logger.error("Admin verification failed", { error });
      // FAIL CLOSED: deny on error
      return {
        success: false,
        error: "Admin verification failed",
        code: "SERVER_ERROR",
      };
    }

    if (data !== true) {
      return {
        success: false,
        error: "Admin access required",
        code: "ADMIN_REQUIRED",
      };
    }

    return { success: true, data: true };
  } catch (err) {
    logger.error("Admin check exception", { err });
    // FAIL CLOSED
    return {
      success: false,
      error: "Admin verification error",
      code: "SERVER_ERROR",
    };
  }
}

// =============================================================================
// PARENT/GUARDIAN GUARD
// =============================================================================

/**
 * Verifies parent/guardian role via server
 * 
 * SECURITY INVARIANT: Parent status from profiles + family_members check
 */
export async function verifyParentAccess(): Promise<GuardResult<{
  profileId: string;
  isParent: boolean;
}>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return {
        success: false,
        error: "Authentication required",
        code: "UNAUTHORIZED",
      };
    }

    // Get profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, account_role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return {
        success: false,
        error: "Profile not found",
        code: "SERVER_ERROR",
      };
    }

    // Check if child account
    if (profile.account_role === "child") {
      return {
        success: false,
        error: "Parent access required",
        code: "PARENT_REQUIRED",
      };
    }

    // Check if third-party
    const { data: familyMember } = await supabase
      .from("family_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (familyMember?.role === "third_party") {
      return {
        success: false,
        error: "Parent access required - third-party members have view-only access",
        code: "PARENT_REQUIRED",
      };
    }

    return {
      success: true,
      data: { profileId: profile.id, isParent: true },
    };
  } catch (err) {
    logger.error("Parent verification exception", { err });
    return {
      success: false,
      error: "Parent verification error",
      code: "SERVER_ERROR",
    };
  }
}

// =============================================================================
// SUBSCRIPTION GUARD
// =============================================================================

/**
 * Verifies subscription tier via server
 * 
 * SECURITY INVARIANT: Subscription from profile.subscription_status (set by webhook)
 * INVARIANT: Trial expiry checked in real-time
 */
export async function verifySubscriptionAccess(
  requiredTier: "power" | "any"
): Promise<GuardResult<{
  tier: string;
  hasPremiumAccess: boolean;
}>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return {
        success: false,
        error: "Authentication required",
        code: "UNAUTHORIZED",
      };
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("free_premium_access, subscription_status, subscription_tier, trial_ends_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !profile) {
      return {
        success: false,
        error: "Profile not found",
        code: "SERVER_ERROR",
      };
    }

    // Check free access (admin granted)
    if (profile.free_premium_access === true) {
      return {
        success: true,
        data: { tier: "admin_access", hasPremiumAccess: true },
      };
    }

    // Check active subscription
    if (profile.subscription_status === "active") {
      const tier = profile.subscription_tier;
      const hasPremium = ["power", "premium", "mvp"].includes(tier || "");
      
      if (requiredTier === "power" && !hasPremium) {
        return {
          success: false,
          error: "Power subscription required",
          code: "SUBSCRIPTION_REQUIRED",
        };
      }
      
      return {
        success: true,
        data: { tier: tier || "free", hasPremiumAccess: hasPremium },
      };
    }

    // Check trial - REAL-TIME expiry check
    if (profile.trial_ends_at) {
      const trialEnd = new Date(profile.trial_ends_at);
      const now = new Date();
      
      if (trialEnd > now) {
        return {
          success: true,
          data: { tier: "trial", hasPremiumAccess: true },
        };
      }
      
      // Trial expired
      logger.info("Trial expired during access check", {
        userId: user.id,
        trialEnd: profile.trial_ends_at,
      });
    }

    // No premium access
    if (requiredTier === "power") {
      return {
        success: false,
        error: "Power subscription required",
        code: "SUBSCRIPTION_REQUIRED",
      };
    }

    return {
      success: true,
      data: { tier: "free", hasPremiumAccess: false },
    };
  } catch (err) {
    logger.error("Subscription verification exception", { err });
    return {
      success: false,
      error: "Subscription verification error",
      code: "SERVER_ERROR",
    };
  }
}

// =============================================================================
// CHILD ACCESS GUARD
// =============================================================================

/**
 * Verifies user can access a specific child's data
 * 
 * SECURITY INVARIANT: Access via parent_children junction table
 */
export async function verifyChildAccess(
  childId: string
): Promise<GuardResult<boolean>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return {
        success: false,
        error: "Authentication required",
        code: "UNAUTHORIZED",
      };
    }

    // Get profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) {
      return {
        success: false,
        error: "Profile not found",
        code: "SERVER_ERROR",
      };
    }

    // Check parent_children link
    const { data: link, error } = await supabase
      .from("parent_children")
      .select("id")
      .eq("parent_id", profile.id)
      .eq("child_id", childId)
      .maybeSingle();

    if (error) {
      return {
        success: false,
        error: "Access verification failed",
        code: "SERVER_ERROR",
      };
    }

    if (!link) {
      return {
        success: false,
        error: "Access to this child denied",
        code: "FORBIDDEN",
      };
    }

    return { success: true, data: true };
  } catch (err) {
    logger.error("Child access verification exception", { err });
    return {
      success: false,
      error: "Child access verification error",
      code: "SERVER_ERROR",
    };
  }
}

// =============================================================================
// DOCUMENT ACCESS GUARD
// =============================================================================

/**
 * Verifies user can access a specific document
 * 
 * SECURITY INVARIANT: Uses can_access_document() database function
 */
export async function verifyDocumentAccess(
  documentId: string
): Promise<GuardResult<boolean>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return {
        success: false,
        error: "Authentication required",
        code: "UNAUTHORIZED",
      };
    }

    const { data, error } = await supabase.rpc("can_access_document", {
      _user_id: user.id,
      _document_id: documentId,
    });

    if (error) {
      logger.error("Document access check failed", { error, documentId });
      return {
        success: false,
        error: "Document access verification failed",
        code: "SERVER_ERROR",
      };
    }

    if (!data) {
      return {
        success: false,
        error: "Document access denied",
        code: "FORBIDDEN",
      };
    }

    return { success: true, data: true };
  } catch (err) {
    logger.error("Document access verification exception", { err });
    return {
      success: false,
      error: "Document access verification error",
      code: "SERVER_ERROR",
    };
  }
}

// =============================================================================
// THREAD ACCESS GUARD
// =============================================================================

/**
 * Verifies user can access a message thread
 * 
 * SECURITY INVARIANT: Uses can_access_thread() database function
 */
export async function verifyThreadAccess(
  threadId: string
): Promise<GuardResult<boolean>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return {
        success: false,
        error: "Authentication required",
        code: "UNAUTHORIZED",
      };
    }

    const { data, error } = await supabase.rpc("can_access_thread", {
      _user_id: user.id,
      _thread_id: threadId,
    });

    if (error) {
      logger.error("Thread access check failed", { error, threadId });
      return {
        success: false,
        error: "Thread access verification failed",
        code: "SERVER_ERROR",
      };
    }

    if (!data) {
      return {
        success: false,
        error: "Thread access denied",
        code: "FORBIDDEN",
      };
    }

    return { success: true, data: true };
  } catch (err) {
    logger.error("Thread access verification exception", { err });
    return {
      success: false,
      error: "Thread access verification error",
      code: "SERVER_ERROR",
    };
  }
}

// =============================================================================
// COMPOSITE GUARDS
// =============================================================================

/**
 * Guard for write operations - requires parent + optional subscription
 */
export async function guardWriteOperation(options: {
  requireSubscription?: "power" | "any";
}): Promise<GuardResult<{
  profileId: string;
  tier: string;
}>> {
  // Check parent access
  const parentResult = await verifyParentAccess();
  if (!parentResult.success) {
    return parentResult as GuardResult<{ profileId: string; tier: string }>;
  }

  // Check subscription if required
  if (options.requireSubscription) {
    const subResult = await verifySubscriptionAccess(options.requireSubscription);
    if (!subResult.success) {
      return subResult as GuardResult<{ profileId: string; tier: string }>;
    }
    return {
      success: true,
      data: {
        profileId: parentResult.data.profileId,
        tier: subResult.data.tier,
      },
    };
  }

  return {
    success: true,
    data: {
      profileId: parentResult.data.profileId,
      tier: "free",
    },
  };
}

/**
 * Guard for admin operations
 */
export async function guardAdminOperation(): Promise<GuardResult<boolean>> {
  // First check parent (admins must have profiles)
  const parentResult = await verifyParentAccess();
  if (!parentResult.success) {
    return parentResult as GuardResult<boolean>;
  }

  // Then check admin
  return verifyAdminAccess();
}
