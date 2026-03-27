import type { User, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface AuthenticatedProfile {
  account_role: string | null;
  email: string | null;
  full_name: string | null;
  id: string;
  user_id: string;
}

export interface FamilyMemberRecord {
  family_id: string | null;
  id: string;
  primary_parent_id: string;
  profile_id: string;
  relationship_label: string | null;
  role: "parent" | "guardian" | "third_party" | "child";
  status: string;
  user_id: string;
  profiles?: {
    account_role: string | null;
    email: string | null;
    full_name: string | null;
    id: string;
  } | null;
}

export interface CallSessionRecord {
  answered_at: string | null;
  callee_display_name: string | null;
  callee_profile_id: string;
  callee_role_snapshot: "parent" | "guardian" | "third_party" | "child";
  call_type: "audio" | "video";
  created_at: string;
  daily_room_name: string;
  daily_room_url: string;
  ended_at: string | null;
  ended_by_profile_id: string | null;
  failed_reason: string | null;
  family_id: string;
  id: string;
  initiator_display_name: string | null;
  initiator_profile_id: string;
  initiator_role_snapshot: "parent" | "guardian" | "third_party" | "child";
  room_expires_at: string | null;
  source: string;
  started_at: string | null;
  status: "ringing" | "accepted" | "declined" | "missed" | "cancelled" | "ended" | "failed";
  thread_id: string | null;
  updated_at: string;
}

const CALLABLE_MEMBER_ROLES = new Set(["parent", "guardian", "third_party"]);

export function logCallStep(prefix: string, step: string, details?: Record<string, unknown>) {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[${prefix}] ${step}${detailsStr}`);
}

export function resolveDisplayName(profile: {
  email?: string | null;
  full_name?: string | null;
}): string {
  const fullName = profile.full_name?.trim();
  if (fullName) {
    return fullName;
  }

  const emailName = profile.email?.split("@")[0]?.trim();
  if (emailName) {
    return emailName;
  }

  return "Family member";
}

export function ensureCallableRole(role: FamilyMemberRecord["role"]) {
  if (!CALLABLE_MEMBER_ROLES.has(role)) {
    throw new HttpError(403, "Only active parent, guardian, and third-party members can use calling.");
  }
}

export async function requireAuthenticatedProfile(
  req: Request,
  supabaseAdmin: SupabaseClient,
): Promise<{ profile: AuthenticatedProfile; user: User }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new HttpError(401, "Authentication required");
  }

  const token = authHeader.replace("Bearer ", "").trim();
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !authData.user) {
    throw new HttpError(401, "Authentication failed");
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, user_id, full_name, email, account_role")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    throw new HttpError(404, "Profile not found");
  }

  return {
    profile: profile as AuthenticatedProfile,
    user: authData.user,
  };
}

export async function getActiveMembershipForUser(
  supabaseAdmin: SupabaseClient,
  familyId: string,
  userId: string,
): Promise<FamilyMemberRecord> {
  const { data, error } = await supabaseAdmin
    .from("family_members")
    .select("id, family_id, primary_parent_id, profile_id, relationship_label, role, status, user_id")
    .eq("family_id", familyId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) {
    throw new HttpError(403, "You do not have access to that family.");
  }

  return data as FamilyMemberRecord;
}

export async function getActiveMembershipForProfile(
  supabaseAdmin: SupabaseClient,
  familyId: string,
  profileId: string,
): Promise<FamilyMemberRecord> {
  const { data, error } = await supabaseAdmin
    .from("family_members")
    .select(`
      id,
      family_id,
      primary_parent_id,
      profile_id,
      relationship_label,
      role,
      status,
      user_id,
      profiles!family_members_profile_id_fkey (
        id,
        full_name,
        email,
        account_role
      )
    `)
    .eq("family_id", familyId)
    .eq("profile_id", profileId)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) {
    throw new HttpError(404, "The selected family member could not be found.");
  }

  return data as unknown as FamilyMemberRecord;
}

export async function ensureDirectMessageThread(
  supabaseAdmin: SupabaseClient,
  options: {
    familyId: string;
    participantAProfileId: string;
    participantBProfileId: string;
    primaryParentId: string;
  },
): Promise<{ id: string }> {
  const [participantAId, participantBId] =
    options.participantAProfileId < options.participantBProfileId
      ? [options.participantAProfileId, options.participantBProfileId]
      : [options.participantBProfileId, options.participantAProfileId];

  const { data: existingThread, error: existingThreadError } = await supabaseAdmin
    .from("message_threads")
    .select("id, family_id")
    .eq("primary_parent_id", options.primaryParentId)
    .eq("thread_type", "direct_message")
    .eq("participant_a_id", participantAId)
    .eq("participant_b_id", participantBId)
    .maybeSingle();

  if (existingThreadError) {
    throw new HttpError(500, existingThreadError.message);
  }

  if (existingThread) {
    if (!existingThread.family_id) {
      await supabaseAdmin
        .from("message_threads")
        .update({ family_id: options.familyId })
        .eq("id", existingThread.id);
    }

    return existingThread;
  }

  const { data: createdThread, error: createThreadError } = await supabaseAdmin
    .from("message_threads")
    .insert({
      family_id: options.familyId,
      participant_a_id: participantAId,
      participant_b_id: participantBId,
      primary_parent_id: options.primaryParentId,
      thread_type: "direct_message",
    })
    .select("id")
    .single();

  if (createThreadError || !createdThread) {
    throw new HttpError(500, createThreadError?.message ?? "Failed to create the direct-message thread.");
  }

  return createdThread;
}

export async function insertCallEvent(
  supabaseAdmin: SupabaseClient,
  params: {
    actorDisplayName?: string | null;
    actorProfileId?: string | null;
    actorRoleSnapshot?: FamilyMemberRecord["role"] | null;
    callSessionId: string;
    eventType:
      | "accepted"
      | "cancelled"
      | "created"
      | "declined"
      | "ended"
      | "failed"
      | "joined"
      | "left"
      | "missed"
      | "ringing";
    payload?: Record<string, unknown>;
  },
) {
  const { error } = await supabaseAdmin.from("call_events").insert({
    actor_display_name: params.actorDisplayName ?? null,
    actor_profile_id: params.actorProfileId ?? null,
    actor_role_snapshot: params.actorRoleSnapshot ?? null,
    call_session_id: params.callSessionId,
    event_type: params.eventType,
    payload: params.payload ?? {},
  });

  if (error) {
    throw new HttpError(500, error.message);
  }
}

export async function insertThreadMessage(
  supabaseAdmin: SupabaseClient,
  params: {
    content: string;
    senderProfileId: string;
    senderRole: FamilyMemberRecord["role"];
    threadId: string;
  },
) {
  const { error } = await supabaseAdmin.from("thread_messages").insert({
    content: params.content,
    sender_id: params.senderProfileId,
    sender_role: params.senderRole,
    thread_id: params.threadId,
  });

  if (error) {
    throw new HttpError(500, error.message);
  }
}

export async function loadAccessibleCallSession(
  supabaseAdmin: SupabaseClient,
  callSessionId: string,
  userId: string,
  profileId: string,
): Promise<{ membership: FamilyMemberRecord; session: CallSessionRecord }> {
  const { data, error } = await supabaseAdmin
    .from("call_sessions")
    .select("*")
    .eq("id", callSessionId)
    .maybeSingle();

  if (error || !data) {
    throw new HttpError(404, "Call session not found.");
  }

  const session = data as CallSessionRecord;

  if (profileId !== session.initiator_profile_id && profileId !== session.callee_profile_id) {
    throw new HttpError(403, "You are not a participant in this call.");
  }

  const membership = await getActiveMembershipForUser(supabaseAdmin, session.family_id, userId);

  return {
    membership,
    session,
  };
}
