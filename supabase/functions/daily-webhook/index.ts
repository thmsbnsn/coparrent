import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { strictCors, getCorsHeaders } from "../_shared/cors.ts";
import { insertCallEvent, logCallStep } from "../_shared/callHelpers.ts";
import { verifyDailyWebhookSignature } from "../_shared/daily.ts";

const LOG_PREFIX = "DAILY-WEBHOOK";

type DailyWebhookEvent = {
  id?: string;
  room?: string;
  room_name?: string;
  start_ts?: number | string;
  end_ts?: number | string;
  join_ts?: number | string;
  leave_ts?: number | string;
  event_ts?: number | string;
  type?: string;
  participant?: {
    session_id?: string;
    user_id?: string;
    user_name?: string;
  };
  session_id?: string;
  user_id?: string;
  user_name?: string;
  payload?: {
    room?: string;
    room_name?: string;
    start_ts?: number | string;
    end_ts?: number | string;
    joined_at?: number | string;
    left_at?: number | string;
    leave_ts?: number | string;
    event_ts?: number | string;
    session_id?: string;
    user_id?: string;
    user_name?: string;
    participant?: {
      session_id?: string;
      user_id?: string;
      user_name?: string;
    };
  } | null;
};

const jsonResponse = (req: Request, status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    headers: {
      ...getCorsHeaders(req),
      "Content-Type": "application/json",
    },
    status,
  });

function normalizeTimestamp(value: number | string | null | undefined): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value * 1000).toISOString();
  }

  if (typeof value === "string" && value.trim()) {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue) && /^\d+(\.\d+)?$/.test(value.trim())) {
      return new Date(numericValue * 1000).toISOString();
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return null;
}

function getRoomName(event: DailyWebhookEvent): string | null {
  return event.payload?.room_name ?? event.payload?.room ?? event.room_name ?? event.room ?? null;
}

function getEventTimestamp(event: DailyWebhookEvent): string {
  return (
    normalizeTimestamp(event.payload?.start_ts) ||
    normalizeTimestamp(event.payload?.end_ts) ||
    normalizeTimestamp(event.payload?.joined_at) ||
    normalizeTimestamp(event.payload?.left_at) ||
    normalizeTimestamp(event.payload?.leave_ts) ||
    normalizeTimestamp(event.start_ts) ||
    normalizeTimestamp(event.end_ts) ||
    normalizeTimestamp(event.join_ts) ||
    normalizeTimestamp(event.leave_ts) ||
    normalizeTimestamp(event.payload?.event_ts) ||
    normalizeTimestamp(event.event_ts) ||
    new Date().toISOString()
  );
}

function getParticipantDetails(event: DailyWebhookEvent) {
  const participant = event.payload?.participant ?? event.participant ?? null;
  return {
    sessionId: participant?.session_id ?? event.payload?.session_id ?? event.session_id ?? null,
    userId: participant?.user_id ?? event.payload?.user_id ?? event.user_id ?? null,
    userName: participant?.user_name ?? event.payload?.user_name ?? event.user_name ?? null,
  };
}

serve(async (req) => {
  const corsResponse = strictCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return jsonResponse(req, 405, { success: false, error: "Method not allowed" });
  }

  const rawBody = await req.text();
  const signatureHeader = req.headers.get("X-Webhook-Signature");
  const timestampHeader = req.headers.get("X-Webhook-Timestamp");

  const signatureValid = await verifyDailyWebhookSignature(rawBody, signatureHeader, timestampHeader);
  if (!signatureValid) {
    logCallStep(LOG_PREFIX, "Blocked unverified webhook", {
      hasSignature: Boolean(signatureHeader),
      hasTimestamp: Boolean(timestampHeader),
    });

    return jsonResponse(req, 401, {
      success: false,
      error: "Invalid webhook signature",
    });
  }

  const event = JSON.parse(rawBody) as DailyWebhookEvent;
  const eventType = event.type ?? "unknown";
  const roomName = getRoomName(event);

  if (!roomName) {
    return jsonResponse(req, 200, { ignored: true, success: true });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("call_sessions")
      .select("*")
      .eq("daily_room_name", roomName)
      .maybeSingle();

    if (sessionError || !session) {
      logCallStep(LOG_PREFIX, "Webhook ignored for unknown room", {
        roomName,
        eventType,
      });
      return jsonResponse(req, 200, { ignored: true, success: true });
    }

    const eventId = event.id ?? null;
    if (eventId) {
      const { data: existingEvent } = await supabaseAdmin
        .from("call_events")
        .select("id")
        .eq("call_session_id", session.id)
        .contains("payload", { daily_event_id: eventId })
        .maybeSingle();

      if (existingEvent) {
        return jsonResponse(req, 200, { duplicate: true, success: true });
      }
    }

    const eventTimestamp = getEventTimestamp(event);

    if (eventType === "meeting.started") {
      await supabaseAdmin
        .from("call_sessions")
        .update({
          started_at: session.started_at ?? eventTimestamp,
        })
        .eq("id", session.id);
    } else if (eventType === "meeting.ended") {
      if (session.status === "accepted" || session.status === "ringing") {
        await supabaseAdmin
          .from("call_sessions")
          .update({
            ended_at: session.ended_at ?? eventTimestamp,
            status: session.status === "accepted" ? "ended" : "missed",
          })
          .eq("id", session.id);

        await insertCallEvent(supabaseAdmin, {
          callSessionId: session.id,
          eventType: session.status === "accepted" ? "ended" : "missed",
          payload: {
            daily_event_id: eventId,
            daily_event_type: eventType,
            event_timestamp: eventTimestamp,
          },
        });
      }
    } else if (eventType === "participant.joined" || eventType === "participant.left") {
      const { sessionId, userId, userName } = getParticipantDetails(event);
      if (!userId) {
        return jsonResponse(req, 200, { ignored: true, success: true });
      }

      const timestampColumn = eventType === "participant.joined" ? "joined_at" : "left_at";
      const eventTypeForLog = eventType === "participant.joined" ? "joined" : "left";

      const { error: participantUpdateError } = await supabaseAdmin
        .from("call_participants")
        .update({
          [timestampColumn]: eventTimestamp,
        })
        .eq("call_session_id", session.id)
        .eq("profile_id", userId);

      if (participantUpdateError) {
        throw participantUpdateError;
      }

      const actorRole =
        userId === session.initiator_profile_id
          ? session.initiator_role_snapshot
          : userId === session.callee_profile_id
            ? session.callee_role_snapshot
            : null;

      await insertCallEvent(supabaseAdmin, {
        actorDisplayName:
          userId === session.initiator_profile_id
            ? session.initiator_display_name
            : userId === session.callee_profile_id
              ? session.callee_display_name
              : userName ?? null,
        actorProfileId: userId,
        actorRoleSnapshot: actorRole,
        callSessionId: session.id,
        eventType: eventTypeForLog,
        payload: {
          daily_event_id: eventId,
          daily_event_type: eventType,
          event_timestamp: eventTimestamp,
          daily_session_id: sessionId,
          daily_user_name: userName,
        },
      });
    }

    logCallStep(LOG_PREFIX, "Webhook processed", {
      callSessionId: session.id,
      eventId,
      eventType,
      roomName,
    });

    return jsonResponse(req, 200, { success: true });
  } catch (error) {
    logCallStep(LOG_PREFIX, "Error", {
      error: error instanceof Error ? error.message : String(error),
      eventType,
      roomName,
    });

    return jsonResponse(req, 500, {
      success: false,
      error: error instanceof Error ? error.message : "Unable to process webhook",
    });
  }
});
