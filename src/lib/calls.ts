import type { Database, Tables } from "@/integrations-supabase/types";

export type CallType = Database["public"]["Enums"]["call_type"];
export type CallStatus = Database["public"]["Enums"]["call_status"];
export type CallEventType = Database["public"]["Enums"]["call_event_type"];
export type MemberRole = Database["public"]["Enums"]["member_role"];

export type CallSessionRow = Tables<"call_sessions">;
export type CallParticipantRow = Tables<"call_participants">;
export type CallEventRow = Tables<"call_events">;

export const CALL_SOURCES = ["messaging_hub", "dashboard"] as const;

export type CallSource = (typeof CALL_SOURCES)[number];

export const TERMINAL_CALL_STATUSES = [
  "declined",
  "missed",
  "cancelled",
  "ended",
  "failed",
] as const satisfies readonly CallStatus[];

export const ACTIVE_CALL_STATUSES = ["ringing", "accepted"] as const satisfies readonly CallStatus[];

export const CALLABLE_MEMBER_ROLES = [
  "parent",
  "guardian",
  "third_party",
] as const satisfies readonly MemberRole[];

export const CALL_ROLE_LABELS: Record<MemberRole, string> = {
  child: "Child",
  guardian: "Guardian",
  parent: "Parent",
  third_party: "Third-Party",
};

export const getCallSourceLabel = (source: string | null | undefined) => {
  if (source === "dashboard") {
    return "Dashboard";
  }

  return "Messaging Hub";
};
