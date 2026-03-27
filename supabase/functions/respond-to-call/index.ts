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

const LOG_PREFIX = "RESPOND-TO-CALL";

interface RespondToCallRequest {
  call_session_id: string;
  response: "accept" | "decline";
}

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

  try {
    const { profile, user } = await requireAuthenticatedProfile(req, supabaseAdmin);
    const body = (await req.json()) as RespondToCallRequest;

    if (!body.call_session_id || !body.response) {
      throw new HttpError(400, "call_session_id and response are required.");
    }

    if (!["accept", "decline"].includes(body.response)) {
      throw new HttpError(400, "response must be accept or decline.");
    }

    const { membership, session } = await loadAccessibleCallSession(
      supabaseAdmin,
      body.call_session_id,
      user.id,
      profile.id,
    );

    if (session.callee_profile_id !== profile.id) {
      throw new HttpError(403, "Only the called family member can accept or decline.");
    }

    if (session.status !== "ringing") {
      throw new HttpError(409, `This call can no longer be answered because it is ${session.status}.`);
    }

    const responseStatus = body.response === "accept" ? "accepted" : "declined";
    const responseTimestamp = new Date().toISOString();
    const responderName = session.callee_display_name ?? resolveDisplayName(profile);

    const { data: updatedSession, error: updateError } = await supabaseAdmin
      .from("call_sessions")
      .update({
        answered_at: body.response === "accept" ? responseTimestamp : null,
        ended_at: body.response === "decline" ? responseTimestamp : null,
        ended_by_profile_id: body.response === "decline" ? profile.id : null,
        started_at: body.response === "accept" ? responseTimestamp : session.started_at,
        status: responseStatus,
      })
      .eq("id", session.id)
      .eq("status", "ringing")
      .select("*")
      .single();

    if (updateError || !updatedSession) {
      throw new HttpError(500, updateError?.message ?? "Failed to update the call session.");
    }

    await insertCallEvent(supabaseAdmin, {
      actorDisplayName: responderName,
      actorProfileId: profile.id,
      actorRoleSnapshot: membership.role,
      callSessionId: session.id,
      eventType: body.response === "accept" ? "accepted" : "declined",
      payload: {
        response_at: responseTimestamp,
      },
    });

    if (session.thread_id) {
      await insertThreadMessage(supabaseAdmin, {
        content:
          body.response === "accept"
            ? `${responderName} accepted the ${session.call_type} call.`
            : `${responderName} declined the ${session.call_type} call.`,
        senderProfileId: profile.id,
        senderRole: membership.role,
        threadId: session.thread_id,
      });
    }

    logCallStep(LOG_PREFIX, "Call response recorded", {
      callSessionId: session.id,
      profileId: profile.id,
      response: body.response,
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
    const message = error instanceof Error ? error.message : "Unable to respond to the call.";
    return jsonResponse(req, status, {
      success: false,
      error: message,
    });
  }
});
