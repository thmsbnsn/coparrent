const PAID_PRODUCT_IDS = new Set([
  "prod_TwwA5VNxPgt62D",
  "prod_Tpx49PIJ26wzPc",
  "prod_TnoLYRDnjKqtA8",
  "prod_TnoLKasOQOvLwL",
  "prod_Tf1Qq9jGVEyUOM",
  "prod_Tf1QUUhL8Tx1Ks",
]);

export const PAST_DUE_GRACE_PERIOD_DAYS = 7;
export const PAST_DUE_GRACE_PERIOD_MS = PAST_DUE_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;
export const SYSTEM_ACTOR_USER_ID = "00000000-0000-0000-0000-000000000000";
const KNOWN_STRIPE_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "past_due",
  "paused",
  "trialing",
  "unpaid",
]);

export type ProfileSubscriptionStatus =
  | "active"
  | "canceled"
  | "expired"
  | "none"
  | "past_due"
  | "trial";

export interface StripeProfileIdentity {
  id: string;
  user_id: string;
}

export interface StripeSubscriptionLike {
  cancel_at?: number | null;
  canceled_at?: number | null;
  created?: number | null;
  current_period_end?: number | null;
  id: string;
  metadata?: Record<string, string> | null;
  status: string;
  trial_end?: number | null;
}

export function getTierFromProductId(productId: string | null | undefined): "free" | "power" {
  if (!productId) {
    return "free";
  }

  return PAID_PRODUCT_IDS.has(productId) ? "power" : "free";
}

export function mapStripeSubscriptionStatus(stripeStatus: string): ProfileSubscriptionStatus {
  switch (stripeStatus) {
    case "active":
      return "active";
    case "trialing":
      return "trial";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    case "unpaid":
    case "paused":
      return "expired";
    case "incomplete":
      return "none";
    case "incomplete_expired":
      return "expired";
    default:
      return "none";
  }
}

export function isKnownStripeSubscriptionStatus(stripeStatus: string): boolean {
  return KNOWN_STRIPE_SUBSCRIPTION_STATUSES.has(stripeStatus);
}

export function stripeMetadataMatchesProfile(
  metadata: Record<string, string> | null | undefined,
  profile: StripeProfileIdentity,
): boolean {
  if (!metadata) {
    return false;
  }

  return metadata.profile_id === profile.id || metadata.user_id === profile.user_id;
}

function getStripeSubscriptionPriority(stripeStatus: string): number {
  switch (stripeStatus) {
    case "active":
      return 700;
    case "trialing":
      return 650;
    case "past_due":
      return 600;
    case "unpaid":
      return 500;
    case "incomplete":
      return 400;
    case "paused":
      return 300;
    case "canceled":
      return 200;
    case "incomplete_expired":
      return 100;
    default:
      return 0;
  }
}

function getStripeSubscriptionBoundaryTimestamp(subscription: StripeSubscriptionLike): number {
  return subscription.current_period_end ??
    subscription.trial_end ??
    subscription.cancel_at ??
    subscription.canceled_at ??
    subscription.created ??
    0;
}

export function selectAuthoritativeStripeSubscription<T extends StripeSubscriptionLike>(
  subscriptions: T[],
): T | null {
  if (!subscriptions.length) {
    return null;
  }

  return [...subscriptions].sort((left, right) => {
    const priorityDifference =
      getStripeSubscriptionPriority(right.status) - getStripeSubscriptionPriority(left.status);
    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    const boundaryDifference =
      getStripeSubscriptionBoundaryTimestamp(right) - getStripeSubscriptionBoundaryTimestamp(left);
    if (boundaryDifference !== 0) {
      return boundaryDifference;
    }

    const createdDifference = (right.created ?? 0) - (left.created ?? 0);
    if (createdDifference !== 0) {
      return createdDifference;
    }

    return right.id.localeCompare(left.id);
  })[0];
}

export function normalizeStripeTimestamp(timestamp: number | null | undefined): string | null {
  if (!timestamp || typeof timestamp !== "number") {
    return null;
  }

  return new Date(timestamp * 1000).toISOString();
}

export function isDateInFuture(
  value: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!value) {
    return false;
  }

  const candidate = value instanceof Date ? value : new Date(value);
  return Number.isFinite(candidate.getTime()) && candidate.getTime() > now.getTime();
}

export function isDateInPast(
  value: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!value) {
    return false;
  }

  const candidate = value instanceof Date ? value : new Date(value);
  return Number.isFinite(candidate.getTime()) && candidate.getTime() < now.getTime();
}

export function computeGraceUntil(now: Date = new Date()): string {
  return new Date(now.getTime() + PAST_DUE_GRACE_PERIOD_MS).toISOString();
}

export function resolvePastDueGraceUntil(
  currentAccessGraceUntil: string | null | undefined,
  now: Date = new Date(),
): string {
  const maxGraceUntil = new Date(now.getTime() + PAST_DUE_GRACE_PERIOD_MS);

  if (isDateInFuture(currentAccessGraceUntil, now)) {
    const existingGraceUntil = new Date(currentAccessGraceUntil as string);
    return existingGraceUntil.getTime() > maxGraceUntil.getTime()
      ? maxGraceUntil.toISOString()
      : existingGraceUntil.toISOString();
  }

  return maxGraceUntil.toISOString();
}

export function isGracePeriodActive(
  subscriptionStatus: string | null | undefined,
  accessGraceUntil: string | null | undefined,
  now: Date = new Date(),
): boolean {
  return subscriptionStatus === "past_due" && isDateInFuture(accessGraceUntil, now);
}
