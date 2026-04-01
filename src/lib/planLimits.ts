/**
 * Centralized plan limits and feature gating
 * 
 * Plan structure:
 * - Free: Default, limited features
 * - Power: $5/month, full features including Expenses, Court Exports, Sports Hub
 */

export type PlanTier = "free" | "power";
export type PlanSubscriptionStatus =
  | "active"
  | "canceled"
  | "expired"
  | "none"
  | "past_due"
  | "trial"
  | null
  | undefined;

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
export function isGracePeriodActive(
  subscriptionStatus: PlanSubscriptionStatus,
  accessGraceUntil?: string | Date | null,
  now: Date = new Date(),
): boolean {
  if (subscriptionStatus !== "past_due" || !accessGraceUntil) {
    return false;
  }

  const candidate = accessGraceUntil instanceof Date ? accessGraceUntil : new Date(accessGraceUntil);
  return Number.isFinite(candidate.getTime()) && candidate.getTime() > now.getTime();
}

export function getPlanLimits(
  tier: string | null | undefined,
  subscriptionStatus?: PlanSubscriptionStatus,
  accessGraceUntil?: string | Date | null,
  now: Date = new Date(),
): PlanLimits {
  return PLAN_LIMITS[normalizeTier(tier, subscriptionStatus, accessGraceUntil, now)];
}

/**
 * Normalize tier name from legacy values
 */
export function normalizeTier(
  tier: string | null | undefined,
  subscriptionStatus?: PlanSubscriptionStatus,
  accessGraceUntil?: string | Date | null,
  now: Date = new Date(),
): PlanTier {
  if (subscriptionStatus === "past_due") {
    return isGracePeriodActive(subscriptionStatus, accessGraceUntil, now) ? "power" : "free";
  }

  if (subscriptionStatus === "trial") {
    return "power";
  }

  if (subscriptionStatus === "active") {
    if (tier === "premium" || tier === "mvp" || tier === "power") {
      return "power";
    }
  }

  if (subscriptionStatus === "canceled" || subscriptionStatus === "expired" || subscriptionStatus === "none") {
    return "free";
  }

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
  subscriptionStatus: PlanSubscriptionStatus,
  feature: keyof PlanLimits["features"],
  accessGraceUntil?: string | Date | null,
  now: Date = new Date(),
): boolean {
  const limits = getPlanLimits(tier, subscriptionStatus, accessGraceUntil, now);
  return limits.features[feature];
}

/**
 * Get display name for a tier
 */
export function getTierDisplayName(tier: string | null | undefined): string {
  const normalized = normalizeTier(tier);
  return normalized === "power" ? "Power" : "Free";
}
