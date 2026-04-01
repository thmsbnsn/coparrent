import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { strictCors, getCorsHeaders } from "../_shared/cors.ts";
import {
  getTierFromProductId,
  isDateInPast,
  isGracePeriodActive,
  isKnownStripeSubscriptionStatus,
  mapStripeSubscriptionStatus,
  normalizeStripeTimestamp,
  resolvePastDueGraceUntil,
  selectAuthoritativeStripeSubscription,
  stripeMetadataMatchesProfile,
  SYSTEM_ACTOR_USER_ID,
} from "../_shared/subscriptionBilling.ts";

interface ProfileRow {
  access_grace_until: string | null;
  access_reason: string | null;
  email: string | null;
  free_premium_access: boolean | null;
  id: string;
  stripe_customer_id: string | null;
  subscription_status: string | null;
  subscription_tier: string | null;
  trial_ends_at: string | null;
  trial_started_at: string | null;
  user_id: string;
}

type EffectiveTier = "free" | "power";
type StripeCustomerResolution =
  | "backfilled_from_customer_metadata"
  | "backfilled_from_subscription_metadata"
  | "linked_profile"
  | "missing_customer_link"
  | "no_authoritative_match";

interface SubscriptionAuditState {
  access_grace_until: string | null;
  stripe_customer_id: string | null;
  subscription_status: string | null;
  subscription_tier: string | null;
  trial_ends_at: string | null;
}

interface ResolvedStripeCustomer {
  customerId: string | null;
  profile: ProfileRow;
  resolution: StripeCustomerResolution;
}

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

const PROFILE_COLUMNS =
  "id, user_id, email, free_premium_access, access_reason, trial_started_at, trial_ends_at, subscription_status, subscription_tier, access_grace_until, stripe_customer_id";

function getProductId(
  product: string | Stripe.Product | Stripe.DeletedProduct | null | undefined,
): string | null {
  if (!product) {
    return null;
  }

  if (typeof product === "string") {
    return product;
  }

  if ("id" in product && typeof product.id === "string") {
    return product.id;
  }

  return null;
}

function normalizeStoredTier(tier: string | null | undefined): EffectiveTier {
  if (!tier) {
    return "free";
  }

  const normalized = tier.toLowerCase();
  return normalized === "power" || normalized === "premium" || normalized === "mvp"
    ? "power"
    : "free";
}

function getAuditState(profile: ProfileRow): SubscriptionAuditState {
  return {
    access_grace_until: profile.access_grace_until,
    stripe_customer_id: profile.stripe_customer_id,
    subscription_status: profile.subscription_status,
    subscription_tier: profile.subscription_tier,
    trial_ends_at: profile.trial_ends_at,
  };
}

function hasStateChanged(profile: ProfileRow, patch: Partial<ProfileRow>): boolean {
  return Object.entries(patch).some(([key, value]) => {
    return (profile as unknown as Record<string, unknown>)[key] !== value;
  });
}

function stripeMetadataHasOwnershipHints(
  metadata: Record<string, string> | null | undefined,
): boolean {
  return Boolean(
    metadata &&
    (typeof metadata.profile_id === "string" || typeof metadata.user_id === "string"),
  );
}

function stripeMetadataConflictsWithProfile(
  metadata: Record<string, string> | null | undefined,
  profile: ProfileRow,
): boolean {
  return stripeMetadataHasOwnershipHints(metadata) && !stripeMetadataMatchesProfile(metadata, profile);
}

function getEffectiveTier(profile: ProfileRow, now: Date = new Date()): EffectiveTier {
  if (profile.free_premium_access) {
    return "power";
  }

  if (profile.subscription_status === "trial") {
    return profile.trial_ends_at && !isDateInPast(profile.trial_ends_at, now) ? "power" : "free";
  }

  if (profile.subscription_status === "active") {
    return normalizeStoredTier(profile.subscription_tier);
  }

  if (profile.subscription_status === "past_due") {
    return isGracePeriodActive(profile.subscription_status, profile.access_grace_until, now)
      ? normalizeStoredTier(profile.subscription_tier)
      : "free";
  }

  return "free";
}

function buildResponse(
  profile: ProfileRow,
  options?: {
    subscriptionEnd?: string | null;
  },
) {
  const now = new Date();
  const effectiveTier = getEffectiveTier(profile, now);
  const trialActive =
    profile.subscription_status === "trial" &&
    Boolean(profile.trial_ends_at) &&
    !isDateInPast(profile.trial_ends_at, now);
  const graceActive = isGracePeriodActive(profile.subscription_status, profile.access_grace_until, now);

  return {
    access_grace_until: profile.access_grace_until,
    access_reason: profile.access_reason,
    free_access: Boolean(profile.free_premium_access),
    is_grace_period: graceActive,
    past_due: profile.subscription_status === "past_due",
    status: profile.subscription_status ?? "none",
    subscribed: profile.free_premium_access === true || effectiveTier === "power",
    subscription_end: options?.subscriptionEnd ?? null,
    subscription_status: profile.subscription_status ?? "none",
    tier: effectiveTier,
    trial: trialActive,
    trial_ends_at: trialActive ? profile.trial_ends_at : null,
  };
}

async function fetchProfile(
  supabaseClient: ReturnType<typeof createClient>,
  userId: string,
): Promise<ProfileRow | null> {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as ProfileRow | null) ?? null;
}

async function fetchProfileByStripeCustomerId(
  supabaseClient: ReturnType<typeof createClient>,
  stripeCustomerId: string,
): Promise<ProfileRow | null> {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as ProfileRow | null) ?? null;
}

async function insertAuditLog(
  supabaseClient: ReturnType<typeof createClient>,
  action: string,
  entityId: string,
  metadata: Record<string, unknown>,
  options?: {
    after?: SubscriptionAuditState;
    before?: SubscriptionAuditState;
  },
): Promise<void> {
  const { error } = await supabaseClient.from("audit_logs").insert({
    action,
    after: options?.after ?? null,
    actor_role_at_action: "system",
    actor_user_id: SYSTEM_ACTOR_USER_ID,
    before: options?.before ?? null,
    entity_id: entityId,
    entity_type: "subscription",
    metadata,
  });

  if (error) {
    logStep("Audit log insert failed", { action, error: error.message });
  }
}

async function updateProfileIfChanged(
  supabaseClient: ReturnType<typeof createClient>,
  profile: ProfileRow,
  patch: Partial<ProfileRow>,
  action: string,
  metadata: Record<string, unknown>,
): Promise<ProfileRow> {
  if (!hasStateChanged(profile, patch)) {
    return profile;
  }

  const before = getAuditState(profile);
  const { data: updatedProfile, error: updateError } = await supabaseClient
    .from("profiles")
    .update(patch)
    .eq("id", profile.id)
    .select(PROFILE_COLUMNS)
    .single();

  if (updateError) {
    throw updateError;
  }

  const nextProfile = updatedProfile as ProfileRow;
  await insertAuditLog(
    supabaseClient,
    action,
    nextProfile.id,
    {
      next_status: nextProfile.subscription_status ?? "none",
      next_tier: nextProfile.subscription_tier ?? "free",
      previous_status: profile.subscription_status ?? "none",
      previous_tier: profile.subscription_tier ?? "free",
      ...metadata,
    },
    {
      after: getAuditState(nextProfile),
      before,
    },
  );

  return nextProfile;
}

async function resolveStripeCustomer(
  supabaseClient: ReturnType<typeof createClient>,
  profile: ProfileRow,
  stripe: Stripe,
): Promise<ResolvedStripeCustomer> {
  if (profile.stripe_customer_id) {
    return {
      customerId: profile.stripe_customer_id,
      profile,
      resolution: "linked_profile",
    };
  }

  if (!profile.email) {
    return {
      customerId: null,
      profile,
      resolution: "missing_customer_link",
    };
  }

  const customers = await stripe.customers.list({ email: profile.email, limit: 10 });
  const authoritativeMatches = new Map<string, StripeCustomerResolution>();

  for (const customer of customers.data) {
    if (("deleted" in customer && customer.deleted) || typeof customer.id !== "string") {
      continue;
    }

    if (stripeMetadataMatchesProfile(customer.metadata ?? null, profile)) {
      authoritativeMatches.set(customer.id, "backfilled_from_customer_metadata");
      continue;
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      limit: 10,
      status: "all",
    });

    if (
      subscriptions.data.some((subscription) =>
        stripeMetadataMatchesProfile(subscription.metadata ?? null, profile)
      )
    ) {
      authoritativeMatches.set(customer.id, "backfilled_from_subscription_metadata");
    }
  }

  if (authoritativeMatches.size !== 1) {
    if (authoritativeMatches.size > 1) {
      logStep("Ambiguous Stripe customer resolution prevented backfill", {
        matchCount: authoritativeMatches.size,
        profileId: profile.id,
      });
    }

    return {
      customerId: null,
      profile,
      resolution: "no_authoritative_match",
    };
  }

  const [customerId, resolution] = authoritativeMatches.entries().next().value as [
    string,
    StripeCustomerResolution,
  ];
  const existingLinkedProfile = await fetchProfileByStripeCustomerId(supabaseClient, customerId);
  if (existingLinkedProfile && existingLinkedProfile.id !== profile.id) {
    logStep("Stripe customer id already linked to a different profile", {
      customerId,
      existingProfileId: existingLinkedProfile.id,
      profileId: profile.id,
    });

    return {
      customerId: null,
      profile,
      resolution: "no_authoritative_match",
    };
  }

  const updatedProfile = await updateProfileIfChanged(
    supabaseClient,
    profile,
    { stripe_customer_id: customerId },
    "SUBSCRIPTION_CUSTOMER_LINKED",
    {
      resolution,
      stripe_customer_id: customerId,
      user_id: profile.user_id,
    },
  );

  return {
    customerId,
    profile: updatedProfile,
    resolution,
  };
}

function buildPatchFromSelectedSubscription(
  profile: ProfileRow,
  subscription: Stripe.Subscription | null,
  now: Date,
): {
  patch: Partial<ProfileRow>;
  selectedStripeStatus: string | null;
  subscriptionEnd: string | null;
} {
  if (!subscription) {
    return {
      patch: {
        access_grace_until: null,
        subscription_status: "none",
        subscription_tier: "free",
        trial_ends_at: null,
      },
      selectedStripeStatus: null,
      subscriptionEnd: null,
    };
  }

  const internalStatus = mapStripeSubscriptionStatus(subscription.status);
  const productId = getProductId(subscription.items.data[0]?.price?.product);
  const paidTier = getTierFromProductId(productId);

  if (internalStatus === "trial") {
    return {
      patch: {
        access_grace_until: null,
        subscription_status: "trial",
        subscription_tier: paidTier,
        trial_ends_at: normalizeStripeTimestamp(subscription.trial_end),
      },
      selectedStripeStatus: subscription.status,
      subscriptionEnd: normalizeStripeTimestamp(subscription.current_period_end),
    };
  }

  if (internalStatus === "past_due") {
    return {
      patch: {
        access_grace_until: resolvePastDueGraceUntil(profile.access_grace_until, now),
        subscription_status: "past_due",
        subscription_tier: paidTier,
        trial_ends_at: null,
      },
      selectedStripeStatus: subscription.status,
      subscriptionEnd: normalizeStripeTimestamp(subscription.current_period_end),
    };
  }

  if (internalStatus === "active") {
    return {
      patch: {
        access_grace_until: null,
        subscription_status: "active",
        subscription_tier: paidTier,
        trial_ends_at: null,
      },
      selectedStripeStatus: subscription.status,
      subscriptionEnd: normalizeStripeTimestamp(subscription.current_period_end),
    };
  }

  return {
    patch: {
      access_grace_until: null,
      subscription_status: internalStatus,
      subscription_tier: "free",
      trial_ends_at: null,
    },
    selectedStripeStatus: subscription.status,
    subscriptionEnd: normalizeStripeTimestamp(subscription.current_period_end),
  };
}

async function applyStripeStateIfPresent(
  supabaseClient: ReturnType<typeof createClient>,
  profile: ProfileRow,
  stripe: Stripe,
): Promise<{ profile: ProfileRow; subscriptionEnd: string | null }> {
  const resolvedCustomer = await resolveStripeCustomer(supabaseClient, profile, stripe);
  profile = resolvedCustomer.profile;

  if (!resolvedCustomer.customerId) {
    logStep("Skipping Stripe sync without durable customer link", {
      profileId: profile.id,
      resolution: resolvedCustomer.resolution,
    });

    return { profile, subscriptionEnd: null };
  }

  const subscriptions = await stripe.subscriptions.list({
    customer: resolvedCustomer.customerId,
    limit: 20,
    status: "all",
  });
  const selectedSubscription = selectAuthoritativeStripeSubscription(subscriptions.data);

  if (
    selectedSubscription &&
    stripeMetadataConflictsWithProfile(selectedSubscription.metadata ?? null, profile)
  ) {
    await insertAuditLog(
      supabaseClient,
      "SUBSCRIPTION_CHECK_OWNERSHIP_MISMATCH",
      profile.id,
      {
        stripe_customer_id: resolvedCustomer.customerId,
        stripe_status: selectedSubscription.status,
        subscription_id: selectedSubscription.id,
      },
      {
        after: getAuditState(profile),
        before: getAuditState(profile),
      },
    );

    return { profile, subscriptionEnd: null };
  }

  if (selectedSubscription && !isKnownStripeSubscriptionStatus(selectedSubscription.status)) {
    await insertAuditLog(
      supabaseClient,
      "SUBSCRIPTION_CHECK_UNKNOWN_STRIPE_STATUS",
      profile.id,
      {
        stripe_customer_id: resolvedCustomer.customerId,
        stripe_status: selectedSubscription.status,
        subscription_id: selectedSubscription.id,
      },
      {
        after: getAuditState(profile),
        before: getAuditState(profile),
      },
    );
  }

  const now = new Date();
  const { patch, selectedStripeStatus, subscriptionEnd } = buildPatchFromSelectedSubscription(
    profile,
    selectedSubscription,
    now,
  );
  const updatedProfile = await updateProfileIfChanged(
    supabaseClient,
    profile,
    patch,
    "SUBSCRIPTION_CHECK_SYNC_STATE_CHANGED",
    {
      resolution: resolvedCustomer.resolution,
      stripe_customer_id: resolvedCustomer.customerId,
      stripe_status: selectedStripeStatus,
      subscription_count: subscriptions.data.length,
      subscription_id: selectedSubscription?.id ?? null,
      sync_reason: selectedSubscription ? "stripe_subscription_selected" : "no_subscriptions_found",
      user_id: profile.user_id,
    },
  );

  return {
    profile: updatedProfile,
    subscriptionEnd,
  };
}

serve(async (req) => {
  const corsResponse = strictCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(
        JSON.stringify({
          code: "SERVICE_UNAVAILABLE",
          error: "Subscription service temporarily unavailable",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 503 },
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          code: "AUTH_REQUIRED",
          error: "Authentication required",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 },
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({
          code: "AUTH_FAILED",
          error: "Authentication failed. Please sign in again.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 },
      );
    }

    const user = userData.user;
    let profile = await fetchProfile(supabaseClient, user.id);
    if (!profile) {
      return new Response(
        JSON.stringify({
          code: "PROFILE_NOT_FOUND",
          error: "Profile not found",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 },
      );
    }

    if (profile.free_premium_access === true) {
      if (profile.subscription_status !== "active" || normalizeStoredTier(profile.subscription_tier) !== "power") {
        const { data: updatedProfile, error: updateError } = await supabaseClient
          .from("profiles")
          .update({
            access_grace_until: null,
            subscription_status: "active",
            subscription_tier: "power",
          })
          .eq("id", profile.id)
          .select(PROFILE_COLUMNS)
          .single();

        if (updateError) {
          throw updateError;
        }

        profile = updatedProfile as ProfileRow;
      }

      return new Response(JSON.stringify(buildResponse(profile)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (profile.subscription_status === "trial" && profile.trial_ends_at && isDateInPast(profile.trial_ends_at)) {
      const before = getAuditState(profile);
      const previousTrialEndsAt = profile.trial_ends_at;
      const nowIso = new Date().toISOString();
      const { data: updatedProfile, error: downgradeError } = await supabaseClient
        .from("profiles")
        .update({
          access_grace_until: null,
          subscription_status: "expired",
          subscription_tier: "free",
        })
        .eq("id", profile.id)
        .eq("subscription_status", "trial")
        .lt("trial_ends_at", nowIso)
        .select(PROFILE_COLUMNS)
        .maybeSingle();

      if (downgradeError) {
        throw downgradeError;
      }

      if (updatedProfile) {
        profile = updatedProfile as ProfileRow;
        await insertAuditLog(
          supabaseClient,
          "TRIAL_EXPIRED_AUTO_DOWNGRADE",
          profile.id,
          {
            next_status: profile.subscription_status ?? "expired",
            next_tier: profile.subscription_tier ?? "free",
            previous_status: "trial",
            previous_tier: before.subscription_tier ?? "power",
            trial_ends_at: previousTrialEndsAt,
            user_id: user.id,
          },
          {
            after: getAuditState(profile),
            before,
          },
        );
      } else {
        const refreshedProfile = await fetchProfile(supabaseClient, user.id);
        if (refreshedProfile) {
          profile = refreshedProfile;
        }
      }

      return new Response(JSON.stringify(buildResponse(profile)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const { profile: syncedProfile, subscriptionEnd } = await applyStripeStateIfPresent(
      supabaseClient,
      profile,
      stripe,
    );

    return new Response(JSON.stringify(buildResponse(syncedProfile, { subscriptionEnd })), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    logStep("Unexpected error", {
      error: error instanceof Error ? error.message : String(error),
    });

    return new Response(
      JSON.stringify({
        code: "CHECK_FAILED",
        error: "Unable to check subscription status. Please try again.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
