import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";

import { chromium, type BrowserContext, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

interface TesterAccount {
  label: string;
  email: string;
  password: string;
}

interface BrowserCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "Strict" | "Lax" | "None";
}

interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  platform: string | null;
  user_agent: string | null;
  updated_at: string;
  revoked_at: string | null;
}

type PushPlatform = "desktop-browser" | "desktop-pwa" | "android-pwa" | "ios-pwa";
type ScenarioStatus = "passed" | "blocked" | "pending_manual_confirmation";

interface ScenarioResult {
  platform: PushPlatform;
  status: ScenarioStatus;
  startedAt: string;
  completedAt: string;
  subscriptionIds: string[];
  screenshotPath?: string;
  notes: string[];
  details: Record<string, unknown>;
}

interface VerificationReport {
  timestamp: string;
  baseUrl: string;
  environment: string;
  helpUrls: {
    diagnostics: string;
    manualChecklist: string;
    notificationSettings: string;
  };
  testerLabel: string;
  testerEmail: string;
  scenarios: ScenarioResult[];
}

const SUPABASE_URL_KEY = "VITE_SUPABASE_URL";
const SUPABASE_ANON_KEY_KEY = "VITE_SUPABASE_PUBLISHABLE_KEY";
const SUPABASE_PROJECT_REF_KEY = "VITE_SUPABASE_PROJECT_ID";
const DEFAULT_TESTER_LABEL = "Parent A";
const MANUAL_CHECKLIST_PATH = "docs/project/PUSH_PWA_DEVICE_VALIDATION_CHECKLIST.md";
const execFile = promisify(execFileCallback);

function logStep(step: string, details?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const suffix = details ? ` ${JSON.stringify(details)}` : "";
  console.log(`[verify-push-pwa] ${timestamp} ${step}${suffix}`);
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

async function loadTesterAccounts(filePath: string): Promise<Map<string, TesterAccount>> {
  const raw = await readFile(filePath, "utf8");
  const lines = raw.split(/\r?\n/);
  const accounts = new Map<string, TesterAccount>();
  let current: TesterAccount | null = null;

  for (const line of lines) {
    const sectionMatch = line.match(/^##\s+(.+)$/);
    if (sectionMatch) {
      if (current?.email && current.password) {
        accounts.set(current.label, current);
      }

      current = {
        label: sectionMatch[1].trim(),
        email: "",
        password: "",
      };
      continue;
    }

    if (!current) {
      continue;
    }

    const fieldMatch = line.match(/^- ([a-z_]+):\s+`([^`]+)`$/i);
    if (!fieldMatch) {
      continue;
    }

    const [, key, value] = fieldMatch;
    if (key === "email") current.email = value;
    if (key === "password") current.password = value;
  }

  if (current?.email && current.password) {
    accounts.set(current.label, current);
  }

  return accounts;
}

function makeTimestampSlug(date = new Date()): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
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

  const { stdout } = await execFile("supabase", [
    "projects",
    "api-keys",
    "--project-ref",
    projectRef,
    "-o",
    "json",
  ], {
    cwd: repoRoot,
    windowsHide: true,
  });

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

async function resolveDefaultBaseUrl(repoRoot: string): Promise<string> {
  const { stdout } = process.platform === "win32"
    ? await execFile("cmd.exe", ["/d", "/s", "/c", "vercel list"], {
        cwd: repoRoot,
        windowsHide: true,
      })
    : await execFile("vercel", ["list"], {
        cwd: repoRoot,
        windowsHide: true,
      });

  const deploymentUrl = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith("https://") && line.includes(".vercel.app"));

  if (!deploymentUrl) {
    throw new Error("Unable to resolve a default deployed Vercel URL");
  }

  return deploymentUrl;
}

function createSupabaseClient(url: string, key: string) {
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

async function createAuthenticatedClient(
  url: string,
  anonKey: string,
  email: string,
  password: string,
) {
  const client = createSupabaseClient(url, anonKey);
  const { data, error } = await client.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    throw new Error(`Unable to sign in as ${email}: ${error?.message ?? "missing session"}`);
  }

  return {
    client,
    session: data.session,
  };
}

async function loadBrowserCookies(filePath: string): Promise<BrowserCookie[]> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as BrowserCookie[];
}

async function createBrowserContext(headless: boolean): Promise<BrowserContext> {
  const browser = await chromium.launch({ headless });
  return browser.newContext({
    viewport: { width: 1440, height: 1100 },
  });
}

async function dismissBlockingPrompts(page: Page): Promise<void> {
  const dismissibleButtons = [
    page.getByRole("button", { name: /not now/i }),
  ];

  for (const button of dismissibleButtons) {
    if (await button.isVisible().catch(() => false)) {
      await button.click({ force: true });
      await page.waitForTimeout(300);
    }
  }
}

async function bootstrapAuthenticatedApp(page: Page, baseUrl: string): Promise<void> {
  const rootUrl = new URL("/", `${baseUrl}/`).toString();
  logStep("Bootstrapping authenticated app session", { rootUrl });
  await page.goto(rootUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await dismissBlockingPrompts(page);

  if (page.url().includes("vercel.com/login")) {
    throw new Error("VERCEL_AUTH_REQUIRED");
  }
}

async function pollFor<T>(
  label: string,
  fn: () => Promise<T | null>,
  timeoutMs = 30_000,
  intervalMs = 1_000,
): Promise<T> {
  const startedAt = Date.now();

  for (;;) {
    const value = await fn();
    if (value !== null) {
      return value;
    }

    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Timed out waiting for ${label}`);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

function platformDisplayName(platform: PushPlatform): string {
  switch (platform) {
    case "android-pwa":
      return "Android";
    case "ios-pwa":
      return "iOS PWA";
    case "desktop-browser":
      return "Desktop";
    case "desktop-pwa":
      return "Desktop PWA";
  }
}

function getScenarioFollowUp(
  scenario: ScenarioResult,
  helpUrls: VerificationReport["helpUrls"],
): string[] {
  const baseSteps = [
    `Open ${helpUrls.notificationSettings} on the target device to confirm notifications are enabled.`,
    `Open ${helpUrls.diagnostics} on the same device/session and capture the current diagnostics state.`,
  ];

  if (scenario.status === "passed") {
    return [
      "Capture the received notification plus the diagnostics page for the same desktop session.",
      "Attach the JSON report and markdown summary from this verifier run to the evidence package.",
    ];
  }

  if (scenario.status === "pending_manual_confirmation") {
    return [
      ...baseSteps,
      "Confirm the physical device received the targeted push notification and record whether tapping it opened the expected route.",
      "Attach the JSON report and markdown summary from this verifier run to the evidence package.",
    ];
  }

  if (scenario.details.reason === "missing_subscription") {
    return [
      ...baseSteps,
      "Subscribe on the physical device first, then rerun this verifier so the platform-specific push can be targeted.",
      `Use ${helpUrls.manualChecklist} for the exact device-specific evidence set before marking the pass complete.`,
    ];
  }

  return [
    ...baseSteps,
    "Resolve the blocker noted below, then rerun the verifier before treating the platform as ready.",
    `Use ${helpUrls.manualChecklist} for the exact device-specific evidence set before marking the pass complete.`,
  ];
}

function buildMarkdownSummary(
  report: VerificationReport,
  jsonReportPath: string,
): string {
  const lines = [
    "# Push/PWA Verification Summary",
    "",
    `- Timestamp: ${report.timestamp}`,
    `- Base URL: ${report.baseUrl}`,
    `- Environment: ${report.environment}`,
    `- Tester: ${report.testerLabel} (${report.testerEmail})`,
    `- JSON report: ${jsonReportPath}`,
    `- Manual checklist: ${report.helpUrls.manualChecklist}`,
    `- Notification settings route: ${report.helpUrls.notificationSettings}`,
    `- Diagnostics route: ${report.helpUrls.diagnostics}`,
    "",
    "This summary is a verifier artifact, not proof that physical-device validation is complete.",
    "A platform is only complete once a real device receives the notification and the evidence set is captured.",
    "",
    "## Scenario Results",
  ];

  for (const scenario of report.scenarios) {
    lines.push("");
    lines.push(`### ${platformDisplayName(scenario.platform)}`);
    lines.push(`- Status: ${scenario.status}`);
    lines.push(`- Started: ${scenario.startedAt}`);
    lines.push(`- Completed: ${scenario.completedAt}`);

    if (scenario.subscriptionIds.length > 0) {
      lines.push(`- Subscription IDs: ${scenario.subscriptionIds.join(", ")}`);
    }

    if (scenario.screenshotPath) {
      lines.push(`- Screenshot: ${scenario.screenshotPath}`);
    }

    for (const note of scenario.notes) {
      lines.push(`- Note: ${note}`);
    }

    const detailEntries = Object.entries(scenario.details);
    if (detailEntries.length > 0) {
      lines.push("- Details:");
      for (const [key, value] of detailEntries) {
        lines.push(`  - ${key}: ${JSON.stringify(value)}`);
      }
    }

    lines.push("- Follow-up:");
    for (const step of getScenarioFollowUp(scenario, report.helpUrls)) {
      lines.push(`  - ${step}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

async function fetchProfileId(adminClient: ReturnType<typeof createSupabaseClient>, userId: string): Promise<string> {
  const { data, error } = await adminClient
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle<{ id: string }>();

  if (error || !data?.id) {
    throw new Error(`Unable to resolve profile for user ${userId}`);
  }

  return data.id;
}

async function verifyDesktopScenario(params: {
  baseUrl: string;
  page: Page;
  testerClient: Awaited<ReturnType<typeof createAuthenticatedClient>>["client"];
  adminClient: ReturnType<typeof createSupabaseClient>;
  profileId: string;
  vapidPublicKey: string;
  artifactDir: string;
  timestamp: string;
}): Promise<ScenarioResult> {
  const {
    baseUrl,
    page,
    testerClient,
    adminClient,
    profileId,
    vapidPublicKey,
    artifactDir,
    timestamp,
  } = params;

  const startedAt = new Date().toISOString();
  await bootstrapAuthenticatedApp(page, baseUrl);

  await page.goto(new URL("/dashboard/notifications", `${baseUrl}/`).toString(), { waitUntil: "domcontentloaded" });
  await dismissBlockingPrompts(page);
  await page.waitForTimeout(1500);

  const subscriptionJson = await page.evaluate(async (publicKey) => {
    const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
      const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
      const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);

      for (let index = 0; index < rawData.length; index += 1) {
        outputArray[index] = rawData.charCodeAt(index);
      }

      return outputArray;
    };

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      throw new Error("PushManager is not available in this browser context");
    }

    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    return JSON.parse(JSON.stringify(subscription));
  }, vapidPublicKey) as {
    endpoint?: string;
    keys?: {
      p256dh?: string;
      auth?: string;
    };
  };

  assert.ok(subscriptionJson.endpoint, "Desktop push subscription was missing an endpoint");
  assert.ok(subscriptionJson.keys?.p256dh, "Desktop push subscription was missing p256dh");
  assert.ok(subscriptionJson.keys?.auth, "Desktop push subscription was missing auth");

  const syncResponse = await testerClient.functions.invoke("sync-push-subscription", {
    body: {
      action: "upsert",
      endpoint: subscriptionJson.endpoint,
      keys: subscriptionJson.keys,
      platform: "desktop-browser",
      userAgent: "Playwright Chromium desktop verifier",
    },
  });

  if (syncResponse.error || !syncResponse.data?.subscription?.id) {
    throw new Error(`Unable to sync desktop push subscription: ${syncResponse.error?.message ?? JSON.stringify(syncResponse.data)}`);
  }

  const subscriptionId = syncResponse.data.subscription.id as string;

  const persistedSubscription = await pollFor(
    "persisted desktop push subscription",
    async () => {
      const { data, error } = await adminClient
        .from("push_subscriptions")
        .select("id, endpoint, platform, user_agent, updated_at, revoked_at")
        .eq("id", subscriptionId)
        .eq("profile_id", profileId)
        .is("revoked_at", null)
        .maybeSingle<PushSubscriptionRow>();

      if (error || !data) {
        return null;
      }

      return data;
    },
  );

  const pushTag = `verify-push-desktop-${timestamp}`;
  const pushTitle = "CoParrent desktop push test";
  const pushBody = "Desktop push pipeline verified";

  const pushResponse = await testerClient.functions.invoke("send-push", {
    body: {
      profile_id: profileId,
      title: pushTitle,
      body: pushBody,
      tag: pushTag,
      url: "/dashboard/notifications",
      subscription_ids: [subscriptionId],
    },
  });

  if (pushResponse.error) {
    throw new Error(`Desktop send-push invocation failed: ${pushResponse.error.message}`);
  }

  assert.equal(pushResponse.data?.success, true, "Desktop send-push did not return success");
  assert.equal(pushResponse.data?.sent >= 1, true, "Desktop send-push did not deliver to the targeted subscription");

  const observedNotification = await pollFor(
    "desktop notification delivery",
    async () => {
      return page.evaluate(async (tag) => {
        const registration = await navigator.serviceWorker.ready;
        const notifications = await registration.getNotifications({ tag });

        if (notifications.length === 0) {
          return null;
        }

        return notifications.map((notification) => ({
          title: notification.title,
          body: notification.body,
          tag: notification.tag,
          data: notification.data,
        }));
      }, pushTag);
    },
  );

  const screenshotPath = path.join(artifactDir, `push-pwa-${timestamp}-desktop.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  return {
    platform: "desktop-browser",
    status: "passed",
    startedAt,
    completedAt: new Date().toISOString(),
    subscriptionIds: [subscriptionId],
    screenshotPath,
    notes: [
      "Registered a real desktop web-push subscription in Chromium.",
      "Synced the subscription to push_subscriptions and observed delivery through the service worker notification list.",
    ],
    details: {
      endpointPreview: persistedSubscription.endpoint.slice(0, 120),
      sendResult: pushResponse.data,
      notification: observedNotification[0] ?? null,
    },
  };
}

async function verifyManualPlatformScenario(params: {
  platform: PushPlatform;
  adminClient: ReturnType<typeof createSupabaseClient>;
  testerClient: Awaited<ReturnType<typeof createAuthenticatedClient>>["client"];
  profileId: string;
  timestamp: string;
}): Promise<ScenarioResult> {
  const { platform, adminClient, testerClient, profileId, timestamp } = params;
  const startedAt = new Date().toISOString();

  const { data, error } = await adminClient
    .from("push_subscriptions")
    .select("id, endpoint, platform, user_agent, updated_at, revoked_at")
    .eq("profile_id", profileId)
    .eq("platform", platform)
    .is("revoked_at", null)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Unable to query ${platform} subscriptions: ${error.message}`);
  }

  const subscriptions = (data as PushSubscriptionRow[] | null) ?? [];

  if (subscriptions.length === 0) {
    return {
      platform,
      status: "blocked",
      startedAt,
      completedAt: new Date().toISOString(),
      subscriptionIds: [],
      notes: [
        `No active ${platformDisplayName(platform)} subscription is registered for the tester profile yet.`,
        "Open the deployed app on that device, enable notifications, then rerun this script before marking the manual evidence complete.",
      ],
      details: {
        reason: "missing_subscription",
      },
    };
  }

  const pushTag = `verify-push-${platform}-${timestamp}`;
  const pushResponse = await testerClient.functions.invoke("send-push", {
    body: {
      profile_id: profileId,
      title: `CoParrent ${platformDisplayName(platform)} push test`,
      body: `Manual confirmation needed on ${platformDisplayName(platform)} device`,
      tag: pushTag,
      url: "/dashboard/notifications",
      platform_filter: platform,
    },
  });

  if (pushResponse.error) {
    throw new Error(`Unable to send ${platform} push test: ${pushResponse.error.message}`);
  }

  assert.equal(pushResponse.data?.success, true, `${platform} send-push did not return success`);

  return {
    platform,
    status: "pending_manual_confirmation",
    startedAt,
    completedAt: new Date().toISOString(),
    subscriptionIds: subscriptions.map((subscription) => subscription.id),
    notes: [
      `Triggered a targeted push notification for ${platformDisplayName(platform)} subscriptions.`,
      "Manual confirmation on the physical device is still required before evidence can be logged as complete.",
    ],
    details: {
      targetedSubscriptions: subscriptions.length,
      sendResult: pushResponse.data,
      latestUserAgent: subscriptions[0]?.user_agent ?? null,
    },
  };
}

async function run(): Promise<void> {
  const repoRoot = process.cwd();
  const envFileValues = await loadSimpleEnv(path.join(repoRoot, ".env"));
  const supabaseUrl = getRequiredConfigValue(SUPABASE_URL_KEY, envFileValues);
  const anonKey = getRequiredConfigValue(SUPABASE_ANON_KEY_KEY, envFileValues);
  const projectRef = getRequiredConfigValue(SUPABASE_PROJECT_REF_KEY, envFileValues);
  const serviceRoleKey = await resolveServiceRoleKey(repoRoot, projectRef, envFileValues);
  const baseUrl =
    getConfigValue("PUSH_PWA_BASE_URL", envFileValues) ?? (await resolveDefaultBaseUrl(repoRoot));
  const testerLabel = getConfigValue("PUSH_PWA_TESTER_LABEL", envFileValues) ?? DEFAULT_TESTER_LABEL;
  const vercelCookiesPath = getConfigValue("PUSH_PWA_VERCEL_COOKIES_PATH", envFileValues);
  const headless = (getConfigValue("PUSH_PWA_HEADLESS", envFileValues) ?? "true").toLowerCase() !== "false";
  const vapidPublicKey =
    getConfigValue("VITE_VAPID_PUBLIC_KEY", envFileValues) ??
    getConfigValue("VAPID_PUBLIC_KEY", envFileValues);

  const testerAccounts = await loadTesterAccounts(path.join(repoRoot, "tester-accounts.local.md"));
  const tester = testerAccounts.get(testerLabel);
  if (!tester) {
    throw new Error(`Tester account "${testerLabel}" was not found in tester-accounts.local.md`);
  }

  const { client: testerClient, session } = await createAuthenticatedClient(
    supabaseUrl,
    anonKey,
    tester.email,
    tester.password,
  );
  const adminClient = createSupabaseClient(supabaseUrl, serviceRoleKey);
  const profileId = await fetchProfileId(adminClient, session.user.id);
  const artifactDir = path.join(repoRoot, "docs", "acquisition", "diligence", "evidence");
  await mkdir(artifactDir, { recursive: true });
  const timestamp = makeTimestampSlug();

  const context = await createBrowserContext(headless);
  const browser = context.browser();
  if (!browser) {
    throw new Error("Unable to create browser instance");
  }

  const sessionStorageKey = `sb-${projectRef}-auth-token`;
  await context.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, value);
    },
    { key: sessionStorageKey, value: JSON.stringify(session) },
  );

  if (vercelCookiesPath && baseUrl.includes(".vercel.app")) {
    logStep("Loading Vercel auth cookies for protected deployment access", { vercelCookiesPath });
    await context.addCookies(await loadBrowserCookies(path.resolve(repoRoot, vercelCookiesPath)));
  }

  await context.grantPermissions(["notifications"], {
    origin: new URL(baseUrl).origin,
  });

  const page = await context.newPage();
  const scenarios: ScenarioResult[] = [];

  try {
    if (vapidPublicKey) {
      try {
        scenarios.push(await verifyDesktopScenario({
          baseUrl,
          page,
          testerClient,
          adminClient,
          profileId,
          vapidPublicKey,
          artifactDir,
          timestamp,
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        scenarios.push({
          platform: "desktop-browser",
          status: "blocked",
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          subscriptionIds: [],
          notes: [
            "Desktop push registration did not complete in the automated browser pass.",
            "Review the details and rerun after adjusting browser permissions, auth cookies, or service-worker state.",
          ],
          details: {
            reason: "desktop_registration_failed",
            error: message,
          },
        });
      }
    } else {
      scenarios.push({
        platform: "desktop-browser",
        status: "blocked",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        subscriptionIds: [],
        notes: [
          "Desktop auto-registration requires VITE_VAPID_PUBLIC_KEY or VAPID_PUBLIC_KEY in the local verifier environment.",
          "Add the public key locally, then rerun the verifier before treating desktop push as complete.",
        ],
        details: {
          reason: "missing_vapid_public_key",
        },
      });
    }

    scenarios.push(await verifyManualPlatformScenario({
      platform: "android-pwa",
      adminClient,
      testerClient,
      profileId,
      timestamp,
    }));

    scenarios.push(await verifyManualPlatformScenario({
      platform: "ios-pwa",
      adminClient,
      testerClient,
      profileId,
      timestamp,
    }));
  } finally {
    await context.close();
    await browser.close();
  }

  const report: VerificationReport = {
    timestamp: new Date().toISOString(),
    baseUrl,
    environment: `Push/PWA verification against ${baseUrl} and production Supabase backend ${projectRef}`,
    helpUrls: {
      diagnostics: new URL("/pwa-diagnostics", `${baseUrl}/`).toString(),
      manualChecklist: MANUAL_CHECKLIST_PATH,
      notificationSettings: new URL("/dashboard/notifications", `${baseUrl}/`).toString(),
    },
    testerLabel: tester.label,
    testerEmail: tester.email,
    scenarios,
  };

  const reportPath = path.join(artifactDir, `push-pwa-${timestamp}-report.json`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  const summaryPath = path.join(artifactDir, `push-pwa-${timestamp}-summary.md`);
  await writeFile(summaryPath, buildMarkdownSummary(report, reportPath), "utf8");

  logStep("Push/PWA verification completed", {
    reportPath,
    summaryPath,
    scenarios: scenarios.map((scenario) => ({
      platform: scenario.platform,
      status: scenario.status,
      subscriptionIds: scenario.subscriptionIds,
    })),
  });
}

run().catch((error) => {
  console.error(`[verify-push-pwa] ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  process.exitCode = 1;
});
