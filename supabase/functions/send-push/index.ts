/**
 * Send Push Notification Edge Function
 *
 * Sends real Web Push notifications using VAPID keys.
 * Requires authenticated caller and only allows self-targeted sends
 * (or admin-targeted sends for diagnostics).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import webpush from "https://esm.sh/web-push@3.6.7";
import { strictCors, getCorsHeaders } from "../_shared/cors.ts";
import { checkFunctionRateLimit, createRateLimitResponse } from "../_shared/functionRateLimit.ts";

interface PushPayload {
  profile_id: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
  silent?: boolean;
}

interface CallerProfile {
  id: string;
  account_role: string | null;
}

interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
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
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
    const supportEmail = Deno.env.get("SUPPORT_EMAIL") ?? "support@coparrent.com";

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.warn("VAPID keys not configured - push notifications disabled");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Push notifications are not configured",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
    const { profile_id, title, body, url, tag, silent } = payload;

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

    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh_key, auth_key")
      .eq("profile_id", profile_id)
      .is("revoked_at", null);

    if (subError) {
      console.error("Error fetching subscriptions:", subError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch subscriptions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, failed: 0, message: "No active subscriptions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    webpush.setVapidDetails(`mailto:${supportEmail}`, vapidPublicKey, vapidPrivateKey);

    const notificationPayload = JSON.stringify({
      title: sanitizeNotificationText(title),
      message: sanitizeNotificationText(body),
      url: url || "/dashboard",
      tag: tag || "coparrent-notification",
      silent: !!silent,
      id: crypto.randomUUID(),
      sentAt: new Date().toISOString(),
    });

    let sent = 0;
    let failed = 0;
    const expiredSubscriptionIds: string[] = [];

    for (const rawSub of subscriptions) {
      const sub = rawSub as PushSubscriptionRow;
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh_key,
              auth: sub.auth_key,
            },
          },
          notificationPayload,
          {
            TTL: 86400,
            urgency: "normal",
          },
        );
        sent += 1;
      } catch (error: unknown) {
        const statusCode = Number(
          (error as { statusCode?: number })?.statusCode ??
          (error as { status?: number })?.status ??
          0,
        );

        if (statusCode === 404 || statusCode === 410) {
          expiredSubscriptionIds.push(sub.id);
        }

        failed += 1;
        console.warn("Push send failed for subscription:", sub.id, getErrorMessage(error));
      }
    }

    if (expiredSubscriptionIds.length > 0) {
      const { error: revokeError } = await supabase
        .from("push_subscriptions")
        .update({ revoked_at: new Date().toISOString() })
        .in("id", expiredSubscriptionIds);

      if (revokeError) {
        console.warn("Failed to revoke expired subscriptions:", revokeError);
      }
    }

    if (tag === "admin-test-push") {
      await supabase.from("audit_logs").insert({
        actor_user_id: user.id,
        action: "TEST_PUSH_SENT",
        entity_type: "push_notification",
        entity_id: profile_id,
        metadata: { sent, failed, expired: expiredSubscriptionIds.length },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent,
        failed,
        expired: expiredSubscriptionIds.length,
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

function sanitizeNotificationText(text: string): string {
  let safeText = text;
  if (safeText.length > 200) {
    safeText = `${safeText.substring(0, 197)}...`;
  }

  safeText = safeText.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[email]");
  safeText = safeText.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, "[phone]");

  return safeText;
}
