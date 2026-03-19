/**
 * Centralized plan limits and feature gating
 * 
 * Plan structure:
 * - Free: Default, limited features
 * - Power: $5/month, full features including Expenses, Court Exports, Sports Hub
 */

export type PlanTier = "free" | "power";

export interface PlanLimits {
  maxKids: number;
  maxThirdPartyAccounts: number;
  maxParentAccounts: number;
  features: {
    expenses: boolean;
    courtExports: boolean;
    sportsHub: boolean;
    aiAssist: boolean;
    fullMessageHistory: boolean;
    unlimitedChildren: boolean;
  };
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    maxKids: 4,
    maxThirdPartyAccounts: 4,
    maxParentAccounts: 2,
    features: {
      expenses: false,
      courtExports: false,
      sportsHub: false,
      aiAssist: false,
      fullMessageHistory: false,
      unlimitedChildren: false,
    },
  },
  power: {
    maxKids: 6,
    maxThirdPartyAccounts: 6,
    maxParentAccounts: 2,
    features: {
      expenses: true,
      courtExports: true,
      sportsHub: true,
      aiAssist: true,
      fullMessageHistory: true,
      unlimitedChildren: true,
    },
  },
};

/**
 * Get plan limits for a given tier
 * Handles legacy tier names (premium, mvp) by mapping to power
 */
export function getPlanLimits(tier: string | null | undefined): PlanLimits {
  if (!tier || tier === "free") {
    return PLAN_LIMITS.free;
  }
  
  // Map legacy tiers to power
  if (tier === "premium" || tier === "mvp" || tier === "power") {
    return PLAN_LIMITS.power;
  }
  
  return PLAN_LIMITS.free;
}

/**
 * Normalize tier name from legacy values
 */
export function normalizeTier(tier: string | null | undefined): PlanTier {
  if (!tier || tier === "free") {
    return "free";
  }
  
  // Map legacy tiers to power
  if (tier === "premium" || tier === "mvp" || tier === "power") {
    return "power";
  }
  
  return "free";
}

/**
 * Check if a specific feature is available for a tier
 */
export function hasFeatureAccess(
  tier: string | null | undefined, 
  feature: keyof PlanLimits["features"]
): boolean {
  const limits = getPlanLimits(tier);
  return limits.features[feature];
}

/**
 * Get display name for a tier
 */
export function getTierDisplayName(tier: string | null | undefined): string {
  const normalized = normalizeTier(tier);
  return normalized === "power" ? "Power" : "Free";
}
