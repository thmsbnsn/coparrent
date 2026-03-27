import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { strictCors, getCorsHeaders } from "../_shared/cors.ts";
import {
  HttpError,
  insertCallEvent,
  insertThreadMessage,
  loadAccessibleCallSession,
  logCallStep,
  requireAuthenticatedProfile,
  resolveDisplayName,
} from "../_shared/callHelpers.ts";

const LOG_PREFIX = "END-CALL-SESSION";

interface EndCallSessionRequest {
  call_session_id: string;
  outcome?: "cancelled" | "ended" | "failed" | "missed";
  failed_reason?: string;
}

const jsonResponse = (req: Request, status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    headers: {
      ...getCorsHeaders(req),
      "Content-Type": "application/json",
    },
    status,
  });

function resolveOutcome(sessionStatus: string, requestedOutcome?: string): "cancelled" | "ended" | "failed" | "missed" {
  if (requestedOutcome === "failed") {
    return "failed";
  }

  if (requestedOutcome === "missed") {
    return "missed";
  }

  if (sessionStatus === "ringing") {
    return requestedOutcome === "ended" ? "cancelled" : "cancelled";
  }

  return "ended";
}

function buildThreadLogMessage(actorName: string, callType: string, outcome: string): string {
  switch (outcome) {
    case "cancelled":
      return `${actorName} cancelled the ${callType} call.`;
    case "missed":
      return `${actorName} marked the ${callType} call as missed.`;
    case "failed":
      return `${actorName} ended the ${callType} call after a connection problem.`;
    default:
      return `${actorName} ended the ${callType} call.`;
  }
}

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

  try {
    const { profile, user } = await requireAuthenticatedProfile(req, supabaseAdmin);
    const body = (await req.json()) as EndCallSessionRequest;

    if (!body.call_session_id) {
      throw new HttpError(400, "call_session_id is required.");
    }

    const { membership, session } = await loadAccessibleCallSession(
      supabaseAdmin,
      body.call_session_id,
      user.id,
      profile.id,
    );

    if (["declined", "missed", "cancelled", "ended", "failed"].includes(session.status)) {
      return jsonResponse(req, 200, {
        session,
        success: true,
      });
    }

    const outcome = resolveOutcome(session.status, body.outcome);

    if (outcome === "missed" && profile.id !== session.initiator_profile_id) {
      throw new HttpError(403, "Only the caller can mark a ringing call as missed.");
    }

    if (outcome === "cancelled" && session.status === "ringing" && profile.id !== session.initiator_profile_id) {
      throw new HttpError(403, "Only the caller can cancel a ringing call.");
    }

    const endedAt = new Date().toISOString();
    const actorName =
      profile.id === session.initiator_profile_id
        ? session.initiator_display_name ?? resolveDisplayName(profile)
        : session.callee_display_name ?? resolveDisplayName(profile);

    const updatePayload: Record<string, string | null> = {
      ended_at: endedAt,
      ended_by_profile_id: profile.id,
      failed_reason: outcome === "failed" ? body.failed_reason ?? "Call ended unexpectedly" : null,
      status: outcome,
    };

    const { data: updatedSession, error: updateError } = await supabaseAdmin
      .from("call_sessions")
      .update(updatePayload)
      .eq("id", session.id)
      .select("*")
      .single();

    if (updateError || !updatedSession) {
      throw new HttpError(500, updateError?.message ?? "Failed to update the call session.");
    }

    await insertCallEvent(supabaseAdmin, {
      actorDisplayName: actorName,
      actorProfileId: profile.id,
      actorRoleSnapshot: membership.role,
      callSessionId: session.id,
      eventType: outcome,
      payload: outcome === "failed" ? { failed_reason: body.failed_reason ?? null } : {},
    });

    if (session.thread_id) {
      await insertThreadMessage(supabaseAdmin, {
        content: buildThreadLogMessage(actorName, session.call_type, outcome),
        senderProfileId: profile.id,
        senderRole: membership.role,
        threadId: session.thread_id,
      });
    }

    logCallStep(LOG_PREFIX, "Call ended", {
      callSessionId: session.id,
      outcome,
      profileId: profile.id,
    });

    return jsonResponse(req, 200, {
      session: updatedSession,
      success: true,
    });
  } catch (error) {
    logCallStep(LOG_PREFIX, "Error", {
      error: error instanceof Error ? error.message : String(error),
    });

    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Unable to end the call.";
    return jsonResponse(req, status, {
      success: false,
      error: message,
    });
  }
});
