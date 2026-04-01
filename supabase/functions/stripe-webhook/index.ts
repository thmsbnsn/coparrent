import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  checkIdempotency,
  markEventFailed,
  markEventProcessed,
} from "../_shared/webhookIdempotency.ts";
import {
  getTierFromProductId,
  isKnownStripeSubscriptionStatus,
  mapStripeSubscriptionStatus,
  normalizeStripeTimestamp,
  resolvePastDueGraceUntil,
  SYSTEM_ACTOR_USER_ID,
} from "../_shared/subscriptionBilling.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-08-27.basil",
});

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

interface ProfileRow {
  access_grace_until: string | null;
  email: string | null;
  full_name: string | null;
  id: string;
  stripe_customer_id: string | null;
  subscription_status: string | null;
  subscription_tier: string | null;
  trial_ends_at: string | null;
  user_id: string;
}

interface HandlerResult {
  action: string;
  customerEmail?: string | null;
  entityId?: string | null;
  metadata: Record<string, unknown>;
  profile?: ProfileRow | null;
}

interface ProfilePatch {
  access_grace_until?: string | null;
  stripe_customer_id?: string | null;
  subscription_status?: string | null;
  subscription_tier?: string | null;
  trial_ends_at?: string | null;
}

type EmailType = "cancel" | "support" | "update" | "welcome";

const EMAIL_FROM: Record<EmailType, string> = {
  cancel: "CoParrent <hello@coparrent.com>",
  support: "CoParrent <support@coparrent.com>",
  update: "CoParrent <noreply@coparrent.com>",
  welcome: "CoParrent <hello@coparrent.com>",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const safeDetails = details
    ? Object.fromEntries(
        Object.entries(details).filter(
          ([key]) => !["email", "key", "secret", "token"].some((needle) => key.toLowerCase().includes(needle)),
        ),
      )
    : undefined;

  const detailsStr = safeDetails ? ` - ${JSON.stringify(safeDetails)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

const getProductId = (
  product: string | Stripe.Product | Stripe.DeletedProduct | null | undefined,
): string | null => {
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
};

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  type: EmailType = "update",
): Promise<void> {
  if (!RESEND_API_KEY) {
    logStep("RESEND_API_KEY not configured, skipping email");
    return;
  }

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM[type],
        html,
        subject,
        to: [to],
      }),
    });
  } catch (error) {
    logStep("Email send failed", {
      error: error instanceof Error ? error.message : String(error),
      subject,
    });
  }
}

async function fetchProfileByEmail(email: string): Promise<ProfileRow | null> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(
      "id, user_id, email, full_name, stripe_customer_id, subscription_status, subscription_tier, trial_ends_at, access_grace_until",
    )
    .eq("email", email)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as ProfileRow | null) ?? null;
}

async function fetchProfileByStripeCustomerId(customerId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(
      "id, user_id, email, full_name, stripe_customer_id, subscription_status, subscription_tier, trial_ends_at, access_grace_until",
    )
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as ProfileRow | null) ?? null;
}

async function fetchProfileByUserId(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(
      "id, user_id, email, full_name, stripe_customer_id, subscription_status, subscription_tier, trial_ends_at, access_grace_until",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as ProfileRow | null) ?? null;
}

async function fetchCustomerEmail(customerId: string): Promise<string | null> {
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) {
    return null;
  }

  return customer.email;
}

async function updateProfileSubscription(profileId: string, patch: ProfilePatch): Promise<void> {
  const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", profileId);

  if (error) {
    throw error;
  }
}

async function resolveProfileForStripeCustomer(
  customerId: string | null,
  options?: {
    customerEmail?: string | null;
    userId?: string | null;
  },
): Promise<ProfileRow | null> {
  if (customerId) {
    const linkedProfile = await fetchProfileByStripeCustomerId(customerId);
    if (linkedProfile) {
      return linkedProfile;
    }
  }

  if (options?.userId) {
    const profileByUserId = await fetchProfileByUserId(options.userId);
    if (profileByUserId) {
      if (customerId && profileByUserId.stripe_customer_id !== customerId) {
        await updateProfileSubscription(profileByUserId.id, { stripe_customer_id: customerId });
        return {
          ...profileByUserId,
          stripe_customer_id: customerId,
        };
      }

      return profileByUserId;
    }
  }

  if (options?.customerEmail) {
    const profileByEmail = await fetchProfileByEmail(options.customerEmail);
    if (profileByEmail && customerId && profileByEmail.stripe_customer_id !== customerId) {
      await updateProfileSubscription(profileByEmail.id, { stripe_customer_id: customerId });
      return {
        ...profileByEmail,
        stripe_customer_id: customerId,
      };
    }

    return profileByEmail;
  }

  return null;
}

async function insertAuditLog(
  action: string,
  entityId: string | null,
  metadata: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabaseAdmin.from("audit_logs").insert({
    action,
    actor_role_at_action: "system",
    actor_user_id: SYSTEM_ACTOR_USER_ID,
    entity_id: entityId,
    entity_type: "subscription",
    metadata,
  });

  if (error) {
    logStep("Audit log insert failed", {
      action,
      error: error.message,
    });
  }
}

async function insertTrialEndingNotification(
  profile: ProfileRow,
  subscription: Stripe.Subscription,
): Promise<void> {
  const trialEndsAt = normalizeStripeTimestamp(subscription.trial_end);
  const trialEndDate = trialEndsAt ? new Date(trialEndsAt) : null;
  const daysRemaining = trialEndDate
    ? Math.max(0, Math.ceil((trialEndDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : 0;

  const { error } = await supabaseAdmin.from("notifications").insert({
    message:
      daysRemaining === 0
        ? "Your CoParrent Power trial is ending soon. Add a payment method to keep Power access active."
        : `Your CoParrent Power trial ends in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}. Add a payment method to keep Power access active.`,
    related_id: subscription.id,
    title: "Trial ending soon",
    type: "trial_ending",
    user_id: profile.id,
  });

  if (error) {
    throw error;
  }
}

function buildSubscriptionPatchFromStripeState(
  profile: ProfileRow,
  subscription: Stripe.Subscription,
): ProfilePatch {
  const internalStatus = mapStripeSubscriptionStatus(subscription.status);
  const productId = getProductId(subscription.items.data[0]?.price?.product);
  const paidTier = getTierFromProductId(productId);

  if (internalStatus === "trial") {
    return {
      access_grace_until: null,
      subscription_status: "trial",
      subscription_tier: paidTier,
      trial_ends_at: normalizeStripeTimestamp(subscription.trial_end),
    };
  }

  if (internalStatus === "past_due") {
    return {
      access_grace_until: resolvePastDueGraceUntil(profile.access_grace_until),
      subscription_status: "past_due",
      subscription_tier: paidTier,
      trial_ends_at: null,
    };
  }

  if (internalStatus === "active") {
    return {
      access_grace_until: null,
      subscription_status: "active",
      subscription_tier: paidTier,
      trial_ends_at: null,
    };
  }

  return {
    access_grace_until: null,
    subscription_status: internalStatus,
    subscription_tier: "free",
    trial_ends_at: null,
  };
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<HandlerResult> {
  const customerId = typeof session.customer === "string" ? session.customer : null;
  const customerEmail = session.customer_email || session.customer_details?.email || null;
  const userId = typeof session.metadata?.user_id === "string" ? session.metadata.user_id : null;

  if (!session.subscription) {
    return {
      action: "SUBSCRIPTION_CHECKOUT_COMPLETED",
      customerEmail,
      entityId: typeof session.subscription === "string" ? session.subscription : session.id,
      metadata: {
        outcome: "skipped_missing_subscription",
        session_id: session.id,
      },
      profile: null,
    };
  }

  const profile = await resolveProfileForStripeCustomer(customerId, {
    customerEmail,
    userId,
  });
  if (!profile) {
    return {
      action: "SUBSCRIPTION_CHECKOUT_COMPLETED",
      customerEmail,
      entityId: typeof session.subscription === "string" ? session.subscription : session.id,
      metadata: {
        outcome: "profile_not_found",
        stripe_customer_id: customerId,
        session_id: session.id,
      },
      profile: null,
    };
  }

  const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
  const productId = getProductId(subscription.items.data[0]?.price?.product);
  const tier = getTierFromProductId(productId);
  const recipientEmail = customerEmail ?? profile.email;

  await updateProfileSubscription(profile.id, {
    access_grace_until: null,
    stripe_customer_id: customerId ?? profile.stripe_customer_id,
    subscription_status: "active",
    subscription_tier: tier,
    trial_ends_at: null,
  });

  if (recipientEmail) {
    await sendEmail(
      recipientEmail,
      "Welcome to CoParrent Power",
      `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1e3a5f;">Welcome to CoParrent Power</h1>
          <p>Your subscription is now active and your Power features are ready.</p>
          <p>You can now use expenses, court exports, Sports Hub, and the full Power toolkit.</p>
          <p>Best regards,<br>The CoParrent Team</p>
        </div>
      `,
      "welcome",
    );
  }

  return {
    action: "SUBSCRIPTION_CHECKOUT_COMPLETED",
    customerEmail,
    entityId: subscription.id,
    metadata: {
      outcome: "updated",
      session_id: session.id,
      stripe_customer_id: customerId,
      subscription_status: "active",
      subscription_tier: tier,
    },
    profile,
  };
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<HandlerResult> {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
  const customerEmail = customerId ? await fetchCustomerEmail(customerId) : null;
  const userId = typeof subscription.metadata?.user_id === "string" ? subscription.metadata.user_id : null;

  if (!customerId && !customerEmail) {
    return {
      action: "SUBSCRIPTION_STATUS_UPDATED",
      entityId: subscription.id,
      metadata: {
        outcome: "skipped_missing_customer_identity",
        stripe_status: subscription.status,
      },
      profile: null,
    };
  }

  const profile = await resolveProfileForStripeCustomer(customerId, {
    customerEmail,
    userId,
  });
  if (!profile) {
    return {
      action: "SUBSCRIPTION_STATUS_UPDATED",
      customerEmail,
      entityId: subscription.id,
      metadata: {
        outcome: "profile_not_found",
        stripe_customer_id: customerId,
        stripe_status: subscription.status,
      },
      profile: null,
    };
  }

  const patch = buildSubscriptionPatchFromStripeState(profile, subscription);
  const recipientEmail = customerEmail ?? profile.email;
  await updateProfileSubscription(profile.id, {
    ...patch,
    stripe_customer_id: customerId ?? profile.stripe_customer_id,
  });

  const nextStatus = patch.subscription_status ?? profile.subscription_status ?? "none";

  if (recipientEmail && nextStatus === "active" && profile.subscription_status !== "active") {
    await sendEmail(
      recipientEmail,
      "Your CoParrent subscription is active",
      `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1e3a5f;">Subscription active</h1>
          <p>Your CoParrent subscription is active and your Power access is current.</p>
          <p>Best regards,<br>The CoParrent Team</p>
        </div>
      `,
      "update",
    );
  }

  if (recipientEmail && nextStatus === "past_due" && profile.subscription_status !== "past_due") {
    await sendEmail(
      recipientEmail,
      "Payment issue with your CoParrent subscription",
      `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #b45309;">Payment issue</h1>
          <p>We were unable to process your latest subscription payment.</p>
          <p>Your Power access remains available during the retry grace period. Please update your payment method to avoid interruption.</p>
          <p>Best regards,<br>The CoParrent Team</p>
        </div>
      `,
      "support",
    );
  }

  return {
    action: "SUBSCRIPTION_STATUS_UPDATED",
    customerEmail,
    entityId: subscription.id,
    metadata: {
      access_grace_until: patch.access_grace_until ?? null,
      outcome: "updated",
      stripe_customer_id: customerId,
      subscription_status: nextStatus,
      subscription_tier: patch.subscription_tier ?? profile.subscription_tier ?? "free",
      stripe_status: subscription.status,
      stripe_status_known: isKnownStripeSubscriptionStatus(subscription.status),
      trial_ends_at: patch.trial_ends_at ?? null,
    },
    profile,
  };
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<HandlerResult> {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
  const customerEmail = customerId ? await fetchCustomerEmail(customerId) : null;
  const userId = typeof subscription.metadata?.user_id === "string" ? subscription.metadata.user_id : null;

  if (!customerId && !customerEmail) {
    return {
      action: "SUBSCRIPTION_CANCELED",
      entityId: subscription.id,
      metadata: {
        outcome: "skipped_missing_customer_identity",
      },
      profile: null,
    };
  }

  const profile = await resolveProfileForStripeCustomer(customerId, {
    customerEmail,
    userId,
  });
  if (!profile) {
    return {
      action: "SUBSCRIPTION_CANCELED",
      customerEmail,
      entityId: subscription.id,
      metadata: {
        outcome: "profile_not_found",
        stripe_customer_id: customerId,
      },
      profile: null,
    };
  }

  const wasTrialCancellation = profile.subscription_status === "trial";
  const recipientEmail = customerEmail ?? profile.email;

  await updateProfileSubscription(profile.id, {
    access_grace_until: null,
    stripe_customer_id: customerId ?? profile.stripe_customer_id,
    subscription_status: "canceled",
    subscription_tier: "free",
    trial_ends_at: null,
  });

  if (recipientEmail) {
    await sendEmail(
      recipientEmail,
      "Your CoParrent subscription has been canceled",
      `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1e3a5f;">Subscription canceled</h1>
          <p>Your CoParrent subscription has been canceled and your account has returned to the Free plan.</p>
          <p>You can resubscribe at any time from Settings.</p>
          <p>Best regards,<br>The CoParrent Team</p>
        </div>
      `,
      "cancel",
    );
  }

  return {
    action: "SUBSCRIPTION_CANCELED",
    customerEmail,
    entityId: subscription.id,
    metadata: {
      outcome: "updated",
      stripe_customer_id: customerId,
      subscription_status: "canceled",
      subscription_tier: "free",
      trial_cancellation: wasTrialCancellation,
      trial_ends_at_cleared: wasTrialCancellation,
    },
    profile,
  };
}

async function handlePaymentIssue(
  invoice: Stripe.Invoice,
  eventType: "invoice.payment_action_required" | "invoice.payment_failed",
): Promise<HandlerResult> {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
  const customerEmail =
    invoice.customer_email ||
    (customerId ? await fetchCustomerEmail(customerId) : null);

  if (!customerId && !customerEmail) {
    return {
      action: "SUBSCRIPTION_PAYMENT_FAILED",
      entityId: invoice.id,
      metadata: {
        event_type: eventType,
        outcome: "skipped_missing_customer_identity",
      },
      profile: null,
    };
  }

  const profile = await resolveProfileForStripeCustomer(customerId, {
    customerEmail,
  });
  if (!profile) {
    return {
      action: "SUBSCRIPTION_PAYMENT_FAILED",
      customerEmail,
      entityId: invoice.id,
      metadata: {
        event_type: eventType,
        outcome: "profile_not_found",
        stripe_customer_id: customerId,
      },
      profile: null,
    };
  }

  const graceUntil = resolvePastDueGraceUntil(profile.access_grace_until);
  const recipientEmail = customerEmail ?? profile.email;

  await updateProfileSubscription(profile.id, {
    access_grace_until: graceUntil,
    stripe_customer_id: customerId ?? profile.stripe_customer_id,
    subscription_status: "past_due",
    subscription_tier: profile.subscription_tier || "power",
    trial_ends_at: null,
  });

  if (recipientEmail && profile.subscription_status !== "past_due") {
    await sendEmail(
      recipientEmail,
      "Payment action needed for your CoParrent subscription",
      `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #b45309;">Payment action needed</h1>
          <p>We could not complete your latest subscription payment.</p>
          <p>Your Power access stays available during the retry grace period. Please update your payment method to avoid interruption.</p>
          <p>Best regards,<br>The CoParrent Team</p>
        </div>
      `,
      "support",
    );
  }

  return {
    action: "SUBSCRIPTION_PAYMENT_FAILED",
    customerEmail,
    entityId: invoice.id,
    metadata: {
      access_grace_until: graceUntil,
      amount_due: invoice.amount_due ?? null,
      event_type: eventType,
      outcome: "updated",
      stripe_customer_id: customerId,
      subscription_status: "past_due",
      subscription_tier: profile.subscription_tier || "power",
    },
    profile,
  };
}

async function handleTrialWillEnd(subscription: Stripe.Subscription): Promise<HandlerResult> {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
  const customerEmail = customerId ? await fetchCustomerEmail(customerId) : null;
  const userId = typeof subscription.metadata?.user_id === "string" ? subscription.metadata.user_id : null;

  if (!customerId && !customerEmail) {
    return {
      action: "SUBSCRIPTION_TRIAL_ENDING_NOTICE",
      entityId: subscription.id,
      metadata: {
        outcome: "skipped_missing_customer_identity",
      },
      profile: null,
    };
  }

  const profile = await resolveProfileForStripeCustomer(customerId, {
    customerEmail,
    userId,
  });
  if (!profile) {
    return {
      action: "SUBSCRIPTION_TRIAL_ENDING_NOTICE",
      customerEmail,
      entityId: subscription.id,
      metadata: {
        outcome: "profile_not_found",
        stripe_customer_id: customerId,
      },
      profile: null,
    };
  }

  await insertTrialEndingNotification(profile, subscription);

  const trialEndsAt = normalizeStripeTimestamp(subscription.trial_end);
  const daysRemaining = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : 0;

  return {
    action: "SUBSCRIPTION_TRIAL_ENDING_NOTICE",
    customerEmail,
    entityId: subscription.id,
    metadata: {
      days_remaining: daysRemaining,
      outcome: "notification_created",
      stripe_customer_id: customerId,
      trial_ends_at: trialEndsAt,
    },
    profile,
  };
}

async function logHandledEvent(
  event: Stripe.Event,
  result: HandlerResult,
): Promise<void> {
  await insertAuditLog(result.action, result.profile?.id ?? result.entityId ?? null, {
    ...result.metadata,
    profile_id: result.profile?.id ?? null,
    stripe_event_id: event.id,
    stripe_event_type: event.type,
  });
}

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!signature || !webhookSecret) {
    logStep("Missing signature or webhook secret");
    return new Response("Missing signature or webhook secret", { status: 400 });
  }

  let event: Stripe.Event;
  let body: string;

  try {
    body = await req.text();
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (error) {
    logStep("Signature verification failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return new Response("Invalid signature", { status: 400 });
  }

  logStep("Received event", { id: event.id, type: event.type });

  const { shouldProcess } = await checkIdempotency(
    event.id,
    event.type,
    supabaseUrl,
    supabaseServiceKey,
  );

  if (!shouldProcess) {
    return new Response(JSON.stringify({ received: true, skipped: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  }

  try {
    let result: HandlerResult;

    switch (event.type) {
      case "checkout.session.completed":
        result = await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.updated":
        result = await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        result = await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.trial_will_end":
        result = await handleTrialWillEnd(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_action_required":
        result = await handlePaymentIssue(
          event.data.object as Stripe.Invoice,
          "invoice.payment_action_required",
        );
        break;
      case "invoice.payment_failed":
        result = await handlePaymentIssue(
          event.data.object as Stripe.Invoice,
          "invoice.payment_failed",
        );
        break;
      default:
        result = {
          action: "STRIPE_WEBHOOK_EVENT_IGNORED",
          entityId: null,
          metadata: { outcome: "ignored_unhandled_event_type" },
          profile: null,
        };
        break;
    }

    await logHandledEvent(event, result);
    await markEventProcessed(event.id, supabaseUrl, supabaseServiceKey, {
      action: result.action,
      customer_email: result.customerEmail ?? null,
      outcome: result.metadata.outcome ?? "handled",
      stripe_event_type: event.type,
    });

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await insertAuditLog("STRIPE_WEBHOOK_PROCESSING_FAILED", null, {
      error: errorMessage,
      stripe_event_id: event.id,
      stripe_event_type: event.type,
    });

    await markEventFailed(event.id, supabaseUrl, supabaseServiceKey, errorMessage);

    return new Response(JSON.stringify({ error: true, received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  }
});
