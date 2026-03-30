import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Types for AI Guard
export type FamilyRole = "parent" | "guardian" | "third_party" | null;
export type PlanTier = "free" | "trial" | "power" | "admin_access";
export type AiAction = 
  | "quick-check" 
  | "analyze" 
  | "rephrase" 
  | "draft" 
  | "schedule-suggest";

export interface UserContext {
  userId: string;
  profileId: string | null;
  familyId: string;
  role: FamilyRole;
  isParent: boolean;
  planTier: PlanTier;
  hasPremiumAccess: boolean;
}

export interface AiGuardScope {
  familyId?: string | null;
}

interface GuardResult {
  allowed: boolean;
  userContext?: UserContext;
  error?: { error: string; code: string };
  statusCode?: number;
}

interface PlanLimits {
  maxCallsPerDay: number;
  maxInputChars: number;
  maxTokens: number;
}

type SupabaseServiceClient = ReturnType<typeof createClient>;

interface FamilyMembershipRecord {
  family_id: string | null;
  role: FamilyRole;
  status: string | null;
}

interface FamilyAccessResult {
  profileId: string | null;
  role: FamilyRole;
  isParent: boolean;
  error?: { error: string; code: string };
  statusCode?: number;
}

// Plan-based limits (simplified: free vs power)
const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: { maxCallsPerDay: 10, maxInputChars: 600, maxTokens: 500 },
  trial: { maxCallsPerDay: 200, maxInputChars: 3000, maxTokens: 2000 },
  power: { maxCallsPerDay: 200, maxInputChars: 3000, maxTokens: 2000 },
  admin_access: { maxCallsPerDay: 200, maxInputChars: 3000, maxTokens: 2000 },
};

// Action allowlist by role and plan
const ACTION_ALLOWLIST: Record<AiAction, { requiresParent: boolean; requiresPremium: boolean }> = {
  "quick-check": { requiresParent: false, requiresPremium: false },
  "analyze": { requiresParent: true, requiresPremium: true },
  "rephrase": { requiresParent: true, requiresPremium: true },
  "draft": { requiresParent: true, requiresPremium: true },
  "schedule-suggest": { requiresParent: true, requiresPremium: true },
};

/**
 * Validates JWT token and returns user from Supabase auth
 */
async function validateAuth(
  supabase: SupabaseServiceClient,
  authHeader: string | null
): Promise<{ user: { id: string; email?: string } | null; error: string | null }> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { user: null, error: "Missing or invalid Authorization header" };
  }

  const token = authHeader.replace("Bearer ", "");
  
  const { data, error } = await supabase.auth.getUser(token);
  
  if (error || !data?.user) {
    return { user: null, error: error?.message || "Invalid or expired token" };
  }

  return { user: data.user, error: null };
}

/**
 * Resolve a user's role within an explicitly scoped family.
 */
async function getUserFamilyRole(
  supabase: SupabaseServiceClient,
  userId: string,
  scope: AiGuardScope,
): Promise<FamilyAccessResult> {
  try {
    // Get user's profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError || !profile) {
      return {
        profileId: null,
        role: null,
        isParent: false,
        error: { error: "Profile not found", code: "PROFILE_NOT_FOUND" },
        statusCode: 404,
      };
    }

    const { data: familyMembers, error: membershipError } = await supabase
      .from("family_members")
      .select("family_id, role, status")
      .eq("user_id", userId)
      .eq("status", "active");

    if (membershipError) {
      console.error("Error fetching family memberships:", membershipError);
      return {
        profileId: profile.id,
        role: null,
        isParent: false,
        error: { error: "Unable to verify family access", code: "FAMILY_ACCESS_ERROR" },
        statusCode: 500,
      };
    }

    const memberships = ((familyMembers ?? []) as FamilyMembershipRecord[])
      .filter((membership) => membership.family_id);
    const familyId = scope.familyId?.trim();

    if (!familyId) {
      if (memberships.length > 1) {
        return {
          profileId: profile.id,
          role: null,
          isParent: false,
          error: {
            error: "Multiple family memberships found. Provide an explicit family_id.",
            code: "AMBIGUOUS_FAMILY_SCOPE",
          },
          statusCode: 400,
        };
      }

      return {
        profileId: profile.id,
        role: null,
        isParent: false,
        error: {
          error: "family_id is required for AI requests.",
          code: "FAMILY_SCOPE_REQUIRED",
        },
        statusCode: 400,
      };
    }

    const scopedMemberships = memberships.filter((membership) => membership.family_id === familyId);

    if (scopedMemberships.length === 0) {
      return {
        profileId: profile.id,
        role: null,
        isParent: false,
        error: {
          error: "You do not have access to the provided family.",
          code: "FAMILY_ACCESS_DENIED",
        },
        statusCode: 403,
      };
    }

    if (scopedMemberships.length > 1) {
      return {
        profileId: profile.id,
        role: null,
        isParent: false,
        error: {
          error: "Ambiguous membership found for the provided family.",
          code: "AMBIGUOUS_FAMILY_MEMBERSHIP",
        },
        statusCode: 409,
      };
    }

    const membership = scopedMemberships[0];
    const role = membership.role as FamilyRole;

    return {
      profileId: profile.id,
      role,
      isParent: role === "parent" || role === "guardian",
    };
  } catch (error) {
    console.error("Error fetching family role:", error);
    return {
      profileId: null,
      role: null,
      isParent: false,
      error: { error: "Unable to verify family access", code: "FAMILY_ACCESS_ERROR" },
      statusCode: 500,
    };
  }
}

/**
 * Normalize tier from database (handles legacy values)
 */
function normalizeTier(tier: string | null): PlanTier {
  if (!tier) return "free";
  // Map legacy tiers to power
  if (tier === "premium" || tier === "mvp" || tier === "power") {
    return "power";
  }
  if (tier === "trial") return "trial";
  return "free";
}

/**
 * Determines user's subscription plan tier
 * 
 * INVARIANTS ENFORCED (Server-side, never trust client):
 * 1. Trial users ≠ Premium users (tracked via planTier)
 * 2. Expired trial = Free immediately (real-time check)
 * 3. Stripe webhook is source of truth (reads profile fields set by webhook)
 */
async function getUserPlanTier(
  supabase: SupabaseServiceClient,
  userId: string
): Promise<{ planTier: PlanTier; hasPremiumAccess: boolean }> {
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("free_premium_access, subscription_status, subscription_tier, trial_ends_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (!profile) {
      return { planTier: "free", hasPremiumAccess: false };
    }

    // INVARIANT: Admin free access (highest priority)
    if (profile.free_premium_access === true) {
      return { planTier: "admin_access", hasPremiumAccess: true };
    }

    // INVARIANT: Active paid subscription
    if (profile.subscription_status === "active") {
      const tier = normalizeTier(profile.subscription_tier);
      if (tier === "power") {
        return { planTier: tier, hasPremiumAccess: true };
      }
    }
    
    // INVARIANT: Past due (grace period - still has access)
    if (profile.subscription_status === "past_due") {
      return { planTier: "power", hasPremiumAccess: true };
    }

    // INVARIANT: Trial - MUST check expiration in real-time!
    // Never trust cached status alone - validate trial_ends_at
    if (profile.trial_ends_at) {
      const trialEnd = new Date(profile.trial_ends_at);
      const now = new Date();
      
      if (trialEnd > now) {
        // Trial still active
        return { planTier: "trial", hasPremiumAccess: true };
      }
      
      // INVARIANT 2: Expired trial = Free IMMEDIATELY (no grace)
      // Log for debugging race conditions
      console.log("[aiGuard] Trial expired, denying access", {
        userId,
        trialEnd: profile.trial_ends_at,
        now: now.toISOString(),
      });
    }

    return { planTier: "free", hasPremiumAccess: false };
  } catch (error) {
    console.error("Error fetching plan tier:", error);
    // FAIL CLOSED: on error, deny access
    return { planTier: "free", hasPremiumAccess: false };
  }
}

/**
 * Checks if user is an admin
 */
async function isUserAdmin(
  supabase: SupabaseServiceClient,
  userId: string
): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    return !!data;
  } catch {
    return false;
  }
}

/**
 * Main AI Guard function - validates auth, role, plan, and action permissions
 */
export async function aiGuard(
  req: Request,
  action: AiAction,
  supabaseUrl: string,
  supabaseServiceKey: string,
  scope: AiGuardScope = {},
): Promise<GuardResult> {
  // Create Supabase client with service role for admin access
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });

  // 1. Validate authentication
  const authHeader = req.headers.get("Authorization");
  const { user, error: authError } = await validateAuth(supabase, authHeader);

  if (authError || !user) {
    return {
      allowed: false,
      error: { error: authError || "Authentication required", code: "UNAUTHORIZED" },
      statusCode: 401,
    };
  }

  // 2. Get user's family role
  const familyId = scope.familyId?.trim();
  const familyAccess = await getUserFamilyRole(supabase, user.id, scope);

  if (familyAccess.error) {
    return {
      allowed: false,
      error: familyAccess.error,
      statusCode: familyAccess.statusCode || 403,
    };
  }

  const { profileId, role, isParent } = familyAccess;

  // 3. Get user's plan tier
  const { planTier, hasPremiumAccess } = await getUserPlanTier(supabase, user.id);

  // 4. Check if user is admin (admins bypass restrictions)
  const isAdmin = await isUserAdmin(supabase, user.id);

  const userContext: UserContext = {
    userId: user.id,
    profileId,
    familyId: familyId!,
    role,
    isParent: isParent || isAdmin,
    planTier: isAdmin ? "admin_access" : planTier,
    hasPremiumAccess: hasPremiumAccess || isAdmin,
  };

  // 5. Check action allowlist
  const actionConfig = ACTION_ALLOWLIST[action];
  
  if (!actionConfig) {
    return {
      allowed: false,
      error: { error: `Unknown action: ${action}`, code: "INVALID_ACTION" },
      statusCode: 400,
    };
  }

  // Admins bypass all restrictions
  if (isAdmin) {
    return { allowed: true, userContext };
  }

  // Check parent requirement
  if (actionConfig.requiresParent && !isParent) {
    return {
      allowed: false,
      error: { 
        error: "This action requires parent or guardian role in the specified family",
        code: "ROLE_REQUIRED" 
      },
      statusCode: 403,
    };
  }

  // Check premium requirement
  if (actionConfig.requiresPremium && !hasPremiumAccess) {
    return {
      allowed: false,
      error: { 
        error: "This action requires a Power subscription", 
        code: "PREMIUM_REQUIRED" 
      },
      statusCode: 403,
    };
  }

  return { allowed: true, userContext };
}

/**
 * Get plan limits for a user context
 */
export function getPlanLimits(userContext: UserContext): PlanLimits {
  return PLAN_LIMITS[userContext.planTier] || PLAN_LIMITS.free;
}

/**
 * Validate input length against plan limits
 */
export function validateInputLength(
  input: string,
  userContext: UserContext
): { valid: boolean; error?: { error: string; code: string } } {
  const limits = getPlanLimits(userContext);
  
  if (input.length > limits.maxInputChars) {
    return {
      valid: false,
      error: {
        error: `Input exceeds maximum length of ${limits.maxInputChars} characters for your plan`,
        code: "INPUT_TOO_LONG",
      },
    };
  }

  return { valid: true };
}

export { PLAN_LIMITS };
