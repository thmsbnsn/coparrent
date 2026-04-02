import assert from "node:assert/strict";
import process from "node:process";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

interface VerifyAccountConfig {
  email: string;
  label: string;
  password: string;
}

interface VerifyClientIdentity {
  client: SupabaseClient;
}

interface RpcSessionResponse {
  id: string;
  seed?: number | string | null;
  start_time?: string | null;
  status: string;
}

interface RpcJoinResponse {
  profile_id: string;
  ready_at: string | null;
  session_id: string;
  status: string;
}

interface RpcResultResponse {
  distance: number;
  outcome: {
    ended_at: string | null;
    id: string;
    member_count: number;
    result_count: number;
    status: string;
    winner_profile_id: string | null;
  };
  profile_id: string;
  reported_at: string;
  score: number;
  session_id: string;
}

interface LobbyPayload {
  members: Array<{
    display_name: string;
    is_creator: boolean;
    profile_id: string;
    ready_at: string | null;
    status: string;
  }>;
  results?: Array<{
    distance: number | string;
    is_winner: boolean;
    profile_id: string;
    reported_at: string;
    score: number | string;
  }> | null;
  session: {
    family_id: string;
    game_display_name: string;
    game_slug: string;
    id: string;
    seed: number | string | null;
    start_time: string | null;
    status: string;
    winner_profile_id: string | null;
  } | null;
}

const SUPABASE_URL_KEY = "SUPABASE_URL";
const SUPABASE_ANON_KEY_KEY = "SUPABASE_ANON_KEY";
const FALLBACK_SUPABASE_URL_KEY = "VITE_SUPABASE_URL";
const FALLBACK_SUPABASE_ANON_KEY_KEY = "VITE_SUPABASE_PUBLISHABLE_KEY";
const GAME_SLUG = process.env.VERIFY_FAMILY_GAME_SLUG ?? "flappy-plane";
const GAME_DISPLAY_NAME = process.env.VERIFY_FAMILY_GAME_DISPLAY_NAME ?? "Toy Plane Dash";

function logStep(step: string, details?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const suffix = details ? ` ${JSON.stringify(details)}` : "";
  console.log(`[verify-family-game-multiplayer] ${timestamp} ${step}${suffix}`);
}

function getRequiredEnv(name: string, fallbacks: string[] = []): string {
  const value = process.env[name] ?? fallbacks.map((key) => process.env[key]).find(Boolean);
  if (!value) {
    throw new Error(`Missing required configuration value: ${name}`);
  }

  return value;
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function signInAccount(
  url: string,
  anonKey: string,
  account: VerifyAccountConfig,
): Promise<VerifyClientIdentity> {
  const client = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  logStep("sign-in.start", { account: account.label, email: account.email });
  const { data, error } = await client.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });

  if (error || !data.session || !data.user) {
    throw new Error(
      `Unable to sign in ${account.label}: ${error?.message ?? "missing session."}`,
    );
  }

  logStep("sign-in.complete", { account: account.label, userId: data.user.id });
  return { client };
}

async function callRpc<T>(
  client: SupabaseClient,
  name: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await client.rpc(name, payload);
  if (error) {
    throw new Error(`${name} failed: ${error.message}`);
  }

  return data as T;
}

async function main() {
  const supabaseUrl = getRequiredEnv(SUPABASE_URL_KEY, [FALLBACK_SUPABASE_URL_KEY]);
  const supabaseAnonKey = getRequiredEnv(SUPABASE_ANON_KEY_KEY, [FALLBACK_SUPABASE_ANON_KEY_KEY]);
  const familyId = getRequiredEnv("VERIFY_FAMILY_GAME_FAMILY_ID");

  const hostAccount: VerifyAccountConfig = {
    email: getRequiredEnv("VERIFY_FAMILY_GAME_HOST_EMAIL"),
    label: "host",
    password: getRequiredEnv("VERIFY_FAMILY_GAME_HOST_PASSWORD"),
  };
  const guestAccount: VerifyAccountConfig = {
    email: getRequiredEnv("VERIFY_FAMILY_GAME_GUEST_EMAIL"),
    label: "guest",
    password: getRequiredEnv("VERIFY_FAMILY_GAME_GUEST_PASSWORD"),
  };

  const host = await signInAccount(supabaseUrl, supabaseAnonKey, hostAccount);
  const guest = await signInAccount(supabaseUrl, supabaseAnonKey, guestAccount);

  logStep("session.create.start", { familyId, gameSlug: GAME_SLUG });
  const createdSession = await callRpc<RpcSessionResponse>(
    host.client,
    "rpc_create_family_game_session",
    {
      p_family_id: familyId,
      p_game_display_name: GAME_DISPLAY_NAME,
      p_game_slug: GAME_SLUG,
      p_max_players: 4,
    },
  );

  assert.ok(createdSession.id, "Expected session id from rpc_create_family_game_session.");
  assert.ok(toNumber(createdSession.seed), "Expected a non-null session seed.");

  const hostLobby = await callRpc<LobbyPayload>(host.client, "get_family_game_lobby", {
    p_family_id: familyId,
    p_session_id: createdSession.id,
  });

  assert.equal(hostLobby.session?.id, createdSession.id);
  assert.equal(hostLobby.session?.family_id, familyId);
  assert.equal(hostLobby.session?.game_slug, GAME_SLUG);
  assert.equal(hostLobby.session?.game_display_name, GAME_DISPLAY_NAME);
  assert.equal(hostLobby.members.length, 1, "Expected a clean lobby with only the host joined.");

  const hostProfileId = hostLobby.members[0]?.profile_id;
  assert.ok(hostProfileId, "Expected the host profile_id in the initial lobby payload.");

  logStep("session.join.start", { sessionId: createdSession.id });
  const guestJoin = await callRpc<RpcJoinResponse>(
    guest.client,
    "rpc_join_family_game_session",
    {
      p_family_id: familyId,
      p_session_id: createdSession.id,
    },
  );

  assert.equal(guestJoin.session_id, createdSession.id);
  assert.equal(guestJoin.status, "joined");
  assert.ok(guestJoin.profile_id, "Expected guest profile_id from rpc_join_family_game_session.");

  const readyHost = await callRpc<RpcJoinResponse>(
    host.client,
    "rpc_set_family_game_session_ready",
    {
      p_family_id: familyId,
      p_is_ready: true,
      p_session_id: createdSession.id,
    },
  );
  const readyGuest = await callRpc<RpcJoinResponse>(
    guest.client,
    "rpc_set_family_game_session_ready",
    {
      p_family_id: familyId,
      p_is_ready: true,
      p_session_id: createdSession.id,
    },
  );

  assert.equal(readyHost.status, "ready");
  assert.equal(readyGuest.status, "ready");

  const startedSession = await callRpc<RpcSessionResponse>(
    host.client,
    "rpc_start_family_game_session",
    {
      p_family_id: familyId,
      p_session_id: createdSession.id,
    },
  );

  assert.equal(startedSession.status, "active");
  assert.ok(startedSession.start_time, "Expected start_time from rpc_start_family_game_session.");
  assert.ok(
    new Date(startedSession.start_time ?? 0).getTime() > Date.now(),
    "Expected start_time to be in the future.",
  );

  const [postStartHostLobby, postStartGuestLobby] = await Promise.all([
    callRpc<LobbyPayload>(host.client, "get_family_game_lobby", {
      p_family_id: familyId,
      p_session_id: createdSession.id,
    }),
    callRpc<LobbyPayload>(guest.client, "get_family_game_lobby", {
      p_family_id: familyId,
      p_session_id: createdSession.id,
    }),
  ]);

  assert.equal(postStartHostLobby.session?.status, "active");
  assert.equal(postStartGuestLobby.session?.status, "active");
  assert.equal(postStartHostLobby.session?.seed, postStartGuestLobby.session?.seed);
  assert.equal(postStartHostLobby.session?.start_time, postStartGuestLobby.session?.start_time);

  logStep("session.start.confirmed", {
    seed: postStartHostLobby.session?.seed,
    sessionId: createdSession.id,
    startTime: postStartHostLobby.session?.start_time,
  });

  const hostResult = await callRpc<RpcResultResponse>(
    host.client,
    "rpc_report_family_game_session_result",
    {
      p_distance: 1488,
      p_family_id: familyId,
      p_reported_at: new Date().toISOString(),
      p_score: 12,
      p_session_id: createdSession.id,
    },
  );

  assert.equal(hostResult.session_id, createdSession.id);
  assert.equal(hostResult.profile_id, hostProfileId);
  assert.equal(hostResult.outcome.status, "active");
  assert.equal(hostResult.outcome.result_count, 1);

  const guestResult = await callRpc<RpcResultResponse>(
    guest.client,
    "rpc_report_family_game_session_result",
    {
      p_distance: 1777,
      p_family_id: familyId,
      p_reported_at: new Date().toISOString(),
      p_score: 14,
      p_session_id: createdSession.id,
    },
  );

  assert.equal(guestResult.session_id, createdSession.id);
  assert.equal(guestResult.profile_id, guestJoin.profile_id);
  assert.equal(guestResult.outcome.status, "finished");
  assert.equal(guestResult.outcome.member_count, 2);
  assert.equal(guestResult.outcome.result_count, 2);
  assert.equal(guestResult.outcome.winner_profile_id, guestJoin.profile_id);

  const finalLobby = await callRpc<LobbyPayload>(host.client, "get_family_game_lobby", {
    p_family_id: familyId,
    p_session_id: createdSession.id,
  });

  assert.equal(finalLobby.session?.status, "finished");
  assert.equal(finalLobby.session?.winner_profile_id, guestJoin.profile_id);
  assert.equal(finalLobby.results?.length, 2);

  const finalScores = (finalLobby.results ?? []).map((result) => ({
    distance: toNumber(result.distance),
    isWinner: result.is_winner,
    profileId: result.profile_id,
    score: toNumber(result.score),
  }));

  assert.deepEqual(finalScores, [
    {
      distance: 1777,
      isWinner: true,
      profileId: guestJoin.profile_id,
      score: 14,
    },
    {
      distance: 1488,
      isWinner: false,
      profileId: hostProfileId,
      score: 12,
    },
  ]);

  logStep("verification.complete", {
    familyId,
    sessionId: createdSession.id,
    startTime: finalLobby.session?.start_time,
    winnerProfileId: finalLobby.session?.winner_profile_id,
  });
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(`[verify-family-game-multiplayer] FAILED\n${message}`);
  process.exitCode = 1;
});
