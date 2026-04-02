import type { FamilyPresenceRole } from "@/lib/familyPresence";
export { FAMILY_GAMES, getFamilyGameBySlug } from "@/lib/gameRegistry";

export type FamilyGameSessionStatus =
  | "waiting"
  | "ready"
  | "active"
  | "finished"
  | "cancelled";

export type FamilyGameSessionMemberStatus = "joined" | "ready" | "left";

export interface FamilyGameSessionResultRow {
  avatar_url: string | null;
  display_name: string;
  distance: number | string;
  is_winner: boolean;
  profile_id: string;
  reported_at: string;
  score: number | string;
}

export interface FamilyGameSessionOverviewRow {
  created_at: string;
  created_by_display_name: string;
  created_by_profile_id: string;
  ended_at: string | null;
  family_id: string;
  game_display_name: string;
  game_slug: string;
  id: string;
  max_players: number;
  member_count: number | string | null;
  ready_count: number | string | null;
  seed: number | string | null;
  started_at: string | null;
  start_time: string | null;
  status: FamilyGameSessionStatus;
  updated_at: string;
  winner_profile_id: string | null;
}

export interface FamilyGameSessionSummary {
  createdAt: string;
  createdByDisplayName: string;
  createdByProfileId: string;
  endedAt: string | null;
  familyId: string;
  gameDisplayName: string;
  gameSlug: string;
  id: string;
  maxPlayers: number;
  memberCount: number;
  readyCount: number;
  seed: number | null;
  startedAt: string | null;
  startTime: string | null;
  status: FamilyGameSessionStatus;
  updatedAt: string;
  winnerProfileId: string | null;
}

export interface FamilyGameLobbyMemberRow {
  avatar_url: string | null;
  display_name: string;
  is_creator: boolean;
  joined_at: string;
  profile_id: string;
  ready_at: string | null;
  relationship_label: string | null;
  role: FamilyPresenceRole;
  seat_order: number | null;
  status: FamilyGameSessionMemberStatus;
}

export interface FamilyGameLobbyMember {
  avatarUrl: string | null;
  displayName: string;
  isCreator: boolean;
  joinedAt: string;
  profileId: string;
  readyAt: string | null;
  relationshipLabel: string | null;
  role: FamilyPresenceRole;
  seatOrder: number | null;
  status: FamilyGameSessionMemberStatus;
}

export interface FamilyGameLobbyPayload {
  members: FamilyGameLobbyMemberRow[];
  results?: FamilyGameSessionResultRow[] | null;
  session: FamilyGameSessionOverviewRow | null;
}

export interface FamilyGameLobby {
  members: FamilyGameLobbyMember[];
  results: FamilyGameSessionResult[];
  session: FamilyGameSessionSummary;
}

export interface FamilyGameSessionResult {
  avatarUrl: string | null;
  displayName: string;
  distance: number;
  isWinner: boolean;
  profileId: string;
  reportedAt: string;
  score: number;
}

const parseCount = (value: number | string | null | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseNullableNumber = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const mapFamilyGameSessionSummary = (
  row: FamilyGameSessionOverviewRow,
): FamilyGameSessionSummary => ({
  createdAt: row.created_at,
  createdByDisplayName: row.created_by_display_name,
  createdByProfileId: row.created_by_profile_id,
  endedAt: row.ended_at,
  familyId: row.family_id,
  gameDisplayName: row.game_display_name,
  gameSlug: row.game_slug,
  id: row.id,
  maxPlayers: row.max_players,
  memberCount: parseCount(row.member_count),
  readyCount: parseCount(row.ready_count),
  seed: parseNullableNumber(row.seed),
  startedAt: row.started_at,
  startTime: row.start_time,
  status: row.status,
  updatedAt: row.updated_at,
  winnerProfileId: row.winner_profile_id,
});

export const mapFamilyGameSessionResult = (
  row: FamilyGameSessionResultRow,
): FamilyGameSessionResult => ({
  avatarUrl: row.avatar_url,
  displayName: row.display_name,
  distance: parseCount(row.distance),
  isWinner: row.is_winner,
  profileId: row.profile_id,
  reportedAt: row.reported_at,
  score: parseCount(row.score),
});

export const mapFamilyGameLobby = (
  payload: FamilyGameLobbyPayload | null,
): FamilyGameLobby | null => {
  if (!payload?.session) {
    return null;
  }

  return {
    members: (payload.members ?? []).map((member) => ({
      avatarUrl: member.avatar_url,
      displayName: member.display_name,
      isCreator: member.is_creator,
      joinedAt: member.joined_at,
      profileId: member.profile_id,
      readyAt: member.ready_at,
      relationshipLabel: member.relationship_label,
      role: member.role,
      seatOrder: member.seat_order,
      status: member.status,
    })),
    results: (payload.results ?? []).map((result) => mapFamilyGameSessionResult(result)),
    session: mapFamilyGameSessionSummary(payload.session),
  };
};

export const getFamilyGameSessionStatusLabel = (status: FamilyGameSessionStatus) => {
  switch (status) {
    case "ready":
      return "Ready to launch";
    case "active":
      return "Flight live";
    case "finished":
      return "Finished";
    case "cancelled":
      return "Closed";
    default:
      return "Waiting on players";
  }
};

export const isFamilyGameSessionStartable = (
  session: FamilyGameSessionSummary | null,
) =>
  Boolean(
    session &&
      session.status === "ready" &&
      session.memberCount > 0 &&
      session.memberCount === session.readyCount,
  );
