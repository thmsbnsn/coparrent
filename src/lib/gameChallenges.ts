import type { FamilyPresenceRole } from "@/lib/familyPresence";

export type FamilyGameChallengeStatus = "active" | "completed" | "expired" | "cancelled";

export interface FamilyGameChallengeSummaryRow {
  completed_at: string | null;
  created_at: string;
  created_by_display_name: string;
  created_by_profile_id: string;
  expires_at: string | null;
  family_id: string;
  game_display_name: string;
  game_slug: string;
  id: string;
  leading_profile_id: string | null;
  participant_count: number | string | null;
  result_count: number | string | null;
  status: FamilyGameChallengeStatus;
  updated_at: string;
}

export interface FamilyGameChallengeSummary {
  completedAt: string | null;
  createdAt: string;
  createdByDisplayName: string;
  createdByProfileId: string;
  expiresAt: string | null;
  familyId: string;
  gameDisplayName: string;
  gameSlug: string;
  id: string;
  leadingProfileId: string | null;
  participantCount: number;
  resultCount: number;
  status: FamilyGameChallengeStatus;
  updatedAt: string;
}

export interface FamilyGameChallengeParticipantRow {
  accepted_at: string;
  avatar_url: string | null;
  display_name: string;
  has_result: boolean;
  profile_id: string;
  relationship_label: string | null;
  role: FamilyPresenceRole;
}

export interface FamilyGameChallengeParticipant {
  acceptedAt: string;
  avatarUrl: string | null;
  displayName: string;
  hasResult: boolean;
  profileId: string;
  relationshipLabel: string | null;
  role: FamilyPresenceRole;
}

export interface FamilyGameChallengeLeaderboardRow {
  avatar_url: string | null;
  display_name: string;
  distance: number | string;
  is_leader: boolean;
  profile_id: string;
  relationship_label: string | null;
  role: FamilyPresenceRole;
  score: number | string;
  submitted_at: string;
}

export interface FamilyGameChallengeLeaderboardEntry {
  avatarUrl: string | null;
  displayName: string;
  distance: number;
  isLeader: boolean;
  profileId: string;
  relationshipLabel: string | null;
  role: FamilyPresenceRole;
  score: number;
  submittedAt: string;
}

export interface FamilyGameChallengeOverviewPayload {
  challenge: FamilyGameChallengeSummaryRow | null;
  leaderboard: FamilyGameChallengeLeaderboardRow[] | null;
  participants: FamilyGameChallengeParticipantRow[] | null;
}

export interface FamilyGameChallengeOverview {
  challenge: FamilyGameChallengeSummary | null;
  leaderboard: FamilyGameChallengeLeaderboardEntry[];
  participants: FamilyGameChallengeParticipant[];
}

export interface FamilyGameChallengeSubmission {
  accepted: boolean;
  challengeId: string;
  distance: number;
  leadingProfileId: string | null;
  profileId: string;
  score: number;
  status: FamilyGameChallengeStatus;
  submittedAt: string;
}

const parseCount = (value: number | string | null | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const mapFamilyGameChallengeSummary = (
  row: FamilyGameChallengeSummaryRow,
): FamilyGameChallengeSummary => ({
  completedAt: row.completed_at,
  createdAt: row.created_at,
  createdByDisplayName: row.created_by_display_name,
  createdByProfileId: row.created_by_profile_id,
  expiresAt: row.expires_at,
  familyId: row.family_id,
  gameDisplayName: row.game_display_name,
  gameSlug: row.game_slug,
  id: row.id,
  leadingProfileId: row.leading_profile_id,
  participantCount: parseCount(row.participant_count),
  resultCount: parseCount(row.result_count),
  status: row.status,
  updatedAt: row.updated_at,
});

export const mapFamilyGameChallengeParticipant = (
  row: FamilyGameChallengeParticipantRow,
): FamilyGameChallengeParticipant => ({
  acceptedAt: row.accepted_at,
  avatarUrl: row.avatar_url,
  displayName: row.display_name,
  hasResult: row.has_result,
  profileId: row.profile_id,
  relationshipLabel: row.relationship_label,
  role: row.role,
});

export const mapFamilyGameChallengeLeaderboardEntry = (
  row: FamilyGameChallengeLeaderboardRow,
): FamilyGameChallengeLeaderboardEntry => ({
  avatarUrl: row.avatar_url,
  displayName: row.display_name,
  distance: parseCount(row.distance),
  isLeader: row.is_leader,
  profileId: row.profile_id,
  relationshipLabel: row.relationship_label,
  role: row.role,
  score: parseCount(row.score),
  submittedAt: row.submitted_at,
});

export const mapFamilyGameChallengeOverview = (
  payload: FamilyGameChallengeOverviewPayload | null,
): FamilyGameChallengeOverview => ({
  challenge: payload?.challenge ? mapFamilyGameChallengeSummary(payload.challenge) : null,
  leaderboard: (payload?.leaderboard ?? []).map((row) => mapFamilyGameChallengeLeaderboardEntry(row)),
  participants: (payload?.participants ?? []).map((row) => mapFamilyGameChallengeParticipant(row)),
});

export const getFamilyGameChallengeStatusLabel = (status: FamilyGameChallengeStatus) => {
  switch (status) {
    case "completed":
      return "Completed";
    case "expired":
      return "Expired";
    case "cancelled":
      return "Closed";
    default:
      return "Active";
  }
};
