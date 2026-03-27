/**
 * Send Push Notification Edge Function
 *
 * Sends real Web Push notifications using VAPID keys.
 * Requires authenticated caller and only allows self-targeted sends
 * (or admin-targeted sends for diagnostics).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { strictCors, getCorsHeaders } from "../_shared/cors.ts";
import { checkFunctionRateLimit, createRateLimitResponse } from "../_shared/functionRateLimit.ts";
import { dispatchPushNotifications } from "../_shared/push.ts";

interface PushPayload {
  profile_id: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
  silent?: boolean;
  platform_filter?: string;
  subscription_ids?: string[];
}

interface CallerProfile {
  id: string;
  account_role: string | null;
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return String(error);
};

Deno.serve(async (req) => {
  const corsResponse = strictCors(req);
  if (corsResponse) return corsResponse;
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const rateLimitResult = await checkFunctionRateLimit(
      supabaseUrl,
      supabaseKey,
      user.id,
      "send-push",
    );

    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(rateLimitResult, corsHeaders);
    }

    const payload = await req.json() as PushPayload;
    const { profile_id, title, body, url, tag, silent, platform_filter, subscription_ids } = payload;

    if (!profile_id || !title || !body) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: profile_id, title, body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: callerProfile, error: callerProfileError } = await supabase
      .from("profiles")
      .select("id, account_role")
      .eq("user_id", user.id)
      .single();

    if (callerProfileError || !callerProfile) {
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const typedCallerProfile = callerProfile as CallerProfile;
    const isAdmin = typedCallerProfile.account_role === "admin";
    const isSelfTarget = typedCallerProfile.id === profile_id;

    if (!isSelfTarget && !isAdmin) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const dispatchResult = await dispatchPushNotifications(supabase, {
      body,
      platformFilter: platform_filter ?? null,
      profileId: profile_id,
      silent,
      subscriptionIds: subscription_ids,
      tag,
      title,
      url,
    });

    if (tag === "admin-test-push") {
      await supabase.from("audit_logs").insert({
        actor_user_id: user.id,
        action: "TEST_PUSH_SENT",
        entity_type: "push_notification",
        entity_id: profile_id,
        metadata: {
          expired: dispatchResult.expired,
          failed: dispatchResult.failed,
          sent: dispatchResult.sent,
          targeted: dispatchResult.targeted,
        },
      });
    }

    if (!dispatchResult.configured) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Push notifications are not configured",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        expired: dispatchResult.expired,
        failed: dispatchResult.failed,
        platform_filter: platform_filter?.trim().toLowerCase() ?? null,
        sent: dispatchResult.sent,
        targeted: dispatchResult.targeted,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Send push error:", getErrorMessage(error));
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
