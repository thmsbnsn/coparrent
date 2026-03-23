import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";

import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";

interface TesterAccount {
  label: string;
  email: string;
  password: string;
}

interface ThreadResponse {
  success: boolean;
  error?: string;
  thread?: {
    id: string;
    name: string | null;
    thread_type: "family_channel" | "direct_message" | "group_chat";
  };
  primary_parent_id?: string;
  profile_id?: string;
  role?: string;
}

interface VerificationReport {
  timestamp: string;
  environment: string;
  baseUrl: string;
  allowedOrigin: string;
  previewOrigin: string | null;
  tester: string;
  partner: string;
  familyChannelThreadId: string;
  directMessageThreadId: string;
  localhostBlocked: boolean;
  notes: string[];
  screenshots: string[];
}

const SUPABASE_URL_KEY = "VITE_SUPABASE_URL";
const SUPABASE_ANON_KEY_KEY = "VITE_SUPABASE_PUBLISHABLE_KEY";
const DEFAULT_BASE_URL = "https://coparrent.com";
const DEFAULT_TESTER_LABEL = "Parent A";
const DEFAULT_PARTNER_LABEL = "Parent B";
const LOCALHOST_ORIGIN = "http://127.0.0.1:4173";
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

async function createAuthenticatedClient(
  supabaseUrl: string,
  anonKey: string,
  email: string,
  password: string,
) {
  const client = createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

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

async function expectPreflight(
  functionUrl: string,
  origin: string,
  expectedStatus: number,
  expectedAllowOrigin: string | null,
): Promise<void> {
  const response = await fetch(functionUrl, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization, x-client-info, apikey, content-type",
    },
  });

  assert.equal(
    response.status,
    expectedStatus,
    `Expected ${expectedStatus} preflight response for ${origin}, received ${response.status}`,
  );

  const actualAllowOrigin = response.headers.get("access-control-allow-origin");
  assert.equal(
    actualAllowOrigin,
    expectedAllowOrigin,
    `Unexpected Access-Control-Allow-Origin for ${origin}`,
  );
}

async function invokeCreateThread(
  functionUrl: string,
  anonKey: string,
  accessToken: string,
  origin: string,
  body: Record<string, unknown>,
): Promise<ThreadResponse> {
  const response = await fetch(functionUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: anonKey,
      Origin: origin,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const responseBody = (await response.json()) as ThreadResponse;

  assert.equal(
    response.status,
    200,
    `Expected successful create-message-thread response, received ${response.status}: ${JSON.stringify(responseBody)}`,
  );
  assert.equal(response.headers.get("access-control-allow-origin"), origin, "Origin echo header did not match the allowed origin");
  assert.equal(responseBody.success, true, `create-message-thread returned unsuccessful response: ${responseBody.error ?? "unknown error"}`);

  return responseBody;
}

function makeTimestampSlug(date = new Date()): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
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
    console.warn(
      `[verify-messaging-hub] Unable to auto-discover the latest Vercel deployment, falling back to ${DEFAULT_BASE_URL}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  return DEFAULT_BASE_URL;
}

async function run(): Promise<void> {
  const repoRoot = process.cwd();
  const envFileValues = await loadSimpleEnv(path.join(repoRoot, ".env"));

  const supabaseUrl = getRequiredConfigValue(SUPABASE_URL_KEY, envFileValues);
  const anonKey = getRequiredConfigValue(SUPABASE_ANON_KEY_KEY, envFileValues);
  const baseUrl =
    getConfigValue("MESSAGING_HUB_BASE_URL", envFileValues) ?? (await resolveDefaultBaseUrl(repoRoot));
  const allowedOrigin = getConfigValue("MESSAGING_HUB_ALLOWED_ORIGIN", envFileValues) ?? new URL(baseUrl).origin;
  const previewOrigin = getConfigValue("MESSAGING_HUB_PREVIEW_ORIGIN", envFileValues)
    ?? "https://coparrent-git-main-thmsbnsn.vercel.app";
  const expectLocalhostBlocked =
    (getConfigValue("MESSAGING_HUB_EXPECT_LOCALHOST_BLOCKED", envFileValues) ?? "true").toLowerCase() !== "false";
  const testerLabel = getConfigValue("MESSAGING_HUB_TESTER_LABEL", envFileValues) ?? DEFAULT_TESTER_LABEL;
  const partnerLabel = getConfigValue("MESSAGING_HUB_PARTNER_LABEL", envFileValues) ?? DEFAULT_PARTNER_LABEL;

  const testerAccounts = await loadTesterAccounts(path.join(repoRoot, "tester-accounts.local.md"));
  const tester = testerAccounts.get(testerLabel);
  const partner = testerAccounts.get(partnerLabel);

  if (!tester) {
    throw new Error(`Tester account "${testerLabel}" was not found in tester-accounts.local.md`);
  }

  if (!partner) {
    throw new Error(`Partner account "${partnerLabel}" was not found in tester-accounts.local.md`);
  }

  const artifactDir = path.join(repoRoot, "output", "playwright");
  await mkdir(artifactDir, { recursive: true });

  const timestamp = makeTimestampSlug();
  const functionUrl = new URL("/functions/v1/create-message-thread", supabaseUrl).toString();

  console.log(`[verify-messaging-hub] Using base URL ${baseUrl}`);
  console.log(`[verify-messaging-hub] Verifying edge function ${functionUrl}`);
  console.log(`[verify-messaging-hub] Signing in as ${tester.email}`);

  const { client, session } = await createAuthenticatedClient(
    supabaseUrl,
    anonKey,
    tester.email,
    tester.password,
  );

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("id, co_parent_id")
    .eq("user_id", session.user.id)
    .single();

  if (profileError || !profile) {
    throw new Error(`Unable to load tester profile: ${profileError?.message ?? "profile missing"}`);
  }

  let partnerProfileId = profile.co_parent_id;
  let partnerDisplayName = partner.email;

  if (!partnerProfileId) {
    console.log("[verify-messaging-hub] Tester profile has no co_parent_id; resolving partner profile by signing in the partner account");
    const partnerAuth = await createAuthenticatedClient(
      supabaseUrl,
      anonKey,
      partner.email,
      partner.password,
    );
    const { data: partnerProfile, error: partnerProfileError } = await partnerAuth.client
      .from("profiles")
      .select("id, full_name, email")
      .eq("user_id", partnerAuth.session.user.id)
      .single();

    if (partnerProfileError || !partnerProfile) {
      throw new Error(`Unable to resolve partner profile: ${partnerProfileError?.message ?? "profile missing"}`);
    }

    partnerProfileId = partnerProfile.id;
    partnerDisplayName = partnerProfile.full_name || partnerProfile.email || partner.email;
  }

  assert.ok(partnerProfileId, "A second family member profile is required for thread verification");

  console.log("[verify-messaging-hub] Verifying allowed production preflight");
  await expectPreflight(functionUrl, allowedOrigin, 204, allowedOrigin);

  if (previewOrigin) {
    console.log(`[verify-messaging-hub] Verifying preview-origin preflight for ${previewOrigin}`);
    await expectPreflight(functionUrl, previewOrigin, 204, previewOrigin);
  }

  if (expectLocalhostBlocked) {
    console.log("[verify-messaging-hub] Verifying localhost preflight is blocked");
    await expectPreflight(functionUrl, LOCALHOST_ORIGIN, 403, null);
  }

  console.log("[verify-messaging-hub] Ensuring the family channel can be created through the deployed edge function");
  const familyChannelResult = await invokeCreateThread(
    functionUrl,
    anonKey,
    session.access_token,
    allowedOrigin,
    { thread_type: "family_channel" },
  );

  assert.ok(familyChannelResult.thread?.id, "Family channel response did not include a thread id");
  assert.equal(familyChannelResult.thread?.thread_type, "family_channel", "Family channel response returned the wrong thread type");

  console.log(`[verify-messaging-hub] Creating or retrieving the direct-message thread with ${partnerDisplayName}`);
  const directMessageResult = await invokeCreateThread(
    functionUrl,
    anonKey,
    session.access_token,
    allowedOrigin,
    {
      thread_type: "direct_message",
      other_profile_id: partnerProfileId,
    },
  );

  assert.ok(directMessageResult.thread?.id, "Direct message response did not include a thread id");
  assert.equal(
    directMessageResult.thread?.thread_type,
    "direct_message",
    "Direct message response returned the wrong thread type",
  );

  console.log("[verify-messaging-hub] Verifying the direct-message thread is visible through RLS-scoped reads");
  const { data: visibleThread, error: visibleThreadError } = await client
    .from("message_threads")
    .select("id, name, thread_type")
    .eq("id", directMessageResult.thread.id)
    .single();

  if (visibleThreadError || !visibleThread) {
    throw new Error(`Direct-message thread was not readable after creation: ${visibleThreadError?.message ?? "thread missing"}`);
  }

  assert.equal(visibleThread.id, directMessageResult.thread.id, "Visible thread id did not match the direct-message thread id");
  assert.equal(visibleThread.thread_type, "direct_message", "Visible thread type did not match direct_message");

  console.log("[verify-messaging-hub] Rendering a verification summary for screenshot artifacts");
  const screenshots: string[] = [];
  const notes = [
    `Signed in directly through Supabase Auth as ${tester.email}.`,
    `Verified create-message-thread preflight for ${allowedOrigin}.`,
    previewOrigin
      ? `Verified preview-origin preflight for ${previewOrigin}.`
      : "Preview-origin preflight was skipped.",
    expectLocalhostBlocked
      ? `Verified ${LOCALHOST_ORIGIN} is blocked after disabling the production localhost exception.`
      : `${LOCALHOST_ORIGIN} blocking check was skipped by configuration.`,
    "The current public frontend targets are not usable for buyer-facing UI proof: the custom domains are unhealthy and the latest Vercel deployment URL is protected by Vercel auth.",
  ];

  const browser = await chromium.launch({
    headless: (getConfigValue("MESSAGING_HUB_HEADLESS", envFileValues) ?? "true").toLowerCase() !== "false",
  });

  try {
    const reportHtmlPath = path.join(artifactDir, `messaging-hub-${timestamp}-summary.html`);
    const reportHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Messaging Hub Verification ${timestamp}</title>
    <style>
      body {
        font-family: "Segoe UI", Arial, sans-serif;
        background: #f4f1eb;
        color: #1e1d1a;
        margin: 0;
        padding: 32px;
      }
      .card {
        max-width: 1080px;
        margin: 0 auto;
        background: #fffdf8;
        border: 1px solid #d8cfbf;
        border-radius: 18px;
        padding: 28px 32px;
        box-shadow: 0 18px 40px rgba(29, 28, 24, 0.08);
      }
      h1, h2 {
        margin: 0 0 12px;
      }
      h1 {
        font-size: 30px;
      }
      h2 {
        margin-top: 28px;
        font-size: 20px;
      }
      .meta {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px 20px;
        margin-top: 20px;
      }
      .meta-item {
        padding: 14px 16px;
        border: 1px solid #e4dccd;
        border-radius: 14px;
        background: #fff;
      }
      .meta-label {
        display: block;
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #7b735f;
        margin-bottom: 6px;
      }
      ul {
        margin: 0;
        padding-left: 20px;
        line-height: 1.6;
      }
      pre {
        overflow: auto;
        white-space: pre-wrap;
        word-break: break-word;
        background: #1f2229;
        color: #f6f8fb;
        padding: 18px;
        border-radius: 14px;
        font-size: 13px;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>Messaging Hub Live Verification</h1>
      <p>This report was generated from the live production Supabase backend after the create-message-thread CORS fix was deployed.</p>
      <section class="meta">
        <div class="meta-item"><span class="meta-label">Timestamp</span>${timestamp}</div>
        <div class="meta-item"><span class="meta-label">Tester</span>${tester.email}</div>
        <div class="meta-item"><span class="meta-label">Partner</span>${partner.email}</div>
        <div class="meta-item"><span class="meta-label">Allowed Origin</span>${allowedOrigin}</div>
        <div class="meta-item"><span class="meta-label">Family Channel Thread</span>${familyChannelResult.thread.id}</div>
        <div class="meta-item"><span class="meta-label">Direct Message Thread</span>${directMessageResult.thread.id}</div>
      </section>

      <h2>Assertions</h2>
      <ul>${notes.map((note) => `<li>${note}</li>`).join("")}</ul>

      <h2>Report Payload</h2>
      <pre>${JSON.stringify({
        timestamp,
        environment: "production",
        baseUrl,
        allowedOrigin,
        previewOrigin,
        tester: tester.email,
        partner: partner.email,
        familyChannelThreadId: familyChannelResult.thread.id,
        directMessageThreadId: directMessageResult.thread.id,
        localhostBlocked: expectLocalhostBlocked,
      }, null, 2)}</pre>
    </main>
  </body>
</html>
`;

    await writeFile(reportHtmlPath, reportHtml, "utf8");

    const context = await browser.newContext({
      viewport: { width: 1440, height: 1600 },
    });
    const page = await context.newPage();

    await page.goto(`file:///${reportHtmlPath.replace(/\\/g, "/")}`);

    const summaryScreenshot = path.join(artifactDir, `messaging-hub-${timestamp}-summary.png`);
    await page.screenshot({ path: summaryScreenshot, fullPage: true });
    screenshots.push(summaryScreenshot);

    const reportBlock = page.locator("pre");
    const detailsScreenshot = path.join(artifactDir, `messaging-hub-${timestamp}-details.png`);
    await reportBlock.screenshot({ path: detailsScreenshot });
    screenshots.push(detailsScreenshot);

    await context.close();
  } finally {
    await browser.close();
  }

  const report: VerificationReport = {
    timestamp,
    environment: "production",
    baseUrl,
    allowedOrigin,
    previewOrigin,
    tester: tester.email,
    partner: partner.email,
    familyChannelThreadId: familyChannelResult.thread.id,
    directMessageThreadId: directMessageResult.thread.id,
    localhostBlocked: expectLocalhostBlocked,
    notes,
    screenshots,
  };

  const reportPath = path.join(artifactDir, `messaging-hub-${timestamp}-report.json`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log("[verify-messaging-hub] Verification succeeded");
  console.log(`[verify-messaging-hub] Direct-message thread id: ${report.directMessageThreadId}`);
  console.log(`[verify-messaging-hub] Report: ${reportPath}`);
  screenshots.forEach((screenshotPath) => {
    console.log(`[verify-messaging-hub] Screenshot: ${screenshotPath}`);
  });
}

run().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(`[verify-messaging-hub] FAILED\n${message}`);
  process.exitCode = 1;
});
