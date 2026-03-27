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

import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

interface TesterAccount {
  label: string;
  email: string;
  password: string;
}

interface TesterIdentity {
  account: TesterAccount;
  familyId: string;
  fullName: string | null;
  membershipRole: string;
  primaryParentId: string;
  profileId: string;
  relationshipLabel: string | null;
  userId: string;
}

interface MessageThreadRow {
  family_id: string | null;
  id: string;
}

interface CallSessionRow {
  call_type: "audio" | "video";
  created_at: string;
  daily_room_name: string;
  family_id: string;
  id: string;
  status: string;
  thread_id: string | null;
}

interface CallEventRow {
  actor_display_name: string | null;
  actor_profile_id: string | null;
  created_at: string;
  event_type: string;
  id: string;
  payload: Record<string, unknown> | null;
}

interface CallParticipantPresenceRow {
  joined_at: string | null;
  left_at: string | null;
  profile_id: string;
}

interface ThreadMessageRow {
  content: string;
  created_at: string;
  id: string;
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

interface ScenarioResult {
  scenario: "dashboard-audio" | "messaging-video";
  callSessionId: string;
  callType: "audio" | "video";
  startedAt: string;
  completedAt: string;
  threadId: string;
  roomName: string;
  screenshots: string[];
  notes: string[];
  details: Record<string, unknown>;
}

interface VerificationReport {
  timestamp: string;
  environment: string;
  baseUrl: string;
  caller: string;
  callee: string;
  scenarios: ScenarioResult[];
}

const DEFAULT_BASE_URL = "http://127.0.0.1:4174";
const DEFAULT_CALLER_LABEL = "Parent A";
const DEFAULT_CALLEE_LABEL = "Parent B";
const SUPABASE_URL_KEY = "VITE_SUPABASE_URL";
const SUPABASE_ANON_KEY_KEY = "VITE_SUPABASE_PUBLISHABLE_KEY";
const SUPABASE_PROJECT_REF_KEY = "VITE_SUPABASE_PROJECT_ID";
const execFile = promisify(execFileCallback);

function logStep(step: string, details?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const suffix = details ? ` ${JSON.stringify(details)}` : "";
  console.log(`[verify-daily-calls] ${timestamp} ${step}${suffix}`);
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

  const base = new URL(baseUrl);
  if (base.protocol !== "http:") {
    return null;
  }

  try {
    await waitForHttpReady(healthUrl, 2_000);
    return null;
  } catch {
    // Start the local app below.
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
      `Unable to start the local app server: ${
        error instanceof Error ? error.message : String(error)
      }\n${stderrBuffer}`,
    );
  }

  return child;
}

async function getAuthUserIdByEmail(
  adminClient: ReturnType<typeof createSupabaseClient>,
  email: string,
): Promise<string> {
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
      break;
    }

    page += 1;
  }

  throw new Error(`No auth user exists for ${email}`);
}

async function loadTesterIdentity(
  adminClient: ReturnType<typeof createSupabaseClient>,
  account: TesterAccount,
): Promise<TesterIdentity> {
  const userId = await getAuthUserIdByEmail(adminClient, account.email);

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, user_id, full_name, email")
    .eq("user_id", userId)
    .single<{
      email: string | null;
      full_name: string | null;
      id: string;
      user_id: string;
    }>();

  if (profileError || !profile) {
    throw new Error(`Unable to load profile for ${account.email}: ${profileError?.message ?? "profile missing"}`);
  }

  const { data: membership, error: membershipError } = await adminClient
    .from("family_members")
    .select("family_id, role, primary_parent_id, relationship_label")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("accepted_at", { ascending: true })
    .limit(1)
    .maybeSingle<{
      family_id: string | null;
      primary_parent_id: string | null;
      relationship_label: string | null;
      role: string;
    }>();

  if (membershipError || !membership?.family_id || !membership.primary_parent_id) {
    throw new Error(`Unable to load active family membership for ${account.email}`);
  }

  return {
    account,
    familyId: membership.family_id,
    fullName: profile.full_name,
    membershipRole: membership.role,
    primaryParentId: membership.primary_parent_id,
    profileId: profile.id,
    relationshipLabel: membership.relationship_label ?? null,
    userId,
  };
}

function toTitleLabel(value: string): string {
  return value
    .trim()
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function getContactLabelCandidates(identity: TesterIdentity): string[] {
  const candidates = new Set<string>();

  if (identity.fullName?.trim()) {
    candidates.add(identity.fullName.trim());
  }

  if (identity.relationshipLabel?.trim()) {
    candidates.add(toTitleLabel(identity.relationshipLabel));
  }

  if (identity.account.email.trim()) {
    candidates.add(identity.account.email.trim());
  }

  return [...candidates];
}

async function ensureDirectMessageThread(
  adminClient: ReturnType<typeof createSupabaseClient>,
  caller: TesterIdentity,
  callee: TesterIdentity,
): Promise<string> {
  const [participantAId, participantBId] =
    caller.profileId < callee.profileId
      ? [caller.profileId, callee.profileId]
      : [callee.profileId, caller.profileId];

  const { data: existingThread, error: existingThreadError } = await adminClient
    .from("message_threads")
    .select("id, family_id")
    .eq("primary_parent_id", caller.primaryParentId)
    .eq("thread_type", "direct_message")
    .eq("participant_a_id", participantAId)
    .eq("participant_b_id", participantBId)
    .maybeSingle<MessageThreadRow>();

  if (existingThreadError) {
    throw new Error(`Unable to load direct thread: ${existingThreadError.message}`);
  }

  if (existingThread) {
    if (!existingThread.family_id) {
      const { error: patchError } = await adminClient
        .from("message_threads")
        .update({ family_id: caller.familyId })
        .eq("id", existingThread.id);

      if (patchError) {
        throw new Error(`Unable to patch thread family_id: ${patchError.message}`);
      }
    }

    return existingThread.id;
  }

  const { data: createdThread, error: createError } = await adminClient
    .from("message_threads")
    .insert({
      family_id: caller.familyId,
      participant_a_id: participantAId,
      participant_b_id: participantBId,
      primary_parent_id: caller.primaryParentId,
      thread_type: "direct_message",
    })
    .select("id")
    .single<{ id: string }>();

  if (createError || !createdThread) {
    throw new Error(`Unable to create direct thread: ${createError?.message ?? "missing thread"}`);
  }

  return createdThread.id;
}

async function clearOpenCallSessions(
  adminClient: ReturnType<typeof createSupabaseClient>,
  caller: TesterIdentity,
  callee: TesterIdentity,
): Promise<void> {
  const { data: sessions, error } = await adminClient
    .from("call_sessions")
    .select("id")
    .in("status", ["ringing", "accepted"])
    .or(
      `and(initiator_profile_id.eq.${caller.profileId},callee_profile_id.eq.${callee.profileId}),and(initiator_profile_id.eq.${callee.profileId},callee_profile_id.eq.${caller.profileId})`,
    );

  if (error) {
    if (error.message.includes("call_sessions")) {
      throw new Error("call_sessions is not available in the remote database yet");
    }

    throw new Error(`Unable to clear open call sessions: ${error.message}`);
  }

  const sessionIds = (sessions ?? []).map((session) => session.id as string);
  if (sessionIds.length === 0) {
    return;
  }

  const { error: deleteError } = await adminClient
    .from("call_sessions")
    .delete()
    .in("id", sessionIds);

  if (deleteError) {
    throw new Error(`Unable to delete stale call sessions: ${deleteError.message}`);
  }
}

async function loadBrowserCookies(filePath: string): Promise<BrowserCookie[]> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as BrowserCookie[];
}

async function createBrowser(headless: boolean): Promise<Browser> {
  return chromium.launch({
    headless,
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      "--autoplay-policy=no-user-gesture-required",
    ],
  });
}

async function createAuthenticatedContext(params: {
  baseUrl: string;
  browser: Browser;
  projectRef: string;
  session: unknown;
  vercelCookiesPath?: string;
}): Promise<BrowserContext> {
  const { baseUrl, browser, projectRef, session, vercelCookiesPath } = params;
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
  });

  const sessionStorageKey = `sb-${projectRef}-auth-token`;
  const cookieConsentValue = JSON.stringify({
    analytics: true,
    essential: true,
    functional: true,
    timestamp: new Date().toISOString(),
    version: "1.0",
  });

  await context.addInitScript(
    ({ authKey, authValue, consentKey, consentValue }) => {
      window.localStorage.setItem(authKey, authValue);
      window.localStorage.setItem(consentKey, consentValue);
    },
    {
      authKey: sessionStorageKey,
      authValue: JSON.stringify(session),
      consentKey: "coparrent_cookie_consent",
      consentValue: cookieConsentValue,
    },
  );

  if (vercelCookiesPath && baseUrl.includes(".vercel.app")) {
    await context.addCookies(await loadBrowserCookies(vercelCookiesPath));
  }

  await context.grantPermissions(["camera", "microphone"], {
    origin: new URL(baseUrl).origin,
  });

  return context;
}

async function dismissBlockingPrompts(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const dismissibleButtons = [
      page.getByRole("button", { name: /accept all/i }),
      page.getByRole("button", { name: /essential only/i }),
      page.getByRole("button", { name: /not now/i }),
      page.getByRole("button", { name: /^accept$/i }),
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
        // Ignore non-essential overlays that fail to dismiss cleanly.
      }
    }

    if (!dismissedSomething) {
      break;
    }

    await page.waitForTimeout(400);
  }
}

async function bootstrapAuthenticatedApp(page: Page, baseUrl: string): Promise<void> {
  await page.goto(new URL("/", `${baseUrl}/`).toString(), { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1_500);
  await dismissBlockingPrompts(page);

  const goToDashboardButton = page.getByRole("button", { name: /go to dashboard/i });
  if (await goToDashboardButton.isVisible().catch(() => false)) {
    await goToDashboardButton.click();
    await page.waitForTimeout(1_000);
  }

  logStep("Bootstrapped authenticated app page", { currentUrl: page.url() });
}

function attachPageDiagnostics(page: Page, label: string): void {
  page.on("request", (request) => {
    const url = request.url();
    if (!/create-call-session|join-call-session|respond-to-call|end-call-session/i.test(url)) {
      return;
    }

    logStep("Browser request", {
      label,
      method: request.method(),
      url,
    });
  });

  page.on("console", (message) => {
    const text = message.text();
    if (!text) {
      return;
    }

    const type = message.type();
    if (type === "error" || /call|daily|supabase|failed|error/i.test(text)) {
      logStep("Browser console", { label, text, type });
    }
  });

  page.on("pageerror", (error) => {
    logStep("Browser page error", {
      label,
      error: error.message,
    });
  });

  page.on("response", async (response) => {
    const url = response.url();
    if (!/join-call-session|respond-to-call|create-call-session|end-call-session|daily/i.test(url)) {
      return;
    }

    logStep(response.ok() ? "Browser response" : "Browser response error", {
      label,
      status: response.status(),
      url,
    });
  });
}

async function openRoute(page: Page, baseUrl: string, route: string): Promise<void> {
  await page.goto(new URL(route, `${baseUrl}/`).toString(), { waitUntil: "domcontentloaded" });
  await dismissBlockingPrompts(page);
  await page.waitForTimeout(1_000);
  await dismissBlockingPrompts(page);
  logStep("Opened route", { currentUrl: page.url(), route });
}

async function pollFor<T>(
  label: string,
  fn: () => Promise<T | null>,
  timeoutMs = 60_000,
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

async function waitForCallSession(
  adminClient: ReturnType<typeof createSupabaseClient>,
  caller: TesterIdentity,
  callee: TesterIdentity,
  callType: "audio" | "video",
  startedAt: string,
): Promise<CallSessionRow> {
  return pollFor("call session creation", async () => {
    const { data, error } = await adminClient
      .from("call_sessions")
      .select("id, family_id, thread_id, status, call_type, created_at, daily_room_name")
      .eq("family_id", caller.familyId)
      .eq("call_type", callType)
      .gte("created_at", startedAt)
      .or(
        `and(initiator_profile_id.eq.${caller.profileId},callee_profile_id.eq.${callee.profileId}),and(initiator_profile_id.eq.${callee.profileId},callee_profile_id.eq.${caller.profileId})`,
      )
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<CallSessionRow>();

    if (error || !data) {
      return null;
    }

    return data;
  });
}

async function waitForCallEvents(
  adminClient: ReturnType<typeof createSupabaseClient>,
  callSessionId: string,
  requiredEventCounts: Partial<Record<string, number>>,
): Promise<CallEventRow[]> {
  return pollFor("call event completion", async () => {
    const { data, error } = await adminClient
      .from("call_events")
      .select("id, actor_profile_id, actor_display_name, event_type, payload, created_at")
      .eq("call_session_id", callSessionId)
      .order("created_at", { ascending: true })
      .returns<CallEventRow[]>();

    if (error || !data) {
      return null;
    }

    const counts = data.reduce<Record<string, number>>((accumulator, eventRow) => {
      accumulator[eventRow.event_type] = (accumulator[eventRow.event_type] ?? 0) + 1;
      return accumulator;
    }, {});

    const missing = Object.entries(requiredEventCounts).some(
      ([eventType, requiredCount]) => (counts[eventType] ?? 0) < (requiredCount ?? 0),
    );

    if (missing) {
      return null;
    }

    return data;
  }, 90_000, 2_000);
}

async function waitForCallSessionStatus(
  adminClient: ReturnType<typeof createSupabaseClient>,
  callSessionId: string,
  expectedStatus: string,
): Promise<CallSessionRow> {
  return pollFor("terminal call session status", async () => {
    const { data, error } = await adminClient
      .from("call_sessions")
      .select("id, family_id, thread_id, status, call_type, created_at, daily_room_name")
      .eq("id", callSessionId)
      .maybeSingle<CallSessionRow>();

    if (error || !data || data.status !== expectedStatus) {
      return null;
    }

    return data;
  }, 60_000, 2_000);
}

async function waitForParticipantPresence(
  adminClient: ReturnType<typeof createSupabaseClient>,
  callSessionId: string,
  expectations: {
    joinedCount: number;
    leftCount: number;
  },
): Promise<CallParticipantPresenceRow[]> {
  return pollFor("participant presence updates", async () => {
    const { data, error } = await adminClient
      .from("call_participants")
      .select("profile_id, joined_at, left_at")
      .eq("call_session_id", callSessionId)
      .returns<CallParticipantPresenceRow[]>();

    if (error || !data) {
      return null;
    }

    const joinedCount = data.filter((row) => Boolean(row.joined_at)).length;
    const leftCount = data.filter((row) => Boolean(row.left_at)).length;
    if (joinedCount < expectations.joinedCount || leftCount < expectations.leftCount) {
      return null;
    }

    return data;
  }, 90_000, 2_000);
}

async function waitForThreadMessages(
  adminClient: ReturnType<typeof createSupabaseClient>,
  threadId: string,
  startedAt: string,
  expectedFragments: string[],
): Promise<ThreadMessageRow[]> {
  return pollFor("thread call log messages", async () => {
    const { data, error } = await adminClient
      .from("thread_messages")
      .select("id, content, created_at")
      .eq("thread_id", threadId)
      .gte("created_at", startedAt)
      .order("created_at", { ascending: true })
      .returns<ThreadMessageRow[]>();

    if (error || !data) {
      return null;
    }

    const hasAllFragments = expectedFragments.every((fragment) =>
      data.some((message) => message.content.includes(fragment)),
    );

    if (!hasAllFragments) {
      return null;
    }

    return data;
  }, 60_000, 2_000);
}

async function openDashboardCallerAndStartCall(
  page: Page,
  contactLabels: string[],
  callType: "audio" | "video",
): Promise<void> {
  await page.getByRole("button", { name: /open caller/i }).click();
  const contactCards = page.getByRole("button").filter({ hasText: /tap to choose/i });
  let contactCard = contactCards.first();

  for (const contactLabel of contactLabels) {
    const matchedCard = contactCards.filter({ hasText: contactLabel }).first();
    if (await matchedCard.isVisible({ timeout: 5_000 }).catch(() => false)) {
      contactCard = matchedCard;
      break;
    }
  }

  await contactCard.waitFor({ state: "visible", timeout: 30_000 });
  await contactCard.click();
  await page.waitForTimeout(700);

  const buttonLabel = callType === "audio" ? "Audio" : "Video";
  const clicked = await page.evaluate((label) => {
    const buttons = [...document.querySelectorAll("button")];
    const target = buttons.find((button) => {
      const text = button.textContent?.trim();
      if (text !== label) {
        return false;
      }

      const rect = button.getBoundingClientRect();
      const styles = window.getComputedStyle(button);
      return (
        styles.display !== "none" &&
        styles.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0
      );
    });

    if (!target) {
      return false;
    }

    target.click();
    return true;
  }, buttonLabel);

  assert.ok(clicked, `Unable to click the ${buttonLabel} call button in the dashboard caller.`);
}

async function openDirectMessageThread(params: {
  baseUrl: string;
  contactLabels: string[];
  page: Page;
  threadId: string;
}): Promise<void> {
  const { baseUrl, contactLabels, page, threadId } = params;

  await openRoute(page, baseUrl, `/dashboard/messages?thread=${encodeURIComponent(threadId)}`);

  const videoButton = page.getByLabel("Start video call");
  if (await videoButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
    return;
  }

  const clickedDirectThread = await page.evaluate((labels) => {
    const directTab = [...document.querySelectorAll('[role="tab"]')].find((element) =>
      /direct/i.test(element.textContent ?? ""),
    );

    if (directTab instanceof HTMLElement) {
      directTab.click();
    }

    const normalizedLabels = labels.map((label) => label.toLowerCase());
    const candidateButtons = [...document.querySelectorAll("button")];
    const targetButton = candidateButtons.find((button) => {
      const text = (button.textContent ?? "").toLowerCase();
      return normalizedLabels.some((label) => text.includes(label));
    });

    if (targetButton instanceof HTMLElement) {
      targetButton.click();
      return true;
    }

    return false;
  }, contactLabels);

  logStep("Messaging thread fallback selection attempted", {
    clickedDirectThread,
    contactLabels,
    currentUrl: page.url(),
  });

  try {
    await videoButton.waitFor({ state: "visible", timeout: 30_000 });
  } catch (error) {
    const pageDebug = await page.evaluate(() => {
      const isVisible = (element: Element) => {
        const rect = element.getBoundingClientRect();
        const styles = window.getComputedStyle(element);
        return styles.display !== "none" && styles.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      };

      const headings = [...document.querySelectorAll("h1, h2, h3")]
        .filter(isVisible)
        .map((element) => element.textContent?.trim() ?? "")
        .filter(Boolean)
        .slice(0, 12);

      const buttons = [...document.querySelectorAll("button")]
        .filter(isVisible)
        .map((element) => element.textContent?.trim() ?? "")
        .filter(Boolean)
        .slice(0, 30);

      return {
        buttons,
        headings,
      };
    });

    logStep("Messaging thread selection debug", {
      ...pageDebug,
      currentUrl: page.url(),
    });

    throw error;
  }
}

async function startMessagingHubVideoCall(page: Page): Promise<void> {
  const videoButton = page.getByLabel("Start video call");
  await videoButton.waitFor({ state: "visible", timeout: 30_000 });
  await videoButton.click();
}

async function answerIncomingCall(page: Page, callType: "audio" | "video"): Promise<void> {
  await page.getByText(new RegExp(`Incoming ${callType} call`, "i")).waitFor({ state: "visible", timeout: 45_000 });
  await page.getByRole("button", { name: /answer/i }).click();
}

async function waitForActiveCallPanel(
  page: Page,
  callType: "audio" | "video",
  timeoutMs = 60_000,
): Promise<void> {
  const heading = page.getByRole("heading", {
    name: new RegExp(`${callType === "video" ? "Video" : "Audio"} call in progress`, "i"),
  });
  const endCallButton = page.getByRole("button", { name: /end call/i });
  const connectedBadge = page.getByText(/connected/i);

  await Promise.any([
    heading.waitFor({ state: "visible", timeout: timeoutMs }),
    endCallButton.waitFor({ state: "visible", timeout: timeoutMs }),
  ]);

  await Promise.any([
    connectedBadge.waitFor({ state: "visible", timeout: 15_000 }),
    endCallButton.waitFor({ state: "visible", timeout: 15_000 }),
  ]);
}

async function waitForActiveCallPanelWithFallback(params: {
  baseUrl: string;
  callType: "audio" | "video";
  label: string;
  page: Page;
}): Promise<void> {
  const { baseUrl, callType, label, page } = params;

  try {
    await waitForActiveCallPanel(page, callType, 25_000);
    logStep("Active call panel reached without refresh", { callType, label });
    return;
  } catch (error) {
    logStep("Active call panel not visible yet; retrying after dashboard refresh", {
      callType,
      error: error instanceof Error ? error.message : String(error),
      label,
    });
  }

  await openRoute(page, baseUrl, "/dashboard");
  await waitForActiveCallPanel(page, callType, 60_000);
  logStep("Active call panel reached after refresh", { callType, label });
}

async function endActiveCall(page: Page): Promise<void> {
  await page.getByRole("button", { name: /end call/i }).click();
}

async function takeScenarioScreenshot(page: Page, filePath: string): Promise<void> {
  await page.screenshot({ path: filePath, fullPage: true });
}

async function runDashboardAudioScenario(params: {
  adminClient: ReturnType<typeof createSupabaseClient>;
  artifactDir: string;
  baseUrl: string;
  caller: TesterIdentity;
  callerPage: Page;
  callee: TesterIdentity;
  calleePage: Page;
  timestamp: string;
}): Promise<ScenarioResult> {
  const { adminClient, artifactDir, baseUrl, caller, callerPage, callee, calleePage, timestamp } = params;
  const startedAt = new Date().toISOString();
  const contactLabels = getContactLabelCandidates(callee);

  logStep("Starting dashboard audio scenario", { contactLabels, startedAt });

  await openRoute(callerPage, baseUrl, "/dashboard");
  await openRoute(calleePage, baseUrl, "/dashboard");

  await openDashboardCallerAndStartCall(callerPage, contactLabels, "audio");
  logStep("Dashboard audio call started from caller UI");

  const createdSession = await waitForCallSession(adminClient, caller, callee, "audio", startedAt);
  assert.ok(createdSession.thread_id, "Dashboard audio call did not create or resolve a direct thread");
  logStep("Dashboard audio call session created", { callSessionId: createdSession.id });

  await openRoute(calleePage, baseUrl, "/dashboard");
  await answerIncomingCall(calleePage, "audio");
  logStep("Dashboard audio call answered from callee UI", { callSessionId: createdSession.id });
  await waitForCallSessionStatus(adminClient, createdSession.id, "accepted");
  logStep("Dashboard audio call reached accepted status", { callSessionId: createdSession.id });
  await waitForActiveCallPanelWithFallback({
    baseUrl,
    callType: "audio",
    label: "caller",
    page: callerPage,
  });
  await waitForActiveCallPanelWithFallback({
    baseUrl,
    callType: "audio",
    label: "callee",
    page: calleePage,
  });
  logStep("Dashboard audio call connected", { callSessionId: createdSession.id });

  const callerScreenshot = path.join(artifactDir, `daily-calls-${timestamp}-dashboard-audio-caller.png`);
  const calleeScreenshot = path.join(artifactDir, `daily-calls-${timestamp}-dashboard-audio-callee.png`);
  await takeScenarioScreenshot(callerPage, callerScreenshot);
  await takeScenarioScreenshot(calleePage, calleeScreenshot);

  await endActiveCall(callerPage);
  logStep("Dashboard audio call ended from caller UI", { callSessionId: createdSession.id });

  const endedSession = await waitForCallSessionStatus(adminClient, createdSession.id, "ended");
  const callEvents = await waitForCallEvents(adminClient, createdSession.id, {
    accepted: 1,
    created: 1,
    ended: 1,
    joined: 2,
    left: 1,
    ringing: 1,
  });
  const participantPresence = await waitForParticipantPresence(adminClient, createdSession.id, {
    joinedCount: 2,
    leftCount: 1,
  });
  const threadMessages = await waitForThreadMessages(adminClient, createdSession.thread_id!, startedAt, [
    "started a audio call",
    "accepted the audio call",
    "ended the audio call",
  ]);

  return {
    scenario: "dashboard-audio",
    callSessionId: createdSession.id,
    callType: "audio",
    startedAt,
    completedAt: new Date().toISOString(),
    threadId: createdSession.thread_id!,
    roomName: createdSession.daily_room_name,
    screenshots: [callerScreenshot, calleeScreenshot],
    notes: [
      "Started the call from the dashboard caller widget using the contact-card flow.",
      "Answered from the second authenticated browser context and confirmed both sides reached the Daily-backed active-call panel.",
      "Verified webhook-backed joined and left events plus Messaging Hub thread logs for start, answer, and end.",
    ],
    details: {
      finalStatus: endedSession.status,
      eventTypes: callEvents.map((eventRow) => eventRow.event_type),
      participantPresence,
      threadMessageCount: threadMessages.length,
    },
  };
}

async function runMessagingVideoScenario(params: {
  adminClient: ReturnType<typeof createSupabaseClient>;
  artifactDir: string;
  baseUrl: string;
  caller: TesterIdentity;
  callerPage: Page;
  callee: TesterIdentity;
  calleePage: Page;
  directThreadId: string;
  timestamp: string;
}): Promise<ScenarioResult> {
  const {
    adminClient,
    artifactDir,
    baseUrl,
    caller,
    callerPage,
    callee,
    calleePage,
    directThreadId,
    timestamp,
  } = params;
  const startedAt = new Date().toISOString();
  const contactLabels = getContactLabelCandidates(callee);

  logStep("Starting messaging video scenario", { contactLabels, startedAt });

  await openDirectMessageThread({
    baseUrl,
    contactLabels,
    page: callerPage,
    threadId: directThreadId,
  });
  await openRoute(calleePage, baseUrl, "/dashboard");
  await startMessagingHubVideoCall(callerPage);
  logStep("Messaging video call started from caller UI");

  const createdSession = await waitForCallSession(adminClient, caller, callee, "video", startedAt);
  assert.equal(createdSession.thread_id, directThreadId, "Messaging Hub video call resolved the wrong direct thread");
  logStep("Messaging video call session created", { callSessionId: createdSession.id });

  await openRoute(calleePage, baseUrl, "/dashboard");
  await answerIncomingCall(calleePage, "video");
  logStep("Messaging video call answered from callee UI", { callSessionId: createdSession.id });
  await waitForCallSessionStatus(adminClient, createdSession.id, "accepted");
  logStep("Messaging video call reached accepted status", { callSessionId: createdSession.id });
  await waitForActiveCallPanelWithFallback({
    baseUrl,
    callType: "video",
    label: "caller",
    page: callerPage,
  });
  await waitForActiveCallPanelWithFallback({
    baseUrl,
    callType: "video",
    label: "callee",
    page: calleePage,
  });
  logStep("Messaging video call connected", { callSessionId: createdSession.id });

  const callerScreenshot = path.join(artifactDir, `daily-calls-${timestamp}-messaging-video-caller.png`);
  const calleeScreenshot = path.join(artifactDir, `daily-calls-${timestamp}-messaging-video-callee.png`);
  await takeScenarioScreenshot(callerPage, callerScreenshot);
  await takeScenarioScreenshot(calleePage, calleeScreenshot);

  await endActiveCall(callerPage);
  logStep("Messaging video call ended from caller UI", { callSessionId: createdSession.id });

  const endedSession = await waitForCallSessionStatus(adminClient, createdSession.id, "ended");
  const callEvents = await waitForCallEvents(adminClient, createdSession.id, {
    accepted: 1,
    created: 1,
    ended: 1,
    joined: 2,
    left: 1,
    ringing: 1,
  });
  const participantPresence = await waitForParticipantPresence(adminClient, createdSession.id, {
    joinedCount: 2,
    leftCount: 1,
  });
  const threadMessages = await waitForThreadMessages(adminClient, directThreadId, startedAt, [
    "started a video call",
    "accepted the video call",
    "ended the video call",
  ]);

  return {
    scenario: "messaging-video",
    callSessionId: createdSession.id,
    callType: "video",
    startedAt,
    completedAt: new Date().toISOString(),
    threadId: directThreadId,
    roomName: createdSession.daily_room_name,
    screenshots: [callerScreenshot, calleeScreenshot],
    notes: [
      "Started the call from the direct-message thread header using the video-call button.",
      "Answered from another authenticated context and confirmed both sides joined the active Daily video UI.",
      "Verified actor-attributed call records in both call_events and thread_messages.",
    ],
    details: {
      finalStatus: endedSession.status,
      eventTypes: callEvents.map((eventRow) => eventRow.event_type),
      participantPresence,
      threadMessageCount: threadMessages.length,
    },
  };
}

async function run(): Promise<void> {
  const repoRoot = process.cwd();
  const envFileValues = await loadSimpleEnv(path.join(repoRoot, ".env"));
  const supabaseUrl = getRequiredConfigValue(SUPABASE_URL_KEY, envFileValues);
  const anonKey = getRequiredConfigValue(SUPABASE_ANON_KEY_KEY, envFileValues);
  const projectRef = getRequiredConfigValue(SUPABASE_PROJECT_REF_KEY, envFileValues);
  const baseUrl = getConfigValue("DAILY_CALL_BASE_URL", envFileValues) ?? DEFAULT_BASE_URL;
  const callerLabel = getConfigValue("DAILY_CALL_CALLER_LABEL", envFileValues) ?? DEFAULT_CALLER_LABEL;
  const calleeLabel = getConfigValue("DAILY_CALL_CALLEE_LABEL", envFileValues) ?? DEFAULT_CALLEE_LABEL;
  const headless = (getConfigValue("DAILY_CALL_HEADLESS", envFileValues) ?? "true").toLowerCase() !== "false";
  const vercelCookiesPath = getConfigValue("DAILY_CALL_VERCEL_COOKIES_PATH", envFileValues);

  const testerAccounts = await loadTesterAccounts(path.join(repoRoot, "tester-accounts.local.md"));
  const callerAccount = testerAccounts.get(callerLabel);
  const calleeAccount = testerAccounts.get(calleeLabel);

  if (!callerAccount) {
    throw new Error(`Tester account "${callerLabel}" was not found in tester-accounts.local.md`);
  }
  if (!calleeAccount) {
    throw new Error(`Tester account "${calleeLabel}" was not found in tester-accounts.local.md`);
  }

  const serviceRoleKey = await resolveServiceRoleKey(repoRoot, projectRef, envFileValues);
  const adminClient = createSupabaseClient(supabaseUrl, serviceRoleKey);
  const callerIdentity = await loadTesterIdentity(adminClient, callerAccount);
  const calleeIdentity = await loadTesterIdentity(adminClient, calleeAccount);

  assert.equal(
    callerIdentity.familyId,
    calleeIdentity.familyId,
    "Caller and callee must already belong to the same family for call verification",
  );

  const directThreadId = await ensureDirectMessageThread(adminClient, callerIdentity, calleeIdentity);
  await clearOpenCallSessions(adminClient, callerIdentity, calleeIdentity);

  const artifactDir = path.join(repoRoot, "docs", "acquisition", "diligence", "evidence");
  await mkdir(artifactDir, { recursive: true });
  const localServer = await ensureLocalAppServer(repoRoot, baseUrl);
  const callerAuth = await createAuthenticatedClient(supabaseUrl, anonKey, callerAccount.email, callerAccount.password);
  const calleeAuth = await createAuthenticatedClient(supabaseUrl, anonKey, calleeAccount.email, calleeAccount.password);
  const browser = await createBrowser(headless);
  const timestamp = makeTimestampSlug();

  const callerContext = await createAuthenticatedContext({
    baseUrl,
    browser,
    projectRef,
    session: callerAuth.session,
    vercelCookiesPath: vercelCookiesPath ? path.resolve(repoRoot, vercelCookiesPath) : undefined,
  });
  const calleeContext = await createAuthenticatedContext({
    baseUrl,
    browser,
    projectRef,
    session: calleeAuth.session,
    vercelCookiesPath: vercelCookiesPath ? path.resolve(repoRoot, vercelCookiesPath) : undefined,
  });

  const callerPage = await callerContext.newPage();
  const calleePage = await calleeContext.newPage();
  attachPageDiagnostics(callerPage, "caller");
  attachPageDiagnostics(calleePage, "callee");
  const scenarios: ScenarioResult[] = [];

  try {
    logStep("Bootstrapping authenticated caller and callee pages", {
      baseUrl,
      caller: callerAccount.email,
      callee: calleeAccount.email,
    });

    await bootstrapAuthenticatedApp(callerPage, baseUrl);
    await bootstrapAuthenticatedApp(calleePage, baseUrl);

    scenarios.push(
      await runDashboardAudioScenario({
        adminClient,
        artifactDir,
        baseUrl,
        caller: callerIdentity,
        callerPage,
        callee: calleeIdentity,
        calleePage,
        timestamp,
      }),
    );

    await callerPage.close();
    await calleePage.close();

    const messagingCallerPage = await callerContext.newPage();
    const messagingCalleePage = await calleeContext.newPage();
    attachPageDiagnostics(messagingCallerPage, "caller-messaging");
    attachPageDiagnostics(messagingCalleePage, "callee-messaging");

    await bootstrapAuthenticatedApp(messagingCallerPage, baseUrl);
    await bootstrapAuthenticatedApp(messagingCalleePage, baseUrl);

    scenarios.push(
      await runMessagingVideoScenario({
        adminClient,
        artifactDir,
        baseUrl,
        caller: callerIdentity,
        callerPage: messagingCallerPage,
        callee: calleeIdentity,
        calleePage: messagingCalleePage,
        directThreadId,
        timestamp,
      }),
    );

    await messagingCallerPage.close();
    await messagingCalleePage.close();
  } finally {
    await callerContext.close();
    await calleeContext.close();
    await browser.close();
    await clearOpenCallSessions(adminClient, callerIdentity, calleeIdentity);
    localServer?.kill("SIGTERM");
  }

  const report: VerificationReport = {
    timestamp: new Date().toISOString(),
    environment: `Current client ${baseUrl} against production Supabase backend ${projectRef}`,
    baseUrl,
    caller: callerAccount.email,
    callee: calleeAccount.email,
    scenarios,
  };

  const reportPath = path.join(artifactDir, `daily-calls-${timestamp}-report.json`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  logStep("Daily call verification completed", {
    reportPath,
    scenarios: scenarios.map((scenario) => ({
      callSessionId: scenario.callSessionId,
      scenario: scenario.scenario,
    })),
  });
}

run().catch((error) => {
  console.error(`[verify-daily-calls] ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  process.exitCode = 1;
});
