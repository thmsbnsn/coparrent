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
import { chromium, type BrowserContext, type Locator, type Page } from "@playwright/test";

interface TesterAccount {
  label: string;
  email: string;
  password: string;
}

interface NurseNancyThreadRow {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface NurseNancyMessageRow {
  id: string;
  thread_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

interface ColoringPageRow {
  id: string;
  prompt: string;
  difficulty: string;
  image_url: string | null;
  created_at: string;
}

interface ScenarioResult {
  scenario: "Nurse Nancy" | "kid-activity-generator" | "generate-coloring-page";
  route: string;
  prompt: string;
  startedAt: string;
  completedAt: string;
  recordId: string;
  screenshotPath: string;
  notes: string[];
  details: Record<string, unknown>;
}

interface VerificationReport {
  timestamp: string;
  environment: string;
  baseUrl: string;
  testerLabel: string;
  testerEmail: string;
  scenarios: ScenarioResult[];
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

const SUPABASE_URL_KEY = "VITE_SUPABASE_URL";
const SUPABASE_ANON_KEY_KEY = "VITE_SUPABASE_PUBLISHABLE_KEY";
const SUPABASE_PROJECT_REF_KEY = "VITE_SUPABASE_PROJECT_ID";
const DEFAULT_BASE_URL = "https://coparrent.com";
const DEFAULT_LOCAL_BASE_URL = "http://127.0.0.1:4174";
const DEFAULT_TESTER_LABEL = "Parent A";
const execFile = promisify(execFileCallback);

function logStep(step: string, details?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const suffix = details ? ` ${JSON.stringify(details)}` : "";
  console.log(`[verify-ai-runtime] ${timestamp} ${step}${suffix}`);
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
  try {
    const { stdout } = process.platform === "win32"
      ? await execFile("cmd.exe", ["/d", "/s", "/c", "vercel list"], {
          cwd: repoRoot,
          windowsHide: true,
        })
      : await execFile("vercel", ["list"], {
          cwd: repoRoot,
          windowsHide: true,
        });

    const deploymentMatch = stdout.match(/https:\/\/coparrent-[^\s]+\.vercel\.app/i);
    if (deploymentMatch) {
      return deploymentMatch[0];
    }
  } catch (error) {
    logStep("Could not auto-discover latest Vercel deployment", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return DEFAULT_BASE_URL;
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

async function pollFor<T>(
  label: string,
  fn: () => Promise<T | null>,
  timeoutMs = 120_000,
  intervalMs = 2_000,
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
  await page.waitForTimeout(1_500);
  await dismissBlockingPrompts(page);

  if (page.url().includes("vercel.com/login")) {
    throw new Error("VERCEL_AUTH_REQUIRED");
  }

  const goToDashboardButton = page.getByRole("button", { name: /go to dashboard/i });
  if (await goToDashboardButton.isVisible().catch(() => false)) {
    await goToDashboardButton.click();
    await page.waitForTimeout(1_500);
  }
}

async function openRoute(
  page: Page,
  baseUrl: string,
  route: string,
  readyText: RegExp,
  spaNavigation = false,
): Promise<void> {
  const url = new URL(route, `${baseUrl}/`).toString();
  logStep("Opening route", { route, url, spaNavigation });
  if (spaNavigation) {
    await page.evaluate((targetRoute) => {
      window.history.pushState({}, "", targetRoute);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }, route);
  } else {
    await page.goto(url, { waitUntil: "domcontentloaded" });
  }
  await dismissBlockingPrompts(page);
  await page.getByText(readyText).first().waitFor({ state: "visible", timeout: 60_000 });
  await page.waitForTimeout(800);
}

async function takeScenarioScreenshot(page: Page, filePath: string): Promise<void> {
  await page.screenshot({ path: filePath, fullPage: true });
}

async function firstVisibleLocator(locators: Locator[]): Promise<Locator | null> {
  for (const locator of locators) {
    if (await locator.isVisible().catch(() => false)) {
      return locator;
    }
  }

  return null;
}

async function verifyNurseNancyScenario(params: {
  adminClient: ReturnType<typeof createSupabaseClient>;
  page: Page;
  baseUrl: string;
  spaNavigation: boolean;
  testerUserId: string;
  artifactDir: string;
  timestamp: string;
}): Promise<ScenarioResult> {
  const {
    adminClient,
    page,
    baseUrl,
    spaNavigation,
    testerUserId,
    artifactDir,
    timestamp,
  } = params;

  const route = "/dashboard/kids-hub/nurse-nancy";
  const prompt = "My 7-year-old has a mild cough and runny nose but no fever. What comfort care can I try tonight?";
  await openRoute(page, baseUrl, route, /nurse nancy/i, spaNavigation);
  const startedAt = new Date().toISOString();

  const input = page.getByPlaceholder(/type your health question/i);
  await page.waitForTimeout(1_000);
  const chatStarter = await firstVisibleLocator([
    page.getByRole("button", { name: /start a new chat/i }),
    page.getByRole("button", { name: /^new chat$/i }).first(),
    page.getByRole("button", { name: /new chat/i }).first(),
  ]);

  if (chatStarter) {
    await chatStarter.click();
  }

  await input.waitFor({ state: "visible", timeout: 60_000 });
  await input.fill(prompt);
  await input.press("Enter");

  const persistedThread = await pollFor(
    "persisted Nurse Nancy thread and reply",
    async () => {
      const { data: thread, error: threadError } = await adminClient
        .from("nurse_nancy_threads")
        .select("id, title, created_at, updated_at")
        .eq("user_id", testerUserId)
        .gte("updated_at", startedAt)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle<NurseNancyThreadRow>();

      if (threadError || !thread) {
        return null;
      }

      const { data: messages, error: messagesError } = await adminClient
        .from("nurse_nancy_messages")
        .select("id, thread_id, role, content, created_at")
        .eq("thread_id", thread.id)
        .order("created_at", { ascending: true });

      if (messagesError || !messages) {
        return null;
      }

      const typedMessages = messages as NurseNancyMessageRow[];
      const hasUserMessage = typedMessages.some((message) => message.role === "user" && message.content.includes("mild cough"));
      const assistantReply = typedMessages.findLast((message) => message.role === "assistant");

      if (!hasUserMessage || !assistantReply) {
        return null;
      }

      return {
        thread,
        assistantReply,
        messageCount: typedMessages.length,
      };
    },
    120_000,
  );

  await page.getByText(/consult a healthcare provider|trust your instincts|pediatrician/i).first().waitFor({
    state: "visible",
    timeout: 60_000,
  });

  const screenshotPath = path.join(artifactDir, `ai-runtime-${timestamp}-nurse-nancy.png`);
  await takeScenarioScreenshot(page, screenshotPath);

  assert.ok(
    persistedThread.assistantReply.content.length > 40,
    "Nurse Nancy assistant reply was unexpectedly short",
  );

  return {
    scenario: "Nurse Nancy",
    route,
    prompt,
    startedAt,
    completedAt: new Date().toISOString(),
    recordId: persistedThread.thread.id,
    screenshotPath,
    notes: [
      "Created a fresh Nurse Nancy thread through the deployed UI.",
      "Verified user and assistant messages were persisted in production.",
    ],
    details: {
      threadTitle: persistedThread.thread.title,
      messageCount: persistedThread.messageCount,
      assistantReplyPreview: persistedThread.assistantReply.content.slice(0, 240),
    },
  };
}

async function verifyActivityScenario(params: {
  page: Page;
  baseUrl: string;
  spaNavigation: boolean;
  artifactDir: string;
  timestamp: string;
}): Promise<ScenarioResult> {
  const {
    page,
    baseUrl,
    spaNavigation,
    artifactDir,
    timestamp,
  } = params;

  const route = "/dashboard/kids-hub/activities";
  const prompt = "Need a calm indoor activity for a 7-year-old with paper, tape, and markers.";
  await openRoute(page, baseUrl, route, /activity generator/i, spaNavigation);

  const clearChatButton = page.getByRole("button", { name: /clear chat/i });
  if (await clearChatButton.count()) {
    await clearChatButton.click();
    await page.waitForTimeout(500);
  }

  const input = page.getByPlaceholder(/describe the activity you're looking for/i);
  await input.waitFor({ state: "visible", timeout: 60_000 });

  const startedAt = new Date().toISOString();
  await input.fill(prompt);
  await dismissBlockingPrompts(page);
  const activityResponsePromise = page.waitForResponse((response) =>
    response.request().method() === "POST" &&
    response.url().includes("/functions/v1/kid-activity-generator"),
  );
  await input.press("Enter");
  const activityResponse = await activityResponsePromise;
  assert.equal(activityResponse.ok(), true, "kid-activity-generator returned a non-2xx response");
  const activityPayload = await activityResponse.json() as {
    error?: string;
    type?: string;
    result?: {
      title?: string;
      age_range?: string;
      steps?: unknown;
      materials?: unknown;
    };
  };
  assert.equal(activityPayload.error, undefined, "kid-activity-generator returned an error payload");
  assert.equal(activityPayload.type, "activity", "kid-activity-generator did not return an activity payload");
  assert.ok(activityPayload.result?.title, "kid-activity-generator payload was missing a title");
  assert.ok(
    Array.isArray(activityPayload.result?.steps) && activityPayload.result.steps.length > 1,
    "kid-activity-generator payload was missing steps",
  );

  await page.getByText(/ages:/i).first().waitFor({
    state: "visible",
    timeout: 120_000,
  });
  const assistantErrorVisible = await page.getByText(/i couldn't generate an activity right now/i).count();
  assert.equal(assistantErrorVisible, 0, "Activity generator showed an error response in the UI");

  const screenshotPath = path.join(artifactDir, `ai-runtime-${timestamp}-activity-generator.png`);
  await takeScenarioScreenshot(page, screenshotPath);

  return {
    scenario: "kid-activity-generator",
    route,
    prompt,
    startedAt,
    completedAt: new Date().toISOString(),
    recordId: `${timestamp}:kid-activity-generator`,
    screenshotPath,
    notes: [
      "Generated an activity idea through the deployed UI.",
      "Verified the live edge-function response returned structured activity data.",
    ],
    details: {
      activityTitle: activityPayload.result?.title,
      ageRange: activityPayload.result?.age_range,
      stepCount: Array.isArray(activityPayload.result?.steps) ? activityPayload.result.steps.length : 0,
      materialCount: Array.isArray(activityPayload.result?.materials) ? activityPayload.result.materials.length : 0,
      responseDetectedInUi: true,
      scenarioStartedAt: startedAt,
    },
  };
}

async function verifyColoringPageScenario(params: {
  adminClient: ReturnType<typeof createSupabaseClient>;
  page: Page;
  baseUrl: string;
  spaNavigation: boolean;
  testerUserId: string;
  artifactDir: string;
  timestamp: string;
}): Promise<ScenarioResult> {
  const {
    adminClient,
    page,
    baseUrl,
    spaNavigation,
    testerUserId,
    artifactDir,
    timestamp,
  } = params;

  const route = "/dashboard/kids-hub/coloring-pages";
  const prompt = "A treehouse village connected by rope bridges with kids exploring";
  await openRoute(page, baseUrl, route, /coloring page creator/i, spaNavigation);

  const promptInput = page.getByLabel(/what should the coloring page show/i);
  await promptInput.waitFor({ state: "visible", timeout: 60_000 });

  const startedAt = new Date().toISOString();
  await promptInput.fill(prompt);
  await dismissBlockingPrompts(page);
  const coloringResponsePromise = page.waitForResponse((response) =>
    response.request().method() === "POST" &&
    response.url().includes("/functions/v1/generate-coloring-page"),
  );
  await page.getByRole("button", { name: /generate coloring page/i }).click();
  const coloringResponse = await coloringResponsePromise;
  assert.equal(coloringResponse.ok(), true, "generate-coloring-page returned a non-2xx response");
  const coloringPayload = await coloringResponse.json() as {
    ok?: boolean;
    code?: string;
    imageUrl?: string;
    coloringPageId?: string;
  };
  assert.equal(coloringPayload.ok, true, "generate-coloring-page returned a failed payload");
  assert.ok(coloringPayload.imageUrl, "generate-coloring-page did not return an image URL");

  await page.getByAltText(/generated coloring page/i).waitFor({
    state: "visible",
    timeout: 180_000,
  });

  const savedPage = await pollFor(
    "saved coloring page metadata",
    async () => {
      const { data, error } = await adminClient
        .from("coloring_pages")
        .select("id, prompt, difficulty, image_url, created_at")
        .eq("user_id", testerUserId)
        .gte("created_at", startedAt)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<ColoringPageRow>();

      if (error || !data || !data.image_url) {
        return null;
      }

      return data;
    },
    180_000,
  );

  const screenshotPath = path.join(artifactDir, `ai-runtime-${timestamp}-coloring-page.png`);
  await takeScenarioScreenshot(page, screenshotPath);

  return {
    scenario: "generate-coloring-page",
    route,
    prompt,
    startedAt,
    completedAt: new Date().toISOString(),
    recordId: savedPage.id,
    screenshotPath,
    notes: [
      "Generated a coloring page through the deployed UI.",
      "Verified the generated image metadata was persisted with a non-empty image URL.",
    ],
    details: {
      difficulty: savedPage.difficulty,
      responseColoringPageId: coloringPayload.coloringPageId,
      imageUrlPreview: savedPage.image_url.slice(0, 160),
    },
  };
}

async function createBrowserContext(): Promise<BrowserContext> {
  const headless = (process.env.AI_RUNTIME_HEADLESS ?? "true").toLowerCase() !== "false";
  const browser = await chromium.launch({ headless });
  return await browser.newContext({
    viewport: { width: 1440, height: 1100 },
  });
}

async function loadBrowserCookies(filePath: string): Promise<BrowserCookie[]> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as BrowserCookie[];
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
      // Keep polling.
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
    // Start the local app below.
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
    throw new Error(`Unable to start the local app server: ${error instanceof Error ? error.message : String(error)}\n${stderrBuffer}`);
  }

  return child;
}

async function run(): Promise<void> {
  const repoRoot = process.cwd();
  const envFileValues = await loadSimpleEnv(path.join(repoRoot, ".env"));
  const supabaseUrl = getRequiredConfigValue(SUPABASE_URL_KEY, envFileValues);
  const anonKey = getRequiredConfigValue(SUPABASE_ANON_KEY_KEY, envFileValues);
  const projectRef = getRequiredConfigValue(SUPABASE_PROJECT_REF_KEY, envFileValues);
  const serviceRoleKey = await resolveServiceRoleKey(repoRoot, projectRef, envFileValues);
  const preferredBaseUrl =
    getConfigValue("AI_RUNTIME_BASE_URL", envFileValues) ?? (await resolveDefaultBaseUrl(repoRoot));
  const fallbackBaseUrl = getConfigValue("AI_RUNTIME_FALLBACK_BASE_URL", envFileValues) ?? DEFAULT_LOCAL_BASE_URL;
  const vercelCookiesPath = getConfigValue("AI_RUNTIME_VERCEL_COOKIES_PATH", envFileValues);
  const testerLabel = getConfigValue("AI_RUNTIME_TESTER_LABEL", envFileValues) ?? DEFAULT_TESTER_LABEL;

  const testerAccounts = await loadTesterAccounts(path.join(repoRoot, "tester-accounts.local.md"));
  const tester = testerAccounts.get(testerLabel);
  if (!tester) {
    throw new Error(`Tester account "${testerLabel}" was not found in tester-accounts.local.md`);
  }

  const artifactDir = path.join(repoRoot, "docs", "acquisition", "diligence", "evidence");
  await mkdir(artifactDir, { recursive: true });

  logStep("Creating tester auth session", { tester: tester.email });
  const { session } = await createAuthenticatedClient(supabaseUrl, anonKey, tester.email, tester.password);
  const adminClient = createSupabaseClient(supabaseUrl, serviceRoleKey);
  const timestamp = makeTimestampSlug();
  let baseUrl = preferredBaseUrl;
  let environmentDescription = `Latest deployed frontend ${baseUrl} against production Supabase backend ${projectRef}`;
  let localServer: ChildProcessWithoutNullStreams | null = null;
  let spaNavigation = false;

  const context = await createBrowserContext();
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

  if (vercelCookiesPath && preferredBaseUrl.includes(".vercel.app")) {
    logStep("Loading Vercel auth cookies for protected deployment access", { vercelCookiesPath });
    await context.addCookies(await loadBrowserCookies(path.resolve(repoRoot, vercelCookiesPath)));
  }

  const page = await context.newPage();
  const scenarios: ScenarioResult[] = [];

  try {
    try {
      await bootstrapAuthenticatedApp(page, baseUrl);
      spaNavigation = baseUrl.includes(".vercel.app");
    } catch (error) {
      if (error instanceof Error && error.message === "VERCEL_AUTH_REQUIRED") {
        logStep("Protected Vercel deployment blocked clean-browser access; falling back to local current client", {
          preferredBaseUrl,
          fallbackBaseUrl,
        });
        localServer = await ensureLocalAppServer(repoRoot, fallbackBaseUrl);
        baseUrl = fallbackBaseUrl;
        environmentDescription = `Local current client ${baseUrl} against production Supabase backend ${projectRef} (deployed frontend is Vercel-auth protected)`;
        await bootstrapAuthenticatedApp(page, baseUrl);
        spaNavigation = false;
      } else {
        throw error;
      }
    }

    scenarios.push(await verifyNurseNancyScenario({
      adminClient,
      page,
      baseUrl,
      spaNavigation,
      testerUserId: session.user.id,
      artifactDir,
      timestamp,
    }));

    scenarios.push(await verifyActivityScenario({
      page,
      baseUrl,
      spaNavigation,
      artifactDir,
      timestamp,
    }));

    scenarios.push(await verifyColoringPageScenario({
      adminClient,
      page,
      baseUrl,
      spaNavigation,
      testerUserId: session.user.id,
      artifactDir,
      timestamp,
    }));
  } finally {
    await context.close();
    await browser.close();
    localServer?.kill("SIGTERM");
  }

  const report: VerificationReport = {
    timestamp: new Date().toISOString(),
    environment: environmentDescription,
    baseUrl,
    testerLabel: tester.label,
    testerEmail: tester.email,
    scenarios,
  };

  const reportPath = path.join(artifactDir, `ai-runtime-${timestamp}-report.json`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  logStep("AI runtime verification completed", {
    reportPath,
    scenarios: scenarios.map((scenario) => ({
      scenario: scenario.scenario,
      recordId: scenario.recordId,
    })),
  });
}

run().catch((error) => {
  console.error(`[verify-ai-runtime] ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  process.exitCode = 1;
});
