import type { Database } from "@/integrations/supabase/types";

export type FamilyPresenceRole = Database["public"]["Enums"]["member_role"];
export type FamilyPresenceStatus = "active" | "inactive";
export type FamilyPresenceLocationType = "dashboard" | "lobby" | "game";

export interface FamilyPresenceOverviewRow {
  avatar_url: string | null;
  display_name: string;
  game_display_name: string | null;
  game_slug: string | null;
  last_seen_at: string | null;
  location_type: FamilyPresenceLocationType | null;
  membership_id: string;
  presence_status: FamilyPresenceStatus;
  profile_id: string;
  relationship_label: string | null;
  role: FamilyPresenceRole;
}

export interface FamilyPresenceMember {
  avatarUrl: string | null;
  displayName: string;
  gameDisplayName: string | null;
  gameSlug: string | null;
  lastSeenAt: string | null;
  locationType: FamilyPresenceLocationType | null;
  membershipId: string;
  presenceStatus: FamilyPresenceStatus;
  profileId: string;
  relationshipLabel: string | null;
  role: FamilyPresenceRole;
}

export interface FamilyPresenceHeartbeatInput {
  gameDisplayName?: string | null;
  gameSlug?: string | null;
  locationType: FamilyPresenceLocationType;
}

export const FAMILY_PRESENCE_HEARTBEAT_MS = 25_000;

export const formatFamilyPresenceRoleLabel = (
  role: FamilyPresenceRole,
  relationshipLabel: string | null,
) => {
  const cleanedRelationship = relationshipLabel?.trim();
  if (cleanedRelationship) {
    return cleanedRelationship
      .split(/[_\-\s]+/)
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" ");
  }

  switch (role) {
    case "guardian":
      return "Guardian";
    case "third_party":
      return "Third Party";
    case "child":
      return "Child";
    default:
      return "Parent";
  }
};

export const getFamilyPresenceSecondaryLabel = (member: FamilyPresenceMember) => {
  if (member.presenceStatus !== "active") {
    return null;
  }

  if (member.locationType === "lobby") {
    return "In lobby";
  }

  if (member.locationType === "game") {
    return member.gameDisplayName ?? "In a game";
  }

  return "On dashboard";
};

export const getFamilyPresenceInitials = (displayName: string) => {
  const trimmed = displayName.trim();
  if (!trimmed) {
    return "FM";
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};
