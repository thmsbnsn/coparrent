import assert from "node:assert/strict";
import {
  execFile as execFileCallback,
  spawn,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";

import { createClient } from "@supabase/supabase-js";
import { chromium, type BrowserContext, type Page } from "@playwright/test";

interface ProfileRow {
  id: string;
  user_id: string;
  email: string | null;
  subscription_status: string | null;
  subscription_tier: string | null;
  free_premium_access: boolean | null;
  access_reason: string | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
}

interface StripeCheckoutSessionResponse {
  id: string;
  url: string;
}

interface CheckSubscriptionResponse {
  subscribed?: boolean;
  tier?: string;
  free_access?: boolean;
  access_reason?: string | null;
  trial?: boolean;
  past_due?: boolean;
  error?: string;
}

interface CustomerPortalResponse {
  url?: string;
  error?: string;
  code?: string;
  action?: string;
}

interface VerificationReport {
  timestamp: string;
  environment: string;
  baseUrl: string;
  portalOrigin: string;
  testerEmail: string;
  checkoutSessionId: string;
  portalAction: string;
  profileAfterWebhook: {
    subscription_status: string | null;
    subscription_tier: string | null;
    free_premium_access: boolean | null;
  };
  checkSubscription: CheckSubscriptionResponse;
  notes: string[];
  screenshots: string[];
}

const DEFAULT_BASE_URL = "http://127.0.0.1:4174";
const DEFAULT_PORTAL_ORIGIN = "https://coparrent.com";
const DEFAULT_QA_PASSWORD = "StripeQa!234567";
const DEFAULT_QA_NAME = "Stripe Verification QA";
const QA_EMAIL_DOMAIN = "coparrent.test";
const SUPABASE_URL_KEY = "VITE_SUPABASE_URL";
const SUPABASE_ANON_KEY_KEY = "VITE_SUPABASE_PUBLISHABLE_KEY";
const SUPABASE_PROJECT_REF_KEY = "VITE_SUPABASE_PROJECT_ID";
const STRIPE_SECRET_ENV_KEYS = ["STRIPE_SECRET_KEY", "Stripe"] as const;
const LIVE_POWER_PRICE_ID = "price_1Sz2IZHpttmwwVs1H4deOgQe";
const execFile = promisify(execFileCallback);

function logStep(step: string, details?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const suffix = details ? ` ${JSON.stringify(details)}` : "";
  console.log(`[verify-stripe] ${timestamp} ${step}${suffix}`);
}

function stripWrappingQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

async function loadSimpleEnv(filePath: string): Promise<Record<string, string>> {
  try {
    const raw = await readFile(filePath, "utf8");
    const values: Record<string, string> = {};

    for (const rawLine of raw.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }

      const separatorIndex = line.indexOf("=");
      if (separatorIndex === -1) {
        continue;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = stripWrappingQuotes(line.slice(separatorIndex + 1).trim());
      if (!key || !value) {
        continue;
      }

      values[key] = value;
    }

    return values;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

function getConfigValue(name: string, envFileValues: Record<string, string>): string | undefined {
  return process.env[name] ?? envFileValues[name];
}

function getRequiredConfigValue(name: string, envFileValues: Record<string, string>): string {
  const value = getConfigValue(name, envFileValues);
  if (!value) {
    throw new Error(`Missing required configuration value: ${name}`);
  }

  return value;
}

function getRequiredConfigValueFromList(
  names: readonly string[],
  envFileValues: Record<string, string>,
): string {
  for (const name of names) {
    const value = getConfigValue(name, envFileValues);
    if (value) {
      return value;
    }
  }

  throw new Error(`Missing required configuration value. Expected one of: ${names.join(", ")}`);
}

function createSupabaseClient(url: string, key: string) {
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function createAuthenticatedClient(
  supabaseUrl: string,
  anonKey: string,
  email: string,
  password: string,
) {
  const client = createSupabaseClient(supabaseUrl, anonKey);
  const { data, error } = await client.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    throw new Error(`Unable to sign in as ${email}: ${error?.message ?? "missing session"}`);
  }

  return {
    client,
    session: data.session,
  };
}

function makeTimestampSlug(date = new Date()): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function buildQaEmail(): string {
  return `stripe-verification+${Date.now()}@${QA_EMAIL_DOMAIN}`;
}

function resolvePortalOrigin(
  baseUrl: string,
  envFileValues: Record<string, string>,
): string {
  const configuredOrigin = getConfigValue("STRIPE_VERIFICATION_PORTAL_ORIGIN", envFileValues);
  if (configuredOrigin) {
    return configuredOrigin;
  }

  const origin = new URL(baseUrl).origin;
  if (!/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(origin)) {
    return origin;
  }

  return DEFAULT_PORTAL_ORIGIN;
}

async function waitForHttpReady(url: string, timeoutMs = 60_000): Promise<void> {
  const startedAt = Date.now();

  for (;;) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until timeout.
    }

    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Timed out waiting for ${url} to respond`);
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
}

async function ensureLocalAppServer(
  repoRoot: string,
  baseUrl: string,
): Promise<ChildProcessWithoutNullStreams | null> {
  const healthUrl = new URL("/login", `${baseUrl}/`).toString();

  try {
    await waitForHttpReady(healthUrl, 2_000);
    return null;
  } catch {
    // Start a local dev server below.
  }

  const base = new URL(baseUrl);
  if (base.protocol !== "http:") {
    throw new Error(`Automatic local app startup only supports http:// origins. Received ${baseUrl}`);
  }

  const host = base.hostname;
  const port = base.port || "4174";
  const child = spawn(
    "cmd.exe",
    ["/d", "/s", "/c", `npm run dev -- --host ${host} --port ${port} --strictPort`],
    {
      cwd: repoRoot,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  let stderrBuffer = "";
  child.stderr.on("data", (chunk) => {
    stderrBuffer += chunk.toString();
  });

  try {
    await waitForHttpReady(healthUrl, 60_000);
  } catch (error) {
    child.kill("SIGTERM");
    throw new Error(
      `Unable to start the local app server: ${error instanceof Error ? error.message : String(error)}\n${stderrBuffer}`,
    );
  }

  return child;
}

function parseFirstJsonArray(raw: string): unknown[] {
  const startIndex = raw.indexOf("[");
  const endIndex = raw.lastIndexOf("]");

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error("Unable to locate JSON array in CLI output");
  }

  return JSON.parse(raw.slice(startIndex, endIndex + 1)) as unknown[];
}

async function resolveServiceRoleKey(
  repoRoot: string,
  projectRef: string,
  envFileValues: Record<string, string>,
): Promise<string> {
  const configured = getConfigValue("SUPABASE_SERVICE_ROLE_KEY", envFileValues);
  if (configured) {
    return configured;
  }

  const { stdout } = await execFile(
    "supabase",
    ["projects", "api-keys", "--project-ref", projectRef, "-o", "json"],
    {
      cwd: repoRoot,
      windowsHide: true,
    },
  );

  const apiKeys = parseFirstJsonArray(stdout) as Array<{
    api_key?: string;
    id?: string;
    name?: string;
  }>;
  const serviceRole = apiKeys.find((entry) => entry.id === "service_role" || entry.name === "service_role");
  if (!serviceRole?.api_key) {
    throw new Error("Unable to resolve the service_role API key from Supabase CLI output");
  }

  return serviceRole.api_key;
}

async function findAuthUserIdByEmail(
  adminClient: ReturnType<typeof createSupabaseClient>,
  email: string,
): Promise<string | null> {
  let page = 1;

  for (;;) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      throw error;
    }

    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (found) {
      return found.id;
    }

    if (data.users.length < 200) {
      return null;
    }

    page += 1;
  }
}

async function ensureQaUser(
  adminClient: ReturnType<typeof createSupabaseClient>,
  email: string,
  password: string,
): Promise<ProfileRow> {
  let userId = await findAuthUserIdByEmail(adminClient, email);

  if (!userId) {
    logStep("Creating QA auth user", { email });
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: DEFAULT_QA_NAME,
      },
    });

    if (error || !data.user) {
      throw new Error(`Unable to create QA auth user: ${error?.message ?? "missing user"}`);
    }

    userId = data.user.id;
  }

  const { data: existingProfile, error: profileLookupError } = await adminClient
    .from("profiles")
    .select("id, user_id, email, subscription_status, subscription_tier, free_premium_access, access_reason, trial_started_at, trial_ends_at")
    .eq("user_id", userId)
    .maybeSingle<ProfileRow>();

  if (profileLookupError) {
    throw new Error(`Unable to look up QA profile: ${profileLookupError.message}`);
  }

  if (!existingProfile) {
    const { error: insertError } = await adminClient.from("profiles").insert({
      user_id: userId,
      email,
      full_name: DEFAULT_QA_NAME,
      account_role: "parent",
      subscription_status: "none",
      subscription_tier: "free",
      free_premium_access: false,
      access_reason: null,
      trial_started_at: null,
      trial_ends_at: null,
    });

    if (insertError) {
      throw new Error(`Unable to create QA profile: ${insertError.message}`);
    }
  }

  const { error: resetError } = await adminClient
    .from("profiles")
    .update({
      email,
      full_name: DEFAULT_QA_NAME,
      account_role: "parent",
      subscription_status: "none",
      subscription_tier: "free",
      free_premium_access: false,
      access_reason: null,
      trial_started_at: null,
      trial_ends_at: null,
      co_parent_id: null,
    })
    .eq("user_id", userId);

  if (resetError) {
    throw new Error(`Unable to reset QA profile: ${resetError.message}`);
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, user_id, email, subscription_status, subscription_tier, free_premium_access, access_reason, trial_started_at, trial_ends_at")
    .eq("user_id", userId)
    .single<ProfileRow>();

  if (profileError || !profile) {
    throw new Error(`Unable to load reset QA profile: ${profileError?.message ?? "missing profile"}`);
  }

  return profile;
}

async function fetchProfile(
  adminClient: ReturnType<typeof createSupabaseClient>,
  email: string,
): Promise<ProfileRow> {
  const { data, error } = await adminClient
    .from("profiles")
    .select("id, user_id, email, subscription_status, subscription_tier, free_premium_access, access_reason, trial_started_at, trial_ends_at")
    .eq("email", email)
    .single<ProfileRow>();

  if (error || !data) {
    throw new Error(`Unable to load profile for ${email}: ${error?.message ?? "missing profile"}`);
  }

  return data;
}

async function pollForResult<T>(
  description: string,
  fn: () => Promise<T | null>,
  timeoutMs = 90_000,
  intervalMs = 2_000,
): Promise<T> {
  const startedAt = Date.now();

  for (;;) {
    const result = await fn();
    if (result) {
      return result;
    }

    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Timed out waiting for ${description}`);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

async function signInBrowser(page: Page, baseUrl: string, email: string, password: string): Promise<void> {
  logStep("Signing into local app", { email });
  await page.goto(new URL("/login", `${baseUrl}/`).toString(), { waitUntil: "domcontentloaded" });
  await page.locator("#email").waitFor({ state: "visible", timeout: 30_000 });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/dashboard|settings|pricing|onboarding/, { timeout: 30_000 });
}

async function createTrialCheckoutSession(
  stripeSecretKey: string,
  userEmail: string,
  userId: string,
  baseUrl: string,
): Promise<StripeCheckoutSessionResponse> {
  const body = new URLSearchParams();
  body.set("success_url", `${new URL("/settings?success=true", `${baseUrl}/`).toString()}`);
  body.set("cancel_url", `${new URL("/pricing?canceled=true", `${baseUrl}/`).toString()}`);
  body.set("mode", "subscription");
  body.set("customer_email", userEmail);
  body.set("line_items[0][price]", LIVE_POWER_PRICE_ID);
  body.set("line_items[0][quantity]", "1");
  body.set("metadata[user_id]", userId);
  body.set("subscription_data[metadata][user_id]", userId);
  body.set("subscription_data[trial_period_days]", "1");
  body.set("payment_method_collection", "if_required");

  logStep("Creating live no-charge trial checkout session", {
    email: userEmail,
    priceId: LIVE_POWER_PRICE_ID,
  });

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const json = await response.json() as { id?: string; url?: string; error?: { message?: string } };
  if (!response.ok || !json.id || !json.url) {
    throw new Error(`Unable to create Stripe checkout session: ${json.error?.message ?? response.statusText}`);
  }

  return {
    id: json.id,
    url: json.url,
  };
}

async function submitCheckout(page: Page): Promise<void> {
  logStep("Opening Stripe Checkout");
  await page.waitForLoadState("domcontentloaded");

  const namedButtonPatterns = [/start trial/i, /subscribe/i, /complete order/i, /continue/i];
  for (const pattern of namedButtonPatterns) {
    const button = page.getByRole("button", { name: pattern }).first();
    if (await button.count()) {
      try {
        await button.waitFor({ state: "visible", timeout: 5_000 });
        logStep("Submitting checkout with named button", { pattern: String(pattern) });
        await button.click();
        return;
      } catch {
        // Try the next candidate.
      }
    }
  }

  const submitButton = page.locator('button[type="submit"]').first();
  await submitButton.waitFor({ state: "visible", timeout: 15_000 });
  logStep("Submitting checkout with generic submit button");
  await submitButton.click();
}

async function waitForCheckoutSuccess(
  page: Page,
  baseUrl: string,
  screenshotPath: string,
): Promise<void> {
  await page.waitForURL((url) => {
    const parsed = new URL(url);
    return parsed.origin === new URL(baseUrl).origin && parsed.pathname === "/settings" && parsed.searchParams.get("success") === "true";
  }, { timeout: 60_000 });
  await page.screenshot({ path: screenshotPath, fullPage: true });
}

async function pollProfileForWebhookSuccess(
  adminClient: ReturnType<typeof createSupabaseClient>,
  email: string,
): Promise<ProfileRow> {
  return pollForResult("Stripe webhook to mark the QA profile active", async () => {
    const profile = await fetchProfile(adminClient, email);
    if (
      profile.subscription_status === "active" &&
      profile.subscription_tier === "power" &&
      profile.free_premium_access === false
    ) {
      return profile;
    }

    return null;
  });
}

async function invokeSupabaseFunctionJson<T>(
  supabaseUrl: string,
  anonKey: string,
  functionName: string,
  accessToken: string,
  origin: string | null,
  body?: Record<string, unknown>,
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    apikey: anonKey,
    "Content-Type": "application/json",
  };

  if (origin) {
    headers.Origin = origin;
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body ?? {}),
  });

  const json = await response.json() as T;
  if (!response.ok) {
    throw new Error(`Function ${functionName} failed with ${response.status}: ${JSON.stringify(json)}`);
  }

  return json;
}

async function openPortalAndPerformSafeAction(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  portalUrl: string,
  beforeScreenshotPath: string,
  afterScreenshotPath: string,
): Promise<string> {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1200 },
    serviceWorkers: "block",
  });
  const page = await context.newPage();

  try {
    logStep("Opening Stripe customer portal");
    await page.goto(portalUrl, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
    await page.screenshot({ path: beforeScreenshotPath, fullPage: true });

    const preferredPatterns = [
      /manage subscription/i,
      /subscription details/i,
      /view details/i,
      /billing history/i,
      /view invoices/i,
      /payment methods/i,
      /update information/i,
      /return to/i,
    ];

    for (const pattern of preferredPatterns) {
      for (const role of ["button", "link"] as const) {
        const locator = page.getByRole(role, { name: pattern }).first();
        if (await locator.count()) {
          try {
            await locator.waitFor({ state: "visible", timeout: 5_000 });
            const label = (await locator.textContent())?.trim() || String(pattern);
            logStep("Performing portal action", { label });
            await locator.click();
            await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
            await page.screenshot({ path: afterScreenshotPath, fullPage: true });
            return label;
          } catch {
            // Try the next candidate.
          }
        }
      }
    }

    throw new Error("Unable to find a safe customer-portal action to perform");
  } finally {
    await context.close();
  }
}

async function run(): Promise<void> {
  const repoRoot = process.cwd();
  const envFileValues = await loadSimpleEnv(path.join(repoRoot, ".env"));
  const baseUrl = getConfigValue("STRIPE_VERIFICATION_BASE_URL", envFileValues) ?? DEFAULT_BASE_URL;
  const portalOrigin = resolvePortalOrigin(baseUrl, envFileValues);
  const qaPassword = getConfigValue("STRIPE_VERIFICATION_QA_PASSWORD", envFileValues) ?? DEFAULT_QA_PASSWORD;
  const supabaseUrl = getRequiredConfigValue(SUPABASE_URL_KEY, envFileValues);
  const anonKey = getRequiredConfigValue(SUPABASE_ANON_KEY_KEY, envFileValues);
  const projectRef = getRequiredConfigValue(SUPABASE_PROJECT_REF_KEY, envFileValues);
  const stripeSecretKey = getRequiredConfigValueFromList(STRIPE_SECRET_ENV_KEYS, envFileValues);

  const serviceRoleKey = await resolveServiceRoleKey(repoRoot, projectRef, envFileValues);
  const adminClient = createSupabaseClient(supabaseUrl, serviceRoleKey);
  const qaEmail = buildQaEmail();

  const artifactDir = path.join(repoRoot, "docs", "acquisition", "diligence", "evidence");
  await mkdir(artifactDir, { recursive: true });
  const timestamp = makeTimestampSlug();
  const checkoutScreenshot = path.join(artifactDir, `stripe-verification-${timestamp}-checkout-success.png`);
  const portalScreenshot = path.join(artifactDir, `stripe-verification-${timestamp}-portal.png`);
  const portalAfterScreenshot = path.join(artifactDir, `stripe-verification-${timestamp}-portal-after-action.png`);
  const reportPath = path.join(artifactDir, `stripe-verification-${timestamp}-report.json`);

  const localServer = await ensureLocalAppServer(repoRoot, baseUrl);
  const browser = await chromium.launch({ headless: true });

  try {
    const qaProfile = await ensureQaUser(adminClient, qaEmail, qaPassword);
    const qaAuth = await createAuthenticatedClient(supabaseUrl, anonKey, qaEmail, qaPassword);
    const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

    try {
      await signInBrowser(page, baseUrl, qaEmail, qaPassword);

      const checkoutSession = await createTrialCheckoutSession(
        stripeSecretKey,
        qaEmail,
        qaProfile.user_id,
        baseUrl,
      );

      logStep("Navigating to checkout session", { checkoutSessionId: checkoutSession.id });
      await page.goto(checkoutSession.url, { waitUntil: "domcontentloaded" });
      await submitCheckout(page);
      await waitForCheckoutSuccess(page, baseUrl, checkoutScreenshot);

      logStep("Waiting for webhook-driven profile update");
      const profileAfterWebhook = await pollProfileForWebhookSuccess(adminClient, qaEmail);

      logStep("Checking subscription gate source");
      const checkSubscription = await invokeSupabaseFunctionJson<CheckSubscriptionResponse>(
        supabaseUrl,
        anonKey,
        "check-subscription",
        qaAuth.session.access_token,
        null,
      );

      assert.equal(checkSubscription.subscribed, true, "check-subscription did not report subscribed access");
      assert.equal(checkSubscription.tier, "power", "check-subscription did not report the power tier");
      assert.notEqual(checkSubscription.free_access, true, "check-subscription unexpectedly reported free access");

      logStep("Opening customer portal function");
      const portalResponse = await invokeSupabaseFunctionJson<CustomerPortalResponse>(
        supabaseUrl,
        anonKey,
        "customer-portal",
        qaAuth.session.access_token,
        portalOrigin,
      );

      if (!portalResponse.url) {
        throw new Error(portalResponse.error || "Customer portal did not return a URL");
      }

      const portalAction = await openPortalAndPerformSafeAction(
        browser,
        portalResponse.url,
        portalScreenshot,
        portalAfterScreenshot,
      );

      const report: VerificationReport = {
        timestamp,
        environment: "Local current client against live Stripe and production Supabase backend",
        baseUrl,
        portalOrigin,
        testerEmail: qaEmail,
        checkoutSessionId: checkoutSession.id,
        portalAction,
        profileAfterWebhook: {
          subscription_status: profileAfterWebhook.subscription_status,
          subscription_tier: profileAfterWebhook.subscription_tier,
          free_premium_access: profileAfterWebhook.free_premium_access,
        },
        checkSubscription,
        notes: [
          "The production Stripe integration is on live keys, so a Stripe test card would not work here.",
          "This verification therefore used a no-charge 1-day live trial Checkout Session with payment_method_collection=if_required to exercise the real checkout, webhook, and portal paths without creating an immediate charge.",
          `The customer-portal function was invoked with the allowed origin ${portalOrigin} because production CORS intentionally blocks localhost origins.`,
        ],
        screenshots: [checkoutScreenshot, portalScreenshot, portalAfterScreenshot],
      };

      await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

      logStep("Stripe verification succeeded", {
        reportPath,
        portalAction,
        testerEmail: qaEmail,
      });
    } finally {
      await page.close();
    }
  } finally {
    await browser.close();
    localServer?.kill("SIGTERM");
  }
}

run().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(`[verify-stripe] FAILED\n${message}`);
  process.exitCode = 1;
});
