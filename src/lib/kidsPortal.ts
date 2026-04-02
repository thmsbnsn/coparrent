import {
  CLOSED_CHILD_DEVICE_ACCESS_SETTINGS,
  DEFAULT_CHILD_DEVICE_ACCESS_SETTINGS,
  type ChildDeviceAccessSettingsSnapshot,
} from "@/lib/childAccess";

export type KidPortalMode = "under_6" | "age_6_to_12";
export type KidPortalRequestStatus = "idle" | "pending" | "approved" | "declined" | "expired";
export type ChildCallMode = "audio_only" | "audio_video";

export interface ChildPermissionsSnapshot {
  allow_calendar_reminders: boolean;
  allow_family_chat: boolean;
  allow_mood_checkins: boolean;
  allow_notes_to_parents: boolean;
  allow_parent_messaging: boolean;
  allow_push_notifications: boolean;
  allow_sibling_messaging: boolean;
  is_child: boolean;
  login_enabled: boolean;
  show_full_event_details: boolean;
}

export interface ChildAccountContext
  extends ChildPermissionsSnapshot,
    ChildDeviceAccessSettingsSnapshot {
  call_mode: ChildCallMode;
  calling_enabled: boolean;
  child_id: string | null;
  child_name: string | null;
  child_profile_id: string | null;
  portal_mode: KidPortalMode | null;
}

export interface KidPortalRequestState {
  dashboard_unlocked: boolean;
  id: string | null;
  requested_at: string | null;
  resolved_at: string | null;
  session_expires_at: string | null;
  status: KidPortalRequestStatus;
}

export const DEFAULT_PARENT_CHILD_CONTEXT: ChildAccountContext = {
  allow_calendar_reminders: true,
  allow_family_chat: true,
  allow_mood_checkins: true,
  allow_notes_to_parents: true,
  allow_parent_messaging: true,
  allow_push_notifications: true,
  allow_sibling_messaging: true,
  ...DEFAULT_CHILD_DEVICE_ACCESS_SETTINGS,
  call_mode: "audio_only",
  calling_enabled: false,
  child_id: null,
  child_name: null,
  child_profile_id: null,
  is_child: false,
  login_enabled: true,
  portal_mode: null,
  show_full_event_details: true,
};

export const createClosedChildContext = (loginEnabled = true): ChildAccountContext => ({
  allow_calendar_reminders: false,
  allow_family_chat: false,
  allow_mood_checkins: false,
  allow_notes_to_parents: false,
  allow_parent_messaging: false,
  allow_push_notifications: false,
  allow_sibling_messaging: false,
  ...CLOSED_CHILD_DEVICE_ACCESS_SETTINGS,
  call_mode: "audio_only",
  calling_enabled: false,
  child_id: null,
  child_name: null,
  child_profile_id: null,
  is_child: true,
  login_enabled: loginEnabled,
  portal_mode: null,
  show_full_event_details: false,
});

export const DEFAULT_KID_PORTAL_REQUEST_STATE: KidPortalRequestState = {
  dashboard_unlocked: false,
  id: null,
  requested_at: null,
  resolved_at: null,
  session_expires_at: null,
  status: "idle",
};

export const isKidDashboardUnlocked = (requestState: KidPortalRequestState | null | undefined) =>
  Boolean(requestState?.dashboard_unlocked);

export const requiresPortalApproval = (
  portalMode: KidPortalMode | null | undefined,
  requestState: KidPortalRequestState | null | undefined,
) => portalMode === "under_6" && !isKidDashboardUnlocked(requestState);

export const canUseVideoCall = (callMode: ChildCallMode | null | undefined) =>
  callMode === "audio_video";
