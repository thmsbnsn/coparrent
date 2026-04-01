import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  HttpError,
  type AuthenticatedProfile,
  type FamilyMemberRecord,
} from "./callHelpers.ts";
import {
  isDateInPast,
  isGracePeriodActive,
} from "./subscriptionBilling.ts";

const POWER_ENTITLEMENT_MESSAGE = "This feature requires a Power subscription.";
const POWER_TIERS = new Set(["power", "premium", "mvp"]);

type CourtExportSubscriptionProfile = {
  access_grace_until: string | null;
  free_premium_access: boolean | null;
  subscription_status: string | null;
  subscription_tier: string | null;
  trial_ends_at: string | null;
};

const normalizeStoredTier = (tier: string | null | undefined) => {
  const normalized = tier?.trim().toLowerCase();
  return normalized && POWER_TIERS.has(normalized) ? "power" : "free";
};

const hasPowerEntitlement = (
  profile: CourtExportSubscriptionProfile,
  now: Date = new Date(),
) => {
  if (profile.free_premium_access === true) {
    return true;
  }

  if (profile.subscription_status === "active") {
    return normalizeStoredTier(profile.subscription_tier) === "power";
  }

  if (profile.subscription_status === "past_due") {
    return normalizeStoredTier(profile.subscription_tier) === "power" &&
      isGracePeriodActive(
        profile.subscription_status,
        profile.access_grace_until,
        now,
      );
  }

  if (profile.subscription_status === "trial") {
    return Boolean(profile.trial_ends_at) && !isDateInPast(profile.trial_ends_at, now);
  }

  return false;
};

async function isUserAdmin(
  supabaseAdmin: SupabaseClient,
  profile: AuthenticatedProfile,
): Promise<boolean> {
  if (profile.account_role === "admin") {
    return true;
  }

  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", profile.user_id)
    .eq("role", "admin")
    .maybeSingle();

  if (error) {
    throw new HttpError(500, "Unable to verify export access.");
  }

  return Boolean(data);
}

export async function requireCourtExportPowerAccess(
  supabaseAdmin: SupabaseClient,
  profile: AuthenticatedProfile,
) {
  if (await isUserAdmin(supabaseAdmin, profile)) {
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(
      "free_premium_access, subscription_status, subscription_tier, trial_ends_at, access_grace_until",
    )
    .eq("user_id", profile.user_id)
    .maybeSingle();

  if (error || !data) {
    throw new HttpError(404, "Profile not found.");
  }

  if (!hasPowerEntitlement(data as CourtExportSubscriptionProfile)) {
    throw new HttpError(403, POWER_ENTITLEMENT_MESSAGE);
  }
}

export function requireFamilyCourtRecordExportRole(
  membership: FamilyMemberRecord,
) {
  if (membership.role === "parent" || membership.role === "guardian") {
    return;
  }

  throw new HttpError(
    403,
    "Only parents and guardians can export family court records.",
  );
}
