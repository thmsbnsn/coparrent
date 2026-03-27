import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { strictCors, getCorsHeaders } from "../_shared/cors.ts";
import {
  HttpError,
  loadAccessibleCallSession,
  logCallStep,
  requireAuthenticatedProfile,
  resolveDisplayName,
} from "../_shared/callHelpers.ts";
import { createDailyMeetingToken } from "../_shared/daily.ts";

const LOG_PREFIX = "JOIN-CALL-SESSION";
const FUNCTION_VERSION = "2026-03-27-token-properties";

interface JoinCallSessionRequest {
  call_session_id: string;
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
    const body = (await req.json()) as JoinCallSessionRequest;

    if (!body.call_session_id) {
      throw new HttpError(400, "call_session_id is required.");
    }

    const { session } = await loadAccessibleCallSession(supabaseAdmin, body.call_session_id, user.id, profile.id);

    if (session.status !== "accepted") {
      throw new HttpError(409, `This call cannot be joined while it is ${session.status}.`);
    }

    if (session.room_expires_at && new Date(session.room_expires_at).getTime() <= Date.now()) {
      throw new HttpError(410, "This call room has already expired.");
    }

    const userName =
      profile.id === session.initiator_profile_id
        ? session.initiator_display_name ?? resolveDisplayName(profile)
        : session.callee_display_name ?? resolveDisplayName(profile);

    const { token, tokenExp } = await createDailyMeetingToken({
      callType: session.call_type,
      roomName: session.daily_room_name,
      userId: profile.id,
      userName,
    });

    logCallStep(LOG_PREFIX, "Token issued", {
      callSessionId: session.id,
      functionVersion: FUNCTION_VERSION,
      profileId: profile.id,
      tokenExp,
    });

    return jsonResponse(req, 200, {
      room_url: session.daily_room_url,
      success: true,
      token,
      token_expires_at: new Date(tokenExp * 1000).toISOString(),
      user_name: userName,
    });
  } catch (error) {
    logCallStep(LOG_PREFIX, "Error", {
      error: error instanceof Error ? error.message : String(error),
    });

    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Unable to join the call session.";
    return jsonResponse(req, status, {
      success: false,
      error: message,
    });
  }
});
