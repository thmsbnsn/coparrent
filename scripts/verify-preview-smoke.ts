import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

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

interface SmokeScenarioResult {
  route: string;
  name: string;
  startedAt: string;
  completedAt: string;
  screenshotPath: string | null;
  notes: string[];
  details: Record<string, unknown>;
}

interface DiagnosticEvent {
  kind: "console" | "pageerror" | "response";
  label: string;
  message: string;
}

interface VerificationReport {
  timestamp: string;
  environment: string;
  baseUrl: string;
  testerLabel: string;
  testerEmail: string;
  scenarios: SmokeScenarioResult[];
  expectedNoise: DiagnosticEvent[];
  unexpectedDiagnostics: DiagnosticEvent[];
}

const SUPABASE_URL_KEY = "VITE_SUPABASE_URL";
const SUPABASE_ANON_KEY_KEY = "VITE_SUPABASE_PUBLISHABLE_KEY";
const SUPABASE_PROJECT_REF_KEY = "VITE_SUPABASE_PROJECT_ID";
const DEFAULT_BASE_URL = "https://coparrent-dx92q8g95-thomas-projects-6401cf21.vercel.app";
const DEFAULT_TESTER_LABEL = "Parent A";
const DEFAULT_VERCEL_COOKIES_PATH = "tmp/ai-runtime-vercel-cookies.json";

function describeTarget(baseUrl: string): { shortLabel: string; environmentLabel: string } {
  const url = new URL(baseUrl);

  if (url.hostname.endsWith(".vercel.app")) {
    return {
      shortLabel: "preview target",
      environmentLabel: `Vercel preview ${baseUrl}`,
    };
  }

  return {
    shortLabel: "configured target",
    environmentLabel: `Deployed target ${baseUrl}`,
  };
}

function logStep(step: string, details?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const suffix = details ? ` ${JSON.stringify(details)}` : "";
  console.log(`[verify-preview-smoke] ${timestamp} ${step}${suffix}`);
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
    if (key === "email") {
      current.email = value;
    }
    if (key === "password") {
      current.password = value;
    }
  }

  if (current?.email && current.password) {
    accounts.set(current.label, current);
  }

  return accounts;
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

async function loadBrowserCookies(filePath: string): Promise<BrowserCookie[]> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as BrowserCookie[];
}

function attachDiagnostics(page: Page, label: string, diagnostics: DiagnosticEvent[], origin: string): void {
  page.on("console", (message) => {
    const text = message.text();
    if (!text) {
      return;
    }

    const type = message.type();
    if (type === "error" || type === "warning") {
      diagnostics.push({
        kind: "console",
        label,
        message: `${type}: ${text}`,
      });
    }
  });

  page.on("pageerror", (error) => {
    diagnostics.push({
      kind: "pageerror",
      label,
      message: error.message,
    });
  });

  page.on("response", (response) => {
    const url = response.url();
    if (!url.startsWith(origin)) {
      return;
    }

    const request = response.request();
    const resourceType = request.resourceType();
    if (!["document", "fetch", "xhr"].includes(resourceType)) {
      return;
    }

    if (response.status() < 400) {
      return;
    }

    const responseUrl = new URL(url);
    diagnostics.push({
      kind: "response",
      label,
      message: `${response.status()} ${request.method()} ${responseUrl.pathname}${responseUrl.search}`,
    });
  });
}

async function addSharedContextInitScript(context: BrowserContext, projectRef: string, sessionJson?: string): Promise<void> {
  const cookieConsentValue = JSON.stringify({
    analytics: true,
    essential: true,
    functional: true,
    timestamp: new Date().toISOString(),
    version: "1.0",
  });

  await context.addInitScript(
    ({ authKey, authValue, consentKey, consentValue }) => {
      if (authValue) {
        window.localStorage.setItem(authKey, authValue);
      }
      window.localStorage.setItem(consentKey, consentValue);
    },
    {
      authKey: `sb-${projectRef}-auth-token`,
      authValue: sessionJson ?? null,
      consentKey: "coparrent_cookie_consent",
      consentValue: cookieConsentValue,
    },
  );
}

async function dismissBlockingPrompts(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const dismissibleButtons = [
      page.getByRole("button", { name: /accept all/i }),
      page.getByRole("button", { name: /essential only/i }),
      page.getByRole("button", { name: /not now/i }),
      page.getByRole("button", { name: /^close$/i }),
    ];

    let dismissedSomething = false;

    for (const button of dismissibleButtons) {
      try {
        if (await button.isVisible({ timeout: 750 }).catch(() => false)) {
          await button.click({ force: true, timeout: 2_000 });
          await page.waitForTimeout(350);
          dismissedSomething = true;
        }
      } catch {
        // Ignore overlays that do not matter to the smoke path.
      }
    }

    if (!dismissedSomething) {
      break;
    }
  }
}

function assertNotOnVercelLogin(page: Page): void {
  if (page.url().includes("vercel.com/login")) {
    throw new Error("Preview access is still blocked by Vercel auth. Refresh the saved preview cookies and rerun.");
  }
}

async function takeScenarioScreenshot(page: Page, filePath: string): Promise<void> {
  await page.screenshot({ path: filePath, fullPage: true });
}

async function verifyHomePage(params: {
  artifactDir: string;
  baseUrl: string;
  page: Page;
  timestamp: string;
  targetLabel: string;
}): Promise<SmokeScenarioResult> {
  const { artifactDir, baseUrl, page, timestamp, targetLabel } = params;
  const startedAt = new Date().toISOString();
  const route = "/";

  await page.goto(new URL(route, `${baseUrl}/`).toString(), { waitUntil: "domcontentloaded" });
  assertNotOnVercelLogin(page);
  await dismissBlockingPrompts(page);
  await Promise.any([
    page.getByRole("button", { name: /start free/i }).waitFor({ state: "visible", timeout: 30_000 }),
    page.getByRole("button", { name: /see how it works/i }).waitFor({ state: "visible", timeout: 30_000 }),
    page.getByText(/built for shared custody and clearer records/i).waitFor({ state: "visible", timeout: 30_000 }),
  ]);

  const screenshotPath = path.join(artifactDir, `preview-smoke-${timestamp}-home.png`);
  await takeScenarioScreenshot(page, screenshotPath);

  return {
    route,
    name: "Public home page",
    startedAt,
    completedAt: new Date().toISOString(),
    screenshotPath,
    notes: [
      `Verified the current ${targetLabel} loads the public landing page without a Vercel-auth redirect.`,
      "Waited for the hero CTA and trust-copy surface rather than a brittle single selector.",
    ],
    details: {
      currentUrl: page.url(),
    },
  };
}

async function verifyLoginPage(params: {
  artifactDir: string;
  baseUrl: string;
  page: Page;
  timestamp: string;
  targetLabel: string;
}): Promise<SmokeScenarioResult> {
  const { artifactDir, baseUrl, page, timestamp, targetLabel } = params;
  const startedAt = new Date().toISOString();
  const route = "/login";

  await page.goto(new URL(route, `${baseUrl}/`).toString(), { waitUntil: "domcontentloaded" });
  assertNotOnVercelLogin(page);
  await dismissBlockingPrompts(page);
  await page.getByRole("heading", { name: /welcome back/i }).waitFor({ state: "visible", timeout: 30_000 });
  await page.getByRole("button", { name: /sign in/i }).waitFor({ state: "visible", timeout: 30_000 });

  const screenshotPath = path.join(artifactDir, `preview-smoke-${timestamp}-login.png`);
  await takeScenarioScreenshot(page, screenshotPath);

  return {
    route,
    name: "Public login page",
    startedAt,
    completedAt: new Date().toISOString(),
    screenshotPath,
    notes: [
      `Verified the public login screen still renders as a normal app route on the ${targetLabel}.`,
      "Confirmed the basic sign-in controls are visible without depending on an authenticated session.",
    ],
    details: {
      currentUrl: page.url(),
    },
  };
}

async function verifyInviteLanding(params: {
  artifactDir: string;
  baseUrl: string;
  page: Page;
  timestamp: string;
  targetLabel: string;
}): Promise<SmokeScenarioResult> {
  const { artifactDir, baseUrl, page, timestamp, targetLabel } = params;
  const startedAt = new Date().toISOString();
  const route = "/accept-invite?token=preview-smoke-invalid-token";

  await page.goto(new URL(route, `${baseUrl}/`).toString(), { waitUntil: "domcontentloaded" });
  assertNotOnVercelLogin(page);
  await dismissBlockingPrompts(page);
  await page.waitForFunction(
    () => {
      const text = document.body.innerText.toLowerCase();
      return (
        text.includes("invalid invitation") ||
        text.includes("create account to accept") ||
        text.includes("sign in to validate and continue")
      );
    },
    undefined,
    { timeout: 45_000 },
  );

  const inviteBodyText = (await page.locator("body").innerText()).toLowerCase();
  const inviteState =
    inviteBodyText.includes("invalid invitation")
      ? "invalid"
      : inviteBodyText.includes("create account to accept") || inviteBodyText.includes("sign in to validate and continue")
        ? "unauthenticated-landing"
        : "unknown";

  assert.notEqual(inviteState, "unknown", "Invite landing did not render an expected preview state.");

  const screenshotPath = path.join(artifactDir, `preview-smoke-${timestamp}-invite.png`);
  await takeScenarioScreenshot(page, screenshotPath);

  return {
    route,
    name: "Invite landing route",
    startedAt,
    completedAt: new Date().toISOString(),
    screenshotPath,
    notes: [
      inviteState === "invalid"
        ? "Smoke-tested the invite landing route using a deliberately invalid token and confirmed the invalid-token state renders."
        : "Smoke-tested the invite landing route using a deliberately invalid token and confirmed the unauthenticated invite-landing state renders before token validation.",
      `This keeps the check thin while still proving the route resolves on the ${targetLabel}.`,
    ],
    details: {
      currentUrl: page.url(),
      inviteState,
      tokenStrategy: "invalid-token-smoke",
    },
  };
}

async function verifyDashboard(params: {
  artifactDir: string;
  baseUrl: string;
  page: Page;
  timestamp: string;
  targetLabel: string;
}): Promise<{ recentMessageDeepLinkVisible: boolean; result: SmokeScenarioResult }> {
  const { artifactDir, baseUrl, page, timestamp, targetLabel } = params;
  const startedAt = new Date().toISOString();
  const route = "/dashboard";

  await page.goto(new URL(route, `${baseUrl}/`).toString(), { waitUntil: "domcontentloaded" });
  assertNotOnVercelLogin(page);
  await dismissBlockingPrompts(page);
  await Promise.any([
    page.getByText(/today's parenting time/i).waitFor({ state: "visible", timeout: 45_000 }),
    page.getByText(/recent messages/i).waitFor({ state: "visible", timeout: 45_000 }),
  ]);

  const recentMessageDeepLinkVisible = await page
    .locator('a[href*="/dashboard/messages?thread="]')
    .first()
    .isVisible()
    .catch(() => false);

  const screenshotPath = path.join(artifactDir, `preview-smoke-${timestamp}-dashboard.png`);
  await takeScenarioScreenshot(page, screenshotPath);

  return {
    recentMessageDeepLinkVisible,
    result: {
      route,
      name: "Authenticated dashboard",
      startedAt,
      completedAt: new Date().toISOString(),
      screenshotPath,
      notes: [
        `Verified the tester session reaches the authenticated dashboard on the ${targetLabel}.`,
        recentMessageDeepLinkVisible
          ? "A thread deep-link is visible in the Recent Messages card and can be used for the Messaging Hub smoke step."
          : "No recent-message deep link was visible, so the Messaging Hub step will use a direct route open instead.",
      ],
      details: {
        currentUrl: page.url(),
        recentMessageDeepLinkVisible,
      },
    },
  };
}

async function verifyMessagingHub(params: {
  artifactDir: string;
  baseUrl: string;
  page: Page;
  timestamp: string;
  useRecentMessageDeepLink: boolean;
  targetLabel: string;
}): Promise<SmokeScenarioResult> {
  const { artifactDir, baseUrl, page, timestamp, useRecentMessageDeepLink, targetLabel } = params;
  const startedAt = new Date().toISOString();
  const route = "/dashboard/messages";
  let deepLinkedThread = false;

  if (useRecentMessageDeepLink) {
    const firstRecentMessageLink = page.locator('a[href*="/dashboard/messages?thread="]').first();
    await firstRecentMessageLink.waitFor({ state: "visible", timeout: 10_000 });
    await firstRecentMessageLink.click();
    await page.waitForURL(/\/dashboard\/messages(\?.*thread=.*)?/i, { timeout: 30_000 });
    deepLinkedThread = page.url().includes("thread=");
  } else {
    await page.goto(new URL(route, `${baseUrl}/`).toString(), { waitUntil: "domcontentloaded" });
  }

  assertNotOnVercelLogin(page);
  await dismissBlockingPrompts(page);
  await page.getByRole("heading", { name: /messaging hub/i }).waitFor({ state: "visible", timeout: 45_000 });
  await Promise.any([
    page.getByPlaceholder(/compose your message/i).waitFor({ state: "visible", timeout: 45_000 }),
    page.getByText(/family channel/i).waitFor({ state: "visible", timeout: 45_000 }),
    page.getByText(/no conversation loaded yet/i).waitFor({ state: "visible", timeout: 45_000 }),
  ]);

  const screenshotPath = path.join(artifactDir, `preview-smoke-${timestamp}-messaging-hub.png`);
  await takeScenarioScreenshot(page, screenshotPath);

  return {
    route,
    name: "Authenticated Messaging Hub",
    startedAt,
    completedAt: new Date().toISOString(),
    screenshotPath,
    notes: [
      deepLinkedThread
        ? "Reached Messaging Hub by clicking a Recent Messages deep link from the dashboard."
        : "Reached Messaging Hub through direct route navigation because no recent-message thread deep link was visible on the dashboard.",
      `Verified the page header and conversation surface render on the ${targetLabel}.`,
    ],
    details: {
      currentUrl: page.url(),
      deepLinkedThread,
    },
  };
}

function isExpectedPreviewNoise(event: DiagnosticEvent): boolean {
  if (event.kind === "response") {
    return /401 GET \/$/.test(event.message) || /401 GET \/dashboard$/.test(event.message) || /401 GET \/login$/.test(event.message);
  }

  return (
    event.message.includes("status of 401") ||
    event.message.includes("No DSN configured - error monitoring disabled") ||
    event.message.includes('invalid input syntax for type uuid: "preview-smoke-invalid-token"') ||
    event.message.includes("status of 400") ||
    event.message.includes("status of 406")
  );
}

async function run(): Promise<void> {
  const repoRoot = process.cwd();
  const envFileValues = await loadSimpleEnv(path.join(repoRoot, ".env"));
  const supabaseUrl = getRequiredConfigValue(SUPABASE_URL_KEY, envFileValues);
  const anonKey = getRequiredConfigValue(SUPABASE_ANON_KEY_KEY, envFileValues);
  const projectRef = getRequiredConfigValue(SUPABASE_PROJECT_REF_KEY, envFileValues);
  const baseUrl = getConfigValue("PREVIEW_SMOKE_BASE_URL", envFileValues) ?? DEFAULT_BASE_URL;
  const testerLabel = getConfigValue("PREVIEW_SMOKE_TESTER_LABEL", envFileValues) ?? DEFAULT_TESTER_LABEL;
  const vercelCookiesPath =
    getConfigValue("PREVIEW_SMOKE_VERCEL_COOKIES_PATH", envFileValues) ?? DEFAULT_VERCEL_COOKIES_PATH;
  const headless = (getConfigValue("PREVIEW_SMOKE_HEADLESS", envFileValues) ?? "true").toLowerCase() !== "false";

  const testerAccounts = await loadTesterAccounts(path.join(repoRoot, "tester-accounts.local.md"));
  const tester = testerAccounts.get(testerLabel);
  if (!tester) {
    throw new Error(`Tester account "${testerLabel}" was not found in tester-accounts.local.md`);
  }

  const { session } = await createAuthenticatedClient(supabaseUrl, anonKey, tester.email, tester.password);
  const artifactDir = path.join(repoRoot, "docs", "acquisition", "diligence", "evidence");
  await mkdir(artifactDir, { recursive: true });
  const timestamp = makeTimestampSlug();
  const diagnostics: DiagnosticEvent[] = [];
  const origin = new URL(baseUrl).origin;
  const target = describeTarget(baseUrl);

  const browser = await chromium.launch({ headless });
  const anonymousContext = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
  });
  const authenticatedContext = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
  });

  await addSharedContextInitScript(anonymousContext, projectRef);
  await addSharedContextInitScript(authenticatedContext, projectRef, JSON.stringify(session));

  if (baseUrl.includes(".vercel.app")) {
    const resolvedCookiesPath = path.resolve(repoRoot, vercelCookiesPath);
    logStep("Loading preview auth cookies", { resolvedCookiesPath });
    const cookies = await loadBrowserCookies(resolvedCookiesPath);
    await anonymousContext.addCookies(cookies);
    await authenticatedContext.addCookies(cookies);
  }

  const publicPage = await anonymousContext.newPage();
  const authenticatedPage = await authenticatedContext.newPage();
  attachDiagnostics(publicPage, "public", diagnostics, origin);
  attachDiagnostics(authenticatedPage, "authenticated", diagnostics, origin);

  const scenarios: SmokeScenarioResult[] = [];

  try {
    scenarios.push(await verifyHomePage({
      artifactDir,
      baseUrl,
      page: publicPage,
      timestamp,
      targetLabel: target.shortLabel,
    }));

    scenarios.push(await verifyLoginPage({
      artifactDir,
      baseUrl,
      page: publicPage,
      timestamp,
      targetLabel: target.shortLabel,
    }));

    scenarios.push(await verifyInviteLanding({
      artifactDir,
      baseUrl,
      page: publicPage,
      timestamp,
      targetLabel: target.shortLabel,
    }));

    const dashboardResult = await verifyDashboard({
      artifactDir,
      baseUrl,
      page: authenticatedPage,
      timestamp,
      targetLabel: target.shortLabel,
    });
    scenarios.push(dashboardResult.result);

    scenarios.push(await verifyMessagingHub({
      artifactDir,
      baseUrl,
      page: authenticatedPage,
      timestamp,
      useRecentMessageDeepLink: dashboardResult.recentMessageDeepLinkVisible,
      targetLabel: target.shortLabel,
    }));
  } finally {
    await anonymousContext.close();
    await authenticatedContext.close();
    await browser.close();
  }

  const expectedNoise = diagnostics.filter(isExpectedPreviewNoise);
  const unexpectedDiagnostics = diagnostics.filter((event) => !isExpectedPreviewNoise(event));

  const report: VerificationReport = {
    timestamp: new Date().toISOString(),
    environment: `${target.environmentLabel} against production Supabase backend ${projectRef}`,
    baseUrl,
    testerLabel: tester.label,
    testerEmail: tester.email,
    scenarios,
    expectedNoise,
    unexpectedDiagnostics,
  };

  const reportPath = path.join(artifactDir, `preview-smoke-${timestamp}-report.json`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  logStep("Preview smoke verification completed", {
    reportPath,
    scenarioCount: scenarios.length,
    unexpectedDiagnostics: unexpectedDiagnostics.length,
  });
}

run().catch((error) => {
  console.error(`[verify-preview-smoke] ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  process.exitCode = 1;
});
