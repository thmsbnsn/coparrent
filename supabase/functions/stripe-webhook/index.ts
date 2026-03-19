import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { 
  checkIdempotency, 
  markEventProcessed, 
  markEventFailed 
} from "../_shared/webhookIdempotency.ts";

/**
 * Stripe Webhook Handler
 * 
 * BILLING INTEGRITY INVARIANTS:
 * 1. Webhook is source of truth for subscription state
 * 2. Events are processed exactly once (idempotency)
 * 3. Signature is verified before processing
 * 4. No sensitive data logged
 * 5. Safe logging only (no emails, tokens, etc.)
 */

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-08-27.basil",
});

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

// Safe logging - never log sensitive data
const logStep = (step: string, details?: Record<string, unknown>) => {
  // Filter out any sensitive fields
  const safeDetails = details ? Object.fromEntries(
    Object.entries(details).filter(([key]) => 
      !["email", "token", "key", "secret"].some(s => key.toLowerCase().includes(s))
    )
  ) : undefined;
  
  const detailsStr = safeDetails ? ` - ${JSON.stringify(safeDetails)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

// All products map to Power tier (the only paid tier)
// Includes legacy products for migration safety
const PRODUCT_TIERS: Record<string, string> = {
  // Current live Power product
  "prod_TwwA5VNxPgt62D": "Power",
  // Previous live Power product
  "prod_Tpx49PIJ26wzPc": "Power",
  // Legacy Live mode products (display as Power for migration)
  "prod_TnoLYRDnjKqtA8": "Power", // Old Premium
  "prod_TnoLKasOQOvLwL": "Power", // Old MVP
  // Legacy Test mode products
  "prod_Tf1Qq9jGVEyUOM": "Power", // Old Premium (test)
  "prod_Tf1QUUhL8Tx1Ks": "Power", // Old MVP (test)
};

// Database tier values (normalized to "power")
const TIER_DB_VALUES: Record<string, string> = {
  // Current live Power product
  "prod_TwwA5VNxPgt62D": "power",
  // Previous live Power product
  "prod_Tpx49PIJ26wzPc": "power",
  // Legacy products (all map to power)
  "prod_TnoLYRDnjKqtA8": "power",
  "prod_TnoLKasOQOvLwL": "power",
  "prod_Tf1Qq9jGVEyUOM": "power",
  "prod_Tf1QUUhL8Tx1Ks": "power",
};

type EmailType = "welcome" | "update" | "support" | "cancel";

const EMAIL_FROM: Record<EmailType, string> = {
  welcome: "CoParrent <hello@coparrent.com>",
  update: "CoParrent <noreply@coparrent.com>",
  support: "CoParrent <support@coparrent.com>",
  cancel: "CoParrent <hello@coparrent.com>",
};

async function sendEmail(to: string, subject: string, html: string, type: EmailType = "update") {
  if (!RESEND_API_KEY) {
    logStep("RESEND_API_KEY not configured, skipping email");
    return null;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: EMAIL_FROM[type],
        to: [to],
        subject,
        html,
      }),
    });

    const data = await response.json();
    logStep("Email sent", { subject, status: response.status });
    return data;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("Email send error", { errorType: typeof error });
    return null;
  }
}

/**
 * Update profile subscription state
 * 
 * INVARIANT: This is the ONLY place subscription state should be modified
 * (outside of admin tools). All changes come through webhooks.
 */
async function updateProfileSubscription(
  email: string,
  status: string,
  tier: string | null
) {
  logStep("Updating profile", { status, tier });
  
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      subscription_status: status,
      subscription_tier: tier,
    })
    .eq("email", email);

  if (error) {
    logStep("Error updating profile", { code: error.code });
    throw error;
  }
  
  logStep("Profile updated successfully");
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  logStep("Checkout completed", { sessionId: session.id });
  
  const customerEmail = session.customer_email || session.customer_details?.email;
  if (!customerEmail) {
    logStep("No customer email found");
    return;
  }

  if (session.subscription) {
    const subscription = await stripe.subscriptions.retrieve(
      session.subscription as string
    );
    const productId = subscription.items.data[0]?.price?.product as string;
    const tier = TIER_DB_VALUES[productId] || "power";
    const tierName = PRODUCT_TIERS[productId] || "Power";
    
    await updateProfileSubscription(customerEmail, "active", tier);

    await sendEmail(
      customerEmail,
      "Welcome to CoParrent Power! 🎉",
      `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #6366f1;">Welcome to CoParrent Power!</h1>
          <p>Thank you for subscribing to CoParrent. Your ${tierName} subscription is now active.</p>
          <p>You now have access to all Power features including:</p>
          <ul>
            <li>Expense tracking & reports</li>
            <li>Court-ready document exports</li>
            <li>Sports & events hub</li>
            <li>AI message assistance</li>
            <li>Up to 6 child profiles</li>
            <li>Up to 6 family member accounts</li>
          </ul>
          <p>If you have any questions, feel free to reach out to our support team at <a href="mailto:support@coparrent.com">support@coparrent.com</a>.</p>
          <p>Best regards,<br>The CoParrent Team</p>
        </div>
      `,
      "welcome"
    );
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  logStep("Subscription updated", { 
    subscriptionId: subscription.id, 
    status: subscription.status 
  });

  const customer = await stripe.customers.retrieve(
    subscription.customer as string
  );
  
  if (customer.deleted) {
    logStep("Customer was deleted");
    return;
  }

  const email = customer.email;
  if (!email) {
    logStep("No customer email found");
    return;
  }

  const productId = subscription.items.data[0]?.price?.product as string;
  const tier = TIER_DB_VALUES[productId] || "power";
  const tierName = PRODUCT_TIERS[productId] || "Power";
  
  let status = subscription.status;
  let shouldSendEmail = false;
  let emailSubject = "";
  let emailHtml = "";

  if (status === "active" || status === "trialing") {
    status = "active";
    shouldSendEmail = true;
    emailSubject = `Your CoParrent subscription is now active`;
    emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #6366f1;">Subscription Active!</h1>
        <p>Your CoParrent ${tierName} subscription is now active.</p>
        <p>Enjoy all your Power features! Thank you for being a valued member.</p>
        <p>Best regards,<br>The CoParrent Team</p>
      </div>
    `;
  } else if (status === "past_due") {
    status = "past_due";
    shouldSendEmail = true;
    emailSubject = "⚠️ Action Required: Payment Issue with Your CoParrent Subscription";
    emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #f59e0b;">Payment Issue</h1>
        <p>We were unable to process your latest payment for your CoParrent subscription.</p>
        <p>Please update your payment method to avoid service interruption.</p>
        <p>You can update your payment details by visiting your account settings.</p>
        <p>If you have any questions, please contact our support team.</p>
        <p>Best regards,<br>The CoParrent Team</p>
      </div>
    `;
  } else if (status === "canceled" || status === "unpaid") {
    status = "canceled";
  }

  await updateProfileSubscription(email, status, tier);

  if (shouldSendEmail) {
    const emailType: EmailType = status === "past_due" ? "support" : "update";
    await sendEmail(email, emailSubject, emailHtml, emailType);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  logStep("Subscription deleted", { subscriptionId: subscription.id });

  const customer = await stripe.customers.retrieve(
    subscription.customer as string
  );
  
  if (customer.deleted) {
    logStep("Customer was deleted");
    return;
  }

  const email = customer.email;
  if (!email) {
    logStep("No customer email found");
    return;
  }

  // On cancellation, revert to free tier
  // INVARIANT: Downgrade removes access immediately
  await updateProfileSubscription(email, "canceled", "free");

  await sendEmail(
    email,
    "Your CoParrent subscription has been canceled",
    `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #6366f1;">Subscription Canceled</h1>
        <p>Your CoParrent subscription has been canceled.</p>
        <p>We're sorry to see you go! Your Power features will remain active until the end of your current billing period.</p>
        <p>After that, you'll continue to have access to all Free features including:</p>
        <ul>
          <li>Up to 4 child profiles</li>
          <li>Custody calendar</li>
          <li>Messaging</li>
          <li>Document vault</li>
          <li>Photo gallery</li>
        </ul>
        <p>If you change your mind, you can resubscribe at any time from your account settings.</p>
        <p>We'd love to hear your feedback on how we can improve. Feel free to reach out to us at <a href="mailto:hello@coparrent.com">hello@coparrent.com</a>.</p>
        <p>Best regards,<br>The CoParrent Team</p>
      </div>
    `,
    "cancel"
  );
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  logStep("Invoice payment failed", { invoiceId: invoice.id });

  const customerEmail = invoice.customer_email;
  if (!customerEmail) {
    logStep("No customer email found");
    return;
  }

  // INVARIANT: Payment failure sets past_due, but user keeps access (grace period)
  await updateProfileSubscription(customerEmail, "past_due", "power");

  await sendEmail(
    customerEmail,
    "⚠️ Payment Failed - Action Required",
    `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #ef4444;">Payment Failed</h1>
        <p>We were unable to process your payment of $${((invoice.amount_due || 0) / 100).toFixed(2)} for your CoParrent subscription.</p>
        <p>Please update your payment method as soon as possible to avoid losing access to Power features.</p>
        <p>Common reasons for payment failure:</p>
        <ul>
          <li>Expired credit card</li>
          <li>Insufficient funds</li>
          <li>Card declined by your bank</li>
        </ul>
        <p>You can update your payment details by visiting your account settings and clicking "Manage Subscription".</p>
        <p>If you need assistance, please contact us at <a href="mailto:support@coparrent.com">support@coparrent.com</a>.</p>
        <p>Best regards,<br>The CoParrent Team</p>
      </div>
    `,
    "support"
  );
}

serve(async (req) => {
  // ============ STEP 1: Verify Signature ============
  // INVARIANT: Never process unverified webhooks
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
    const errorMessage = error instanceof Error ? error.message : "Unknown";
    logStep("Signature verification failed", { errorType: typeof error });
    return new Response("Invalid signature", { status: 400 });
  }
  
  logStep("Received event", { type: event.type, id: event.id });

  // ============ STEP 2: Check Idempotency ============
  // INVARIANT: Process each event exactly once
  const { shouldProcess, alreadyProcessed } = await checkIdempotency(
    event.id,
    event.type,
    supabaseUrl,
    supabaseServiceKey
  );
  
  if (!shouldProcess) {
    logStep("Event already processed, skipping", { id: event.id });
    return new Response(JSON.stringify({ received: true, skipped: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  }

  // ============ STEP 3: Process Event ============
  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        logStep("Unhandled event type", { type: event.type });
    }

    // ============ STEP 4: Mark as Processed ============
    await markEventProcessed(event.id, supabaseUrl, supabaseServiceKey, {
      outcome: "success",
    });

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("Webhook processing error", { errorType: typeof error });
    
    // Mark as failed for debugging
    await markEventFailed(event.id, supabaseUrl, supabaseServiceKey, errorMessage);
    
    // Still return 200 to prevent Stripe retries (we've logged the error)
    // This is intentional - failed events can be investigated via logs
    return new Response(JSON.stringify({ received: true, error: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  }
});
