import type { StripeTier } from "@/lib/stripe";

export interface SubscriptionStatus {
  accessGraceUntil: string | null;
  subscriptionStatus: string | null;
  subscribed: boolean;
  tier: StripeTier | "free";
  subscriptionEnd: string | null;
  freeAccess: boolean;
  accessReason: string | null;
  trial: boolean;
  trialEndsAt: string | null;
  pastDue: boolean;
  isGracePeriod: boolean;
}

export type SubscriptionSnapshot = Omit<SubscriptionStatus, "loading" | "error">;

export const FREE_SUBSCRIPTION_SNAPSHOT: SubscriptionSnapshot = {
  accessGraceUntil: null,
  accessReason: null,
  freeAccess: false,
  isGracePeriod: false,
  pastDue: false,
  subscribed: false,
  subscriptionEnd: null,
  subscriptionStatus: null,
  tier: "free",
  trial: false,
  trialEndsAt: null,
};

export function cloneSnapshot(snapshot: SubscriptionSnapshot): SubscriptionSnapshot {
  return { ...snapshot };
}

export function normalizeSubscriptionSnapshot(data: Record<string, unknown>): SubscriptionSnapshot {
  return {
    accessGraceUntil: typeof data.access_grace_until === "string" ? data.access_grace_until : null,
    accessReason: typeof data.access_reason === "string" ? data.access_reason : null,
    freeAccess: Boolean(data.free_access),
    isGracePeriod: Boolean(data.is_grace_period),
    pastDue: Boolean(data.past_due),
    subscribed: Boolean(data.subscribed || data.free_access),
    subscriptionEnd: typeof data.subscription_end === "string" ? data.subscription_end : null,
    subscriptionStatus:
      typeof data.subscription_status === "string"
        ? data.subscription_status
        : typeof data.status === "string"
          ? data.status
          : null,
    tier: ((data.tier as StripeTier | "free") || "free"),
    trial: Boolean(data.trial),
    trialEndsAt: typeof data.trial_ends_at === "string" ? data.trial_ends_at : null,
  };
}
