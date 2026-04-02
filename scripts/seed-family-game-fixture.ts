import process from "node:process";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadLocalEnv } from "./lib/load-local-env.ts";

interface FixtureAccountConfig {
  email: string;
  fullName: string;
  label: string;
  password: string;
}

interface ProfileRow {
  account_role: string | null;
  email: string | null;
  full_name: string | null;
  id: string;
  user_id: string;
}

interface FamilyMemberRow {
  accepted_at: string | null;
  family_id: string;
  id: string;
  primary_parent_id: string;
  profile_id: string;
  relationship_label: string | null;
  role: string;
  status: string;
  user_id: string;
}

interface FamilyRecord {
  created_by_user_id: string;
  display_name: string;
  id: string;
}

interface RpcFamilyResponse {
  data?: {
    family_id?: string;
    role?: string;
  };
  error?: string;
  success?: boolean;
  family_id?: string;
}

interface ManagedUser {
  id: string;
}

const DEFAULT_FAMILY_LABEL = "CoParrent Multiplayer Staging";
const DEFAULT_HOST_EMAIL = "stage-host@coparrent.dev";
const DEFAULT_GUEST_EMAIL = "stage-guest@coparrent.dev";
const DEFAULT_HOST_NAME = "Stage Host";
const DEFAULT_GUEST_NAME = "Stage Guest";

loadLocalEnv();

function logStep(step: string, details?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const suffix = details ? ` ${JSON.stringify(details)}` : "";
  console.log(`[seed-family-game-fixture] ${timestamp} ${step}${suffix}`);
}

function getEnv(name: string, fallbacks: string[] = [], defaultValue?: string): string {
  const value =
    process.env[name] ??
    fallbacks.map((fallback) => process.env[fallback]).find((candidate) => Boolean(candidate)) ??
    defaultValue;

  if (!value) {
    throw new Error(`Missing required configuration value: ${name}`);
  }

  return value;
}

function createServiceClient() {
  const url = getEnv("SUPABASE_STAGING_URL", ["VITE_SUPABASE_STAGING_URL"]);
  const serviceRoleKey = getEnv("SUPABASE_STAGING_SERVICE_ROLE_KEY");

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function createAnonClient() {
  const url = getEnv("SUPABASE_STAGING_URL", ["VITE_SUPABASE_STAGING_URL"]);
  const anonKey = getEnv("SUPABASE_STAGING_ANON_KEY", [
    "VERIFY_FAMILY_GAME_SUPABASE_ANON_KEY",
    "VITE_SUPABASE_STAGING_PUBLISHABLE_KEY",
  ]);

  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function findManagedUserByEmail(
  serviceClient: SupabaseClient,
  email: string,
): Promise<ManagedUser | null> {
  let page = 1;

  while (page <= 10) {
    const { data, error } = await serviceClient.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) {
      throw new Error(`Unable to list auth users: ${error.message}`);
    }

    const match = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === email.toLowerCase(),
    );
    if (match) {
      return { id: match.id };
    }

    if (data.users.length < 200) {
      return null;
    }

    page += 1;
  }

  return null;
}

async function createOrUpdateUser(
  serviceClient: SupabaseClient,
  account: FixtureAccountConfig,
): Promise<ManagedUser> {
  const existingUser = await findManagedUserByEmail(serviceClient, account.email);

  if (!existingUser) {
    logStep("auth-user.create", { account: account.label, email: account.email });

    const { data, error } = await serviceClient.auth.admin.createUser({
      email: account.email,
      email_confirm: true,
      password: account.password,
      user_metadata: {
        full_name: account.fullName,
      },
    });

    if (error || !data.user) {
      throw new Error(`Unable to create ${account.label} user: ${error?.message ?? "unknown error"}`);
    }

    return { id: data.user.id };
  }

  logStep("auth-user.update", { account: account.label, email: account.email });

  const { data, error } = await serviceClient.auth.admin.updateUserById(existingUser.id, {
    email: account.email,
    password: account.password,
    user_metadata: {
      full_name: account.fullName,
    },
  });

  if (error || !data.user) {
    throw new Error(`Unable to update ${account.label} user: ${error?.message ?? "unknown error"}`);
  }

  return { id: data.user.id };
}

async function waitForProfile(
  serviceClient: SupabaseClient,
  userId: string,
  label: string,
): Promise<ProfileRow> {
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    const { data, error } = await serviceClient
      .from("profiles")
      .select("id, user_id, email, full_name, account_role")
      .eq("user_id", userId)
      .maybeSingle<ProfileRow>();

    if (error) {
      throw new Error(`Unable to load ${label} profile: ${error.message}`);
    }

    if (data) {
      return data;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for ${label} profile creation.`);
}

async function signInFixtureUser(
  account: FixtureAccountConfig,
): Promise<SupabaseClient> {
  const client = createAnonClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });

  if (error || !data.session) {
    throw new Error(`Unable to sign in ${account.label}: ${error?.message ?? "missing session"}`);
  }

  return client;
}

async function ensureFamily(
  serviceClient: SupabaseClient,
  hostClient: SupabaseClient,
  hostUserId: string,
  familyLabel: string,
): Promise<FamilyRecord> {
  const { data: existingFamily, error: familyLookupError } = await serviceClient
    .from("families")
    .select("id, display_name, created_by_user_id")
    .eq("created_by_user_id", hostUserId)
    .eq("display_name", familyLabel)
    .maybeSingle<FamilyRecord>();

  if (familyLookupError) {
    throw new Error(`Unable to check for existing staging family: ${familyLookupError.message}`);
  }

  if (existingFamily) {
    return existingFamily;
  }

  logStep("family.create", { familyLabel });

  const { data, error } = await hostClient.rpc("rpc_create_additional_family", {
    p_display_name: familyLabel,
  });

  if (error) {
    throw new Error(`Unable to create staging family: ${error.message}`);
  }

  const response = (data ?? {}) as RpcFamilyResponse;
  const familyId = response.family_id ?? response.data?.family_id;
  if (!familyId) {
    throw new Error("Family creation succeeded without returning a family_id.");
  }

  const { data: createdFamily, error: createdFamilyError } = await serviceClient
    .from("families")
    .select("id, display_name, created_by_user_id")
    .eq("id", familyId)
    .single<FamilyRecord>();

  if (createdFamilyError) {
    throw new Error(`Unable to load created staging family: ${createdFamilyError.message}`);
  }

  return createdFamily;
}

async function ensureParentProfile(
  serviceClient: SupabaseClient,
  profile: ProfileRow,
  fullName: string,
): Promise<ProfileRow> {
  const { data, error } = await serviceClient
    .from("profiles")
    .update({
      account_role: "parent",
      full_name: fullName,
    })
    .eq("id", profile.id)
    .select("id, user_id, email, full_name, account_role")
    .single<ProfileRow>();

  if (error) {
    throw new Error(`Unable to update profile ${profile.id}: ${error.message}`);
  }

  return data;
}

async function ensureFamilyMembership(
  serviceClient: SupabaseClient,
  params: {
    familyId: string;
    primaryParentProfileId: string;
    profile: ProfileRow;
    relationshipLabel: string;
    role: "parent" | "guardian" | "third_party" | "child";
  },
): Promise<FamilyMemberRow> {
  const { data: existingMember, error: memberLookupError } = await serviceClient
    .from("family_members")
    .select("id, family_id, user_id, profile_id, primary_parent_id, role, status, relationship_label, accepted_at")
    .eq("family_id", params.familyId)
    .eq("user_id", params.profile.user_id)
    .maybeSingle<FamilyMemberRow>();

  if (memberLookupError) {
    throw new Error(`Unable to load family member row: ${memberLookupError.message}`);
  }

  if (existingMember) {
    const { data, error } = await serviceClient
      .from("family_members")
      .update({
        accepted_at: existingMember.accepted_at ?? new Date().toISOString(),
        primary_parent_id: params.primaryParentProfileId,
        profile_id: params.profile.id,
        relationship_label: params.relationshipLabel,
        role: params.role,
        status: "active",
      })
      .eq("id", existingMember.id)
      .select("id, family_id, user_id, profile_id, primary_parent_id, role, status, relationship_label, accepted_at")
      .single<FamilyMemberRow>();

    if (error) {
      throw new Error(`Unable to update family member row: ${error.message}`);
    }

    return data;
  }

  const { data, error } = await serviceClient
    .from("family_members")
    .insert({
      accepted_at: new Date().toISOString(),
      family_id: params.familyId,
      primary_parent_id: params.primaryParentProfileId,
      profile_id: params.profile.id,
      relationship_label: params.relationshipLabel,
      role: params.role,
      status: "active",
      user_id: params.profile.user_id,
    })
    .select("id, family_id, user_id, profile_id, primary_parent_id, role, status, relationship_label, accepted_at")
    .single<FamilyMemberRow>();

  if (error) {
    throw new Error(`Unable to insert family member row: ${error.message}`);
  }

  return data;
}

async function main() {
  const serviceClient = createServiceClient();

  const hostAccount: FixtureAccountConfig = {
    email: getEnv("VERIFY_FAMILY_GAME_HOST_EMAIL", [], DEFAULT_HOST_EMAIL),
    fullName: getEnv("VERIFY_FAMILY_GAME_HOST_FULL_NAME", [], DEFAULT_HOST_NAME),
    label: "host",
    password: getEnv("VERIFY_FAMILY_GAME_HOST_PASSWORD"),
  };
  const guestAccount: FixtureAccountConfig = {
    email: getEnv("VERIFY_FAMILY_GAME_GUEST_EMAIL", [], DEFAULT_GUEST_EMAIL),
    fullName: getEnv("VERIFY_FAMILY_GAME_GUEST_FULL_NAME", [], DEFAULT_GUEST_NAME),
    label: "guest",
    password: getEnv("VERIFY_FAMILY_GAME_GUEST_PASSWORD"),
  };
  const familyLabel = getEnv(
    "VERIFY_FAMILY_GAME_FAMILY_LABEL",
    [],
    DEFAULT_FAMILY_LABEL,
  );

  const hostUser = await createOrUpdateUser(serviceClient, hostAccount);
  const guestUser = await createOrUpdateUser(serviceClient, guestAccount);

  let hostProfile = await waitForProfile(serviceClient, hostUser.id, hostAccount.label);
  let guestProfile = await waitForProfile(serviceClient, guestUser.id, guestAccount.label);

  hostProfile = await ensureParentProfile(serviceClient, hostProfile, hostAccount.fullName);
  guestProfile = await ensureParentProfile(serviceClient, guestProfile, guestAccount.fullName);

  const hostClient = await signInFixtureUser(hostAccount);
  const family = await ensureFamily(serviceClient, hostClient, hostUser.id, familyLabel);

  const hostMember = await ensureFamilyMembership(serviceClient, {
    familyId: family.id,
    primaryParentProfileId: hostProfile.id,
    profile: hostProfile,
    relationshipLabel: "Parent",
    role: "parent",
  });

  const guestMember = await ensureFamilyMembership(serviceClient, {
    familyId: family.id,
    primaryParentProfileId: hostProfile.id,
    profile: guestProfile,
    relationshipLabel: "Parent",
    role: "parent",
  });

  logStep("fixture.ready", {
    familyId: family.id,
    familyLabel: family.display_name,
    guestMemberId: guestMember.id,
    hostMemberId: hostMember.id,
  });

  console.log(`VERIFY_FAMILY_GAME_FAMILY_ID=${family.id}`);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(`[seed-family-game-fixture] FAILED\n${message}`);
  process.exitCode = 1;
});
