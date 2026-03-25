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

interface TesterAccount {
  label: string;
  email: string;
  password: string;
}

interface ProfileRow {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  co_parent_id: string | null;
  account_role: string | null;
}

interface FamilyMemberRow {
  id: string;
  family_id: string | null;
  user_id: string | null;
  profile_id: string | null;
  primary_parent_id: string | null;
  role: "parent" | "guardian" | "third_party" | "child";
  status: string | null;
  relationship_label: string | null;
  created_at: string;
}

interface InvitationRow {
  id: string;
  token: string;
  family_id: string | null;
  inviter_id: string;
  invitee_email: string;
  invitation_type: "co_parent" | "third_party";
  role: string | null;
  relationship?: string | null;
  status: string;
  created_at: string;
  updated_at: string | null;
}

interface ThirdPartyInviteRpcResult {
  ok: boolean;
  code?: string;
  message?: string;
  data?: {
    id?: string;
    token?: string;
    invitee_email?: string;
    status?: string;
    family_id?: string | null;
    expires_at?: string;
  } | null;
}

interface TesterState {
  account: TesterAccount;
  userId: string;
  profile: ProfileRow;
  familyMembers: FamilyMemberRow[];
  activeFamilyId: string | null;
  childIds: string[];
}

interface ResendListEmail {
  id: string;
  to: string[];
  created_at: string;
  subject: string;
  last_event: string | null;
}

interface ResendEmailDetail extends ResendListEmail {
  html: string | null;
  text: string | null;
}

interface ScenarioReport {
  scenario: "co_parent" | "third_party";
  inviteeEmail: string;
  invitationId: string;
  invitationStatus: string;
  emailMessageId: string;
  emailLastEvent: string | null;
  familyId: string;
  acceptedRole: string;
  acceptedRoute: string;
  relationshipLabel: string | null;
  notes: string[];
  screenshots: string[];
}

interface VerificationReport {
  timestamp: string;
  environment: string;
  baseUrl: string;
  testerInviter: string;
  testerInvitee: string;
  notes: string[];
  scenarios: ScenarioReport[];
}

const DEFAULT_BASE_URL = "http://127.0.0.1:4174";
const DEFAULT_INVITER_LABEL = "Parent A";
const DEFAULT_INVITEE_LABEL = "Parent B";
const SUPABASE_URL_KEY = "VITE_SUPABASE_URL";
const SUPABASE_ANON_KEY_KEY = "VITE_SUPABASE_PUBLISHABLE_KEY";
const SUPABASE_PROJECT_REF_KEY = "VITE_SUPABASE_PROJECT_ID";
const RESEND_API_KEY = "RESEND_API_KEY";
const execFile = promisify(execFileCallback);

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
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

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
    throw new Error(`Unable to start the local app server: ${error instanceof Error ? error.message : String(error)}\n${stderrBuffer}`);
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

async function loadTesterState(
  adminClient: ReturnType<typeof createSupabaseClient>,
  account: TesterAccount,
): Promise<TesterState> {
  const userId = await getAuthUserIdByEmail(adminClient, account.email);

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, user_id, email, full_name, co_parent_id, account_role")
    .eq("user_id", userId)
    .single<ProfileRow>();

  if (profileError || !profile) {
    throw new Error(`Unable to load profile for ${account.email}: ${profileError?.message ?? "profile missing"}`);
  }

  const { data: familyMembers, error: familyMemberError } = await adminClient
    .from("family_members")
    .select("id, family_id, user_id, profile_id, primary_parent_id, role, status, relationship_label, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .returns<FamilyMemberRow[]>();

  if (familyMemberError) {
    throw new Error(`Unable to load family members for ${account.email}: ${familyMemberError.message}`);
  }

  const { data: parentChildren, error: parentChildrenError } = await adminClient
    .from("parent_children")
    .select("child_id")
    .eq("parent_id", profile.id);

  if (parentChildrenError) {
    throw new Error(`Unable to load children for ${account.email}: ${parentChildrenError.message}`);
  }

  const activeFamilyId =
    familyMembers?.find((member) => member.family_id && member.status === "active")?.family_id
    ?? familyMembers?.find((member) => member.family_id)?.family_id
    ?? null;

  return {
    account,
    userId,
    profile,
    familyMembers: familyMembers ?? [],
    activeFamilyId,
    childIds: (parentChildren ?? []).map((row) => row.child_id as string),
  };
}

async function resetInviteeState(
  adminClient: ReturnType<typeof createSupabaseClient>,
  inviterState: TesterState,
  inviteeState: TesterState,
): Promise<void> {
  const inviteeFamilyMemberIds = inviteeState.familyMembers.map((member) => member.id);
  if (inviteeFamilyMemberIds.length > 0) {
    const { error } = await adminClient
      .from("family_members")
      .delete()
      .in("id", inviteeFamilyMemberIds);

    if (error) {
      throw new Error(`Unable to reset invitee family members: ${error.message}`);
    }
  }

  const { error: inviterProfileResetError } = await adminClient
    .from("profiles")
    .update({ co_parent_id: null })
    .eq("id", inviterState.profile.id);

  if (inviterProfileResetError) {
    throw new Error(`Unable to reset inviter co_parent_id: ${inviterProfileResetError.message}`);
  }

  const { error: inviteeProfileResetError } = await adminClient
    .from("profiles")
    .update({ co_parent_id: null })
    .eq("id", inviteeState.profile.id);

  if (inviteeProfileResetError) {
    throw new Error(`Unable to reset invitee co_parent_id: ${inviteeProfileResetError.message}`);
  }

  if (inviterState.activeFamilyId) {
    const { error: familyResetError } = await adminClient
      .from("family_members")
      .update({ primary_parent_id: inviterState.profile.id })
      .eq("family_id", inviterState.activeFamilyId)
      .in("role", ["parent", "guardian"]);

    if (familyResetError) {
      throw new Error(`Unable to restore inviter primary_parent_id: ${familyResetError.message}`);
    }
  }

  const { error: pendingInviteDeleteError } = await adminClient
    .from("invitations")
    .delete()
    .eq("inviter_id", inviterState.profile.id)
    .eq("invitee_email", inviteeState.account.email.toLowerCase());

  if (pendingInviteDeleteError) {
    throw new Error(`Unable to clear verifier invitations: ${pendingInviteDeleteError.message}`);
  }
}

async function pollForResult<T>(
  description: string,
  fn: () => Promise<T | null>,
  timeoutMs = 30_000,
  intervalMs = 1_000,
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

async function listResendEmails(apiKey: string): Promise<ResendListEmail[]> {
  const response = await fetch("https://api.resend.com/emails", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to list Resend emails: ${response.status} ${await response.text()}`);
  }

  const body = await response.json() as { data: ResendListEmail[] };
  return body.data ?? [];
}

async function getResendEmail(apiKey: string, emailId: string): Promise<ResendEmailDetail> {
  const response = await fetch(`https://api.resend.com/emails/${emailId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch Resend email ${emailId}: ${response.status} ${await response.text()}`);
  }

  return await response.json() as ResendEmailDetail;
}

async function pollResendInviteEmail(
  resendApiKey: string,
  inviteeEmail: string,
  subjectFragment: string,
  createdAfter: Date,
): Promise<ResendEmailDetail> {
  return pollForResult(`a delivered Resend email for ${inviteeEmail}`, async () => {
    const emails = await listResendEmails(resendApiKey);
    const matching = emails
      .filter((email) =>
        email.to.some((recipient) => recipient.toLowerCase() === inviteeEmail.toLowerCase()) &&
        email.subject.includes(subjectFragment) &&
        new Date(email.created_at).getTime() >= createdAfter.getTime(),
      )
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());

    const candidate = matching[0];
    if (!candidate) {
      return null;
    }

    const detail = await getResendEmail(resendApiKey, candidate.id);
    return detail.last_event === "delivered" ? detail : null;
  }, 45_000, 2_000);
}

function extractInviteLink(email: ResendEmailDetail): string {
  const bodies = [email.text, email.html].filter(Boolean) as string[];

  for (const body of bodies) {
    const match = body.match(/https:\/\/[^\s"'<>]+\/accept-invite\?[^\s"'<>]+/i);
    if (match?.[0]) {
      return match[0].replace(/&amp;/g, "&");
    }
  }

  throw new Error(`Unable to extract invite link from Resend email ${email.id}`);
}

function rewriteInviteLinkOrigin(inviteLink: string, baseUrl: string): string {
  const original = new URL(inviteLink);
  const targetOrigin = new URL(baseUrl).origin;
  const rewritten = new URL(`${original.pathname}${original.search}`, `${targetOrigin}/`);
  return rewritten.toString();
}

async function dismissNonBlockingPrompts(page: Page): Promise<void> {
  const buttonNames = [
    "Not now",
    "Accept all",
    "Accept",
    "Close",
  ];

  for (const name of buttonNames) {
    const button = page.getByRole("button", { name }).first();
    try {
      if (await button.isVisible({ timeout: 500 })) {
        await button.click();
      }
    } catch {
      // Ignore optional overlays.
    }
  }
}

async function sendCoParentInvite(
  authClient: Awaited<ReturnType<typeof createAuthenticatedClient>>["client"],
  inviterState: TesterState,
  inviteeEmail: string,
): Promise<InvitationRow> {
  const { data: invitation, error: insertError } = await authClient
    .from("invitations")
    .insert({
      inviter_id: inviterState.profile.id,
      family_id: inviterState.activeFamilyId,
      invitee_email: inviteeEmail.toLowerCase(),
      invitation_type: "co_parent",
      role: "parent",
    })
    .select("id, token, family_id, inviter_id, invitee_email, invitation_type, role, status, created_at, updated_at")
    .single<InvitationRow>();

  if (insertError || !invitation) {
    throw new Error(`Unable to create the co-parent invitation: ${insertError?.message ?? "missing invitation"}`);
  }

  const { error: emailError } = await authClient.functions.invoke("send-coparent-invite", {
    body: {
      inviteeEmail: inviteeEmail.toLowerCase(),
      inviterName: inviterState.profile.full_name || inviterState.profile.email || "Your co-parent",
      token: invitation.token,
    },
  });

  if (emailError) {
    throw new Error(`Unable to send the co-parent invitation email: ${emailError.message}`);
  }

  return invitation;
}

async function sendThirdPartyInvite(
  adminClient: ReturnType<typeof createSupabaseClient>,
  authClient: Awaited<ReturnType<typeof createAuthenticatedClient>>["client"],
  inviterState: TesterState,
  inviteeEmail: string,
): Promise<InvitationRow> {
  const primaryParentId = inviterState.familyMembers.find((member) => member.primary_parent_id)?.primary_parent_id
    ?? inviterState.profile.id;

  const { data: rpcData, error: rpcError } = await authClient.rpc("rpc_create_third_party_invite", {
    p_invitee_email: inviteeEmail.toLowerCase(),
    p_relationship: "grandparent",
    p_child_ids: inviterState.childIds,
  });

  if (rpcError) {
    throw new Error(`Unable to create the third-party invitation: ${rpcError.message}`);
  }

  const result = rpcData as ThirdPartyInviteRpcResult;
  if (!result.ok || !result.data?.token || !result.data?.id) {
    throw new Error(result.message ?? "Unable to create the third-party invitation");
  }

  const { data: invitation, error: invitationLookupError } = await adminClient
    .from("invitations")
    .select("id, token, family_id, inviter_id, invitee_email, invitation_type, role, relationship, status, created_at, updated_at")
    .eq("id", result.data.id)
    .single<InvitationRow>();

  if (invitationLookupError || !invitation) {
    throw new Error(`Unable to load the third-party invitation after creation: ${invitationLookupError?.message ?? "missing invitation"}`);
  }

  const { error: emailError } = await authClient.functions.invoke("send-third-party-invite", {
    body: {
      inviteeEmail: inviteeEmail.toLowerCase(),
      inviterName: inviterState.profile.full_name || inviterState.profile.email || "A family member",
      token: invitation.token,
      primaryParentId,
      relationship: "Grandparent",
    },
  });

  if (emailError) {
    throw new Error(`Unable to send the third-party invitation email: ${emailError.message}`);
  }

  return invitation;
}

async function createInviteeContext(browser: Awaited<ReturnType<typeof chromium.launch>>): Promise<BrowserContext> {
  return browser.newContext({
    viewport: { width: 1440, height: 1200 },
    serviceWorkers: "block",
  });
}

async function acceptInviteAsExistingUser(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  inviteLink: string,
  baseUrl: string,
  inviteeAccount: TesterAccount,
  expectedButtonName: string,
  screenshotPath: string,
): Promise<string> {
  const context = await createInviteeContext(browser);
  const page = await context.newPage();

  try {
    await page.goto(inviteLink, { waitUntil: "domcontentloaded" });
    await dismissNonBlockingPrompts(page);

    await page.getByRole("button", { name: "Sign in" }).click();
    await page.locator("#email").waitFor({ state: "visible", timeout: 30_000 });
    await page.locator("#email").fill(inviteeAccount.email);
    await page.locator("#password").fill(inviteeAccount.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.waitForURL(/accept-invite|dashboard/, { timeout: 30_000 });
    await page.goto(inviteLink, { waitUntil: "domcontentloaded" });
    await dismissNonBlockingPrompts(page);
    const acceptButton = page.getByRole("button", { name: expectedButtonName });
    await acceptButton.waitFor({ state: "visible", timeout: 30_000 });
    await Promise.all([
      page.waitForURL((url) => new URL(url).pathname === "/dashboard", { timeout: 30_000 }),
      acceptButton.click(),
    ]);
    await dismissNonBlockingPrompts(page);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    return page.url();
  } finally {
    await context.close();
  }
}

async function assertCoParentAcceptance(
  adminClient: ReturnType<typeof createSupabaseClient>,
  inviterState: TesterState,
  inviteeState: TesterState,
  invitationId: string,
): Promise<{ familyId: string; role: string }> {
  const { data: invitation, error: invitationError } = await adminClient
    .from("invitations")
    .select("id, family_id, status")
    .eq("id", invitationId)
    .single<{ id: string; family_id: string | null; status: string }>();

  if (invitationError || !invitation) {
    throw new Error(`Unable to load accepted co-parent invitation ${invitationId}: ${invitationError?.message ?? "missing invitation"}`);
  }

  assert.equal(invitation.status, "accepted", "Co-parent invitation did not reach accepted status");
  assert.equal(invitation.family_id, inviterState.activeFamilyId, "Co-parent invitation family_id did not match the inviter's family");

  const refreshedInviter = await loadTesterState(adminClient, inviterState.account);
  const refreshedInvitee = await loadTesterState(adminClient, inviteeState.account);
  const acceptedMembership = refreshedInvitee.familyMembers.find((member) => member.status === "active");

  assert.ok(acceptedMembership?.family_id, "Invitee did not receive an active family membership");
  assert.equal(acceptedMembership.family_id, inviterState.activeFamilyId, "Invitee landed in the wrong family");
  assert.equal(acceptedMembership.role, "parent", "Invitee did not receive the parent role");
  assert.equal(refreshedInviter.profile.co_parent_id, refreshedInvitee.profile.id, "Inviter profile did not link to the accepted co-parent");
  assert.equal(refreshedInvitee.profile.co_parent_id, refreshedInviter.profile.id, "Invitee profile did not link back to the inviter");

  return {
    familyId: acceptedMembership.family_id,
    role: acceptedMembership.role,
  };
}

async function assertThirdPartyAcceptance(
  adminClient: ReturnType<typeof createSupabaseClient>,
  inviterState: TesterState,
  inviteeState: TesterState,
  invitationId: string,
  expectedRelationshipLabel: string,
): Promise<{ familyId: string; role: string; relationshipLabel: string | null }> {
  const { data: invitation, error: invitationError } = await adminClient
    .from("invitations")
    .select("id, family_id, status")
    .eq("id", invitationId)
    .single<{ id: string; family_id: string | null; status: string }>();

  if (invitationError || !invitation) {
    throw new Error(`Unable to load accepted third-party invitation ${invitationId}: ${invitationError?.message ?? "missing invitation"}`);
  }

  assert.equal(invitation.status, "accepted", "Third-party invitation did not reach accepted status");
  assert.equal(invitation.family_id, inviterState.activeFamilyId, "Third-party invitation family_id did not match the inviter's family");

  const refreshedInviter = await loadTesterState(adminClient, inviterState.account);
  const refreshedInvitee = await loadTesterState(adminClient, inviteeState.account);
  const acceptedMembership = refreshedInvitee.familyMembers.find((member) => member.status === "active");

  assert.ok(acceptedMembership?.family_id, "Invitee did not receive an active family membership");
  assert.equal(acceptedMembership.family_id, refreshedInviter.activeFamilyId, "Invitee landed in the wrong family");
  assert.equal(acceptedMembership.role, "third_party", "Invitee did not receive the third_party role");
  assert.equal(acceptedMembership.relationship_label, expectedRelationshipLabel, "Invitee received the wrong relationship label");
  assert.equal(refreshedInvitee.profile.co_parent_id, null, "Third-party acceptance should not set co_parent_id");

  return {
    familyId: acceptedMembership.family_id,
    role: acceptedMembership.role,
    relationshipLabel: acceptedMembership.relationship_label,
  };
}

async function run(): Promise<void> {
  const repoRoot = process.cwd();
  const envFileValues = await loadSimpleEnv(path.join(repoRoot, ".env"));
  const supabaseUrl = getRequiredConfigValue(SUPABASE_URL_KEY, envFileValues);
  const anonKey = getRequiredConfigValue(SUPABASE_ANON_KEY_KEY, envFileValues);
  const projectRef = getRequiredConfigValue(SUPABASE_PROJECT_REF_KEY, envFileValues);
  const resendApiKey = getRequiredConfigValue(RESEND_API_KEY, envFileValues);
  const baseUrl = getConfigValue("INVITE_VERIFICATION_BASE_URL", envFileValues) ?? DEFAULT_BASE_URL;
  const inviterLabel = getConfigValue("INVITE_VERIFICATION_INVITER_LABEL", envFileValues) ?? DEFAULT_INVITER_LABEL;
  const inviteeLabel = getConfigValue("INVITE_VERIFICATION_INVITEE_LABEL", envFileValues) ?? DEFAULT_INVITEE_LABEL;
  const headless = (getConfigValue("INVITE_VERIFICATION_HEADLESS", envFileValues) ?? "true").toLowerCase() !== "false";

  const testerAccounts = await loadTesterAccounts(path.join(repoRoot, "tester-accounts.local.md"));
  const inviterAccount = testerAccounts.get(inviterLabel);
  const inviteeAccount = testerAccounts.get(inviteeLabel);

  if (!inviterAccount) {
    throw new Error(`Tester account "${inviterLabel}" was not found in tester-accounts.local.md`);
  }
  if (!inviteeAccount) {
    throw new Error(`Tester account "${inviteeLabel}" was not found in tester-accounts.local.md`);
  }

  const serviceRoleKey = await resolveServiceRoleKey(repoRoot, projectRef, envFileValues);
  const adminClient = createSupabaseClient(supabaseUrl, serviceRoleKey);
  const initialInviterState = await loadTesterState(adminClient, inviterAccount);
  const initialInviteeState = await loadTesterState(adminClient, inviteeAccount);

  assert.ok(initialInviterState.activeFamilyId, `Inviter ${inviterAccount.email} must already belong to a family`);
  assert.ok(initialInviterState.childIds.length > 0, `Inviter ${inviterAccount.email} must have at least one child for third-party invite verification`);

  await resetInviteeState(adminClient, initialInviterState, initialInviteeState);

  const artifactDir = path.join(repoRoot, "docs", "acquisition", "diligence", "evidence");
  await mkdir(artifactDir, { recursive: true });

  const localServer = await ensureLocalAppServer(repoRoot, baseUrl);
  const inviterAuth = await createAuthenticatedClient(
    supabaseUrl,
    anonKey,
    inviterAccount.email,
    inviterAccount.password,
  );
  const browser = await chromium.launch({ headless });

  const timestamp = makeTimestampSlug();
  const reportNotes = [
    `Inviter: ${inviterAccount.email}`,
    `Invitee: ${inviteeAccount.email}`,
    `Invite creation and acceptance used the live production backend and live Resend delivery. Browser acceptance used the local current client at ${new URL(baseUrl).origin} because the public frontend targets are not reliable enough for repeatable QA.`,
  ];

  try {
    const coParentStartedAt = new Date(Date.now() - 2_000);
    console.log(`[verify-invites] Sending fresh co-parent invite to ${inviteeAccount.email}`);
    const coParentInvitation = await sendCoParentInvite(
      inviterAuth.client,
      initialInviterState,
      inviteeAccount.email,
    );
    const coParentEmail = await pollResendInviteEmail(
      resendApiKey,
      inviteeAccount.email,
      "invited you to co-parent on CoParrent",
      coParentStartedAt,
    );
    assert.equal(coParentEmail.last_event, "delivered", "Co-parent invite email was not delivered to the tester inbox");
    const coParentInviteLink = rewriteInviteLinkOrigin(extractInviteLink(coParentEmail), baseUrl);
    const coParentScreenshot = path.join(artifactDir, `invite-verification-${timestamp}-coparent-dashboard.png`);
    const coParentFinalUrl = await acceptInviteAsExistingUser(
      browser,
      coParentInviteLink,
      baseUrl,
      inviteeAccount,
      "Accept & Link Accounts",
      coParentScreenshot,
    );
    const coParentAssertion = await assertCoParentAcceptance(
      adminClient,
      initialInviterState,
      initialInviteeState,
      coParentInvitation.id,
    );

    await resetInviteeState(adminClient, initialInviterState, initialInviteeState);

    const thirdPartyStartedAt = new Date(Date.now() - 2_000);
    console.log(`[verify-invites] Sending fresh third-party invite to ${inviteeAccount.email}`);
    const thirdPartyInvitation = await sendThirdPartyInvite(
      adminClient,
      inviterAuth.client,
      initialInviterState,
      inviteeAccount.email,
    );
    const thirdPartyEmail = await pollResendInviteEmail(
      resendApiKey,
      inviteeAccount.email,
      "invited you to join their family on CoParrent",
      thirdPartyStartedAt,
    );
    assert.equal(thirdPartyEmail.last_event, "delivered", "Third-party invite email was not delivered to the tester inbox");
    const thirdPartyInviteLink = rewriteInviteLinkOrigin(extractInviteLink(thirdPartyEmail), baseUrl);
    const thirdPartyScreenshot = path.join(artifactDir, `invite-verification-${timestamp}-third-party-dashboard.png`);
    const thirdPartyFinalUrl = await acceptInviteAsExistingUser(
      browser,
      thirdPartyInviteLink,
      baseUrl,
      inviteeAccount,
      "Accept & Join Family",
      thirdPartyScreenshot,
    );
    const thirdPartyAssertion = await assertThirdPartyAcceptance(
      adminClient,
      initialInviterState,
      initialInviteeState,
      thirdPartyInvitation.id,
      "grandparent",
    );

    const report: VerificationReport = {
      timestamp,
      environment: "Local current client against the production Supabase backend",
      baseUrl,
      testerInviter: inviterAccount.email,
      testerInvitee: inviteeAccount.email,
      notes: reportNotes,
      scenarios: [
        {
          scenario: "co_parent",
          inviteeEmail: inviteeAccount.email,
          invitationId: coParentInvitation.id,
          invitationStatus: "accepted",
          emailMessageId: coParentEmail.id,
          emailLastEvent: coParentEmail.last_event,
          familyId: coParentAssertion.familyId,
          acceptedRole: coParentAssertion.role,
          acceptedRoute: new URL(coParentFinalUrl).pathname,
          relationshipLabel: null,
          notes: [
            "Invitee was reset to a no-family state before the run so the live acceptance path started clean.",
            "The email body still points to https://coparrent.com, so the verifier rewrote the accept URL to the local current client before browser acceptance.",
            "The final acceptance step clicked the real Accept Invite page button so the native accept_coparent_invitation RPC executed through the current client.",
          ],
          screenshots: [coParentScreenshot],
        },
        {
          scenario: "third_party",
          inviteeEmail: inviteeAccount.email,
          invitationId: thirdPartyInvitation.id,
          invitationStatus: "accepted",
          emailMessageId: thirdPartyEmail.id,
          emailLastEvent: thirdPartyEmail.last_event,
          familyId: thirdPartyAssertion.familyId,
          acceptedRole: thirdPartyAssertion.role,
          acceptedRoute: new URL(thirdPartyFinalUrl).pathname,
          relationshipLabel: thirdPartyAssertion.relationshipLabel,
          notes: [
            "The same tester invitee account was reset again before the third-party flow so the role assignment was isolated from the co-parent pass.",
            "The invitation record was created through the native rpc_create_third_party_invite RPC and delivered through the live send-third-party-invite function.",
            "The final acceptance step clicked the real Accept Invite page button so the native accept_third_party_invitation RPC executed through the current client.",
          ],
          screenshots: [thirdPartyScreenshot],
        },
      ],
    };

    const reportPath = path.join(artifactDir, `invite-verification-${timestamp}-report.json`);
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    console.log("[verify-invites] Verification succeeded");
    console.log(`[verify-invites] Report: ${reportPath}`);
    for (const scenario of report.scenarios) {
      console.log(`[verify-invites] ${scenario.scenario} invitation id: ${scenario.invitationId}`);
      scenario.screenshots.forEach((screenshotPath) => {
        console.log(`[verify-invites] Screenshot: ${screenshotPath}`);
      });
    }
  } finally {
    await browser.close();
    await resetInviteeState(adminClient, initialInviterState, initialInviteeState);
    localServer?.kill("SIGTERM");
  }
}

run().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(`[verify-invites] FAILED\n${message}`);
  process.exitCode = 1;
});
