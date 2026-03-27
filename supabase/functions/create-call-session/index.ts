import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { strictCors, getCorsHeaders } from "../_shared/cors.ts";
import {
  HttpError,
  ensureCallableRole,
  ensureDirectMessageThread,
  getActiveMembershipForProfile,
  getActiveMembershipForUser,
  insertCallEvent,
  insertThreadMessage,
  logCallStep,
  requireAuthenticatedProfile,
  resolveDisplayName,
} from "../_shared/callHelpers.ts";
import { createDailyRoom, deleteDailyRoom } from "../_shared/daily.ts";
import { dispatchPushNotifications } from "../_shared/push.ts";

const LOG_PREFIX = "CREATE-CALL-SESSION";

interface CreateCallSessionRequest {
  call_type: "audio" | "video";
  callee_profile_id: string;
  family_id: string;
  source?: "dashboard" | "messaging_hub";
  thread_id?: string;
}

const shouldSendCallAlerts = (preferences: Record<string, unknown> | null) => {
  if (!preferences) {
    return true;
  }

  if (preferences.enabled === false) {
    return false;
  }

  return preferences.new_messages !== false;
};

const jsonResponse = (req: Request, status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    headers: {
      ...getCorsHeaders(req),
      "Content-Type": "application/json",
    },
    status,
  });

serve(async (req) => {
  const corsResponse = strictCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return jsonResponse(req, 405, { success: false, error: "Method not allowed" });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  let createdRoomName: string | null = null;
  let createdSessionId: string | null = null;

  try {
    const { profile, user } = await requireAuthenticatedProfile(req, supabaseAdmin);
    const body = (await req.json()) as CreateCallSessionRequest;

    logCallStep(LOG_PREFIX, "Request received", {
      callType: body.call_type,
      calleeProfileId: body.callee_profile_id,
      familyId: body.family_id,
      source: body.source ?? null,
      threadId: body.thread_id ?? null,
      userId: user.id,
    });

    if (!body.family_id || !body.callee_profile_id || !body.call_type) {
      throw new HttpError(400, "family_id, callee_profile_id, and call_type are required.");
    }

    if (!["audio", "video"].includes(body.call_type)) {
      throw new HttpError(400, "call_type must be audio or video.");
    }

    if (body.source && !["dashboard", "messaging_hub"].includes(body.source)) {
      throw new HttpError(400, "source must be dashboard or messaging_hub.");
    }

    if (body.callee_profile_id === profile.id) {
      throw new HttpError(400, "You cannot call yourself.");
    }

    const callerMembership = await getActiveMembershipForUser(supabaseAdmin, body.family_id, user.id);
    ensureCallableRole(callerMembership.role);

    const calleeMembership = await getActiveMembershipForProfile(supabaseAdmin, body.family_id, body.callee_profile_id);
    ensureCallableRole(calleeMembership.role);

    if (calleeMembership.profile_id === profile.id) {
      throw new HttpError(400, "You cannot call yourself.");
    }

    const callerName = resolveDisplayName(profile);
    const calleeName = resolveDisplayName(calleeMembership.profiles ?? {});
    const source = body.source ?? (body.thread_id ? "messaging_hub" : "dashboard");

    let threadId = body.thread_id ?? null;

    if (threadId) {
      const { data: thread, error: threadError } = await supabaseAdmin
        .from("message_threads")
        .select("id, family_id, primary_parent_id, thread_type, participant_a_id, participant_b_id")
        .eq("id", threadId)
        .maybeSingle();

      if (threadError || !thread) {
        throw new HttpError(404, "The selected message thread could not be found.");
      }

      if (thread.thread_type !== "direct_message") {
        throw new HttpError(400, "Calls can only start from direct-message threads.");
      }

      const participantIds = [thread.participant_a_id, thread.participant_b_id];
      if (!participantIds.includes(profile.id) || !participantIds.includes(body.callee_profile_id)) {
        throw new HttpError(403, "That thread does not belong to the selected call participants.");
      }

      if (thread.family_id && thread.family_id !== body.family_id) {
        throw new HttpError(400, "The selected thread belongs to a different family.");
      }

      if (!thread.family_id) {
        const { error: updateThreadError } = await supabaseAdmin
          .from("message_threads")
          .update({ family_id: body.family_id })
          .eq("id", thread.id);

        if (updateThreadError) {
          throw new HttpError(500, updateThreadError.message);
        }
      }
    } else {
      const ensuredThread = await ensureDirectMessageThread(supabaseAdmin, {
        familyId: body.family_id,
        participantAProfileId: profile.id,
        participantBProfileId: body.callee_profile_id,
        primaryParentId: callerMembership.primary_parent_id,
      });

      threadId = ensuredThread.id;
    }

    const { data: existingSessions, error: existingSessionsError } = await supabaseAdmin
      .from("call_sessions")
      .select("*")
      .eq("family_id", body.family_id)
      .in("status", ["ringing", "accepted"])
      .or(
        `and(initiator_profile_id.eq.${profile.id},callee_profile_id.eq.${body.callee_profile_id}),and(initiator_profile_id.eq.${body.callee_profile_id},callee_profile_id.eq.${profile.id})`,
      )
      .order("created_at", { ascending: false })
      .limit(1);

    if (existingSessionsError) {
      throw new HttpError(500, existingSessionsError.message);
    }

    const existingSession = existingSessions?.[0] ?? null;
    if (existingSession) {
      logCallStep(LOG_PREFIX, "Reusing active session", {
        callSessionId: existingSession.id,
        status: existingSession.status,
      });

      return jsonResponse(req, 200, {
        reused: true,
        success: true,
        session: existingSession,
      });
    }

    const dailyRoom = await createDailyRoom();
    createdRoomName = dailyRoom.name;

    const roomExpiresAt = new Date(dailyRoom.exp * 1000).toISOString();
    const { data: createdSession, error: createSessionError } = await supabaseAdmin
      .from("call_sessions")
      .insert({
        callee_display_name: calleeName,
        callee_profile_id: body.callee_profile_id,
        callee_role_snapshot: calleeMembership.role,
        call_type: body.call_type,
        daily_room_name: dailyRoom.name,
        daily_room_url: dailyRoom.url,
        family_id: body.family_id,
        initiator_display_name: callerName,
        initiator_profile_id: profile.id,
        initiator_role_snapshot: callerMembership.role,
        room_expires_at: roomExpiresAt,
        source,
        status: "ringing",
        thread_id: threadId,
      })
      .select("*")
      .single();

    if (createSessionError || !createdSession) {
      throw new HttpError(500, createSessionError?.message ?? "Failed to create the call session.");
    }

    createdSessionId = createdSession.id;

    const { error: participantInsertError } = await supabaseAdmin.from("call_participants").insert([
      {
        call_session_id: createdSession.id,
        display_name_snapshot: callerName,
        member_role_snapshot: callerMembership.role,
        profile_id: profile.id,
      },
      {
        call_session_id: createdSession.id,
        display_name_snapshot: calleeName,
        member_role_snapshot: calleeMembership.role,
        profile_id: body.callee_profile_id,
      },
    ]);

    if (participantInsertError) {
      throw new HttpError(500, participantInsertError.message);
    }

    await insertCallEvent(supabaseAdmin, {
      actorDisplayName: callerName,
      actorProfileId: profile.id,
      actorRoleSnapshot: callerMembership.role,
      callSessionId: createdSession.id,
      eventType: "created",
      payload: {
        call_type: body.call_type,
        source,
      },
    });

    await insertCallEvent(supabaseAdmin, {
      actorDisplayName: callerName,
      actorProfileId: profile.id,
      actorRoleSnapshot: callerMembership.role,
      callSessionId: createdSession.id,
      eventType: "ringing",
      payload: {
        callee_profile_id: body.callee_profile_id,
      },
    });

    if (threadId) {
      await insertThreadMessage(supabaseAdmin, {
        content: `${callerName} started a ${body.call_type} call.`,
        senderProfileId: profile.id,
        senderRole: callerMembership.role,
        threadId,
      });
    }

    const notificationTitle = body.call_type === "video" ? "Incoming video call" : "Incoming audio call";
    const notificationMessage = `${callerName} is calling you from ${source === "dashboard" ? "the dashboard" : "Messaging Hub"}.`;

    const { data: calleeProfile } = await supabaseAdmin
      .from("profiles")
      .select("notification_preferences")
      .eq("id", body.callee_profile_id)
      .maybeSingle();

    const notificationPreferences =
      (calleeProfile?.notification_preferences as Record<string, unknown> | null) ?? null;

    if (shouldSendCallAlerts(notificationPreferences)) {
      const { error: notificationInsertError } = await supabaseAdmin.from("notifications").insert({
        message: notificationMessage,
        related_id: createdSession.id,
        title: notificationTitle,
        type: "incoming_call",
        user_id: body.callee_profile_id,
      });

      if (notificationInsertError) {
        logCallStep(LOG_PREFIX, "Call notification insert failed", {
          error: notificationInsertError.message,
        });
      }

      try {
        const pushResult = await dispatchPushNotifications(supabaseAdmin, {
          body: notificationMessage,
          profileId: body.callee_profile_id,
          tag: `incoming-call-${createdSession.id}`,
          title: notificationTitle,
          url: "/dashboard/messages",
        });

        logCallStep(LOG_PREFIX, "Call push dispatch attempted", pushResult);
      } catch (pushError) {
        logCallStep(LOG_PREFIX, "Call push dispatch failed", {
          error: pushError instanceof Error ? pushError.message : String(pushError),
        });
      }
    }

    logCallStep(LOG_PREFIX, "Call session created", {
      callSessionId: createdSession.id,
      roomName: dailyRoom.name,
      threadId,
    });

    return jsonResponse(req, 200, {
      success: true,
      session: createdSession,
    });
  } catch (error) {
    logCallStep(LOG_PREFIX, "Error", {
      error: error instanceof Error ? error.message : String(error),
    });

    if (createdSessionId) {
      await supabaseAdmin.from("call_sessions").delete().eq("id", createdSessionId);
    }

    if (createdRoomName) {
      try {
        await deleteDailyRoom(createdRoomName);
      } catch (cleanupError) {
        logCallStep(LOG_PREFIX, "Room cleanup failed", {
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
          roomName: createdRoomName,
        });
      }
    }

    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Unable to create the call session.";
    return jsonResponse(req, status, {
      success: false,
      error: message,
    });
  }
});
