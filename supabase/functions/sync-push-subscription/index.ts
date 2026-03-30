import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { strictCors, getCorsHeaders } from "../_shared/cors.ts";

interface SyncPayload {
  action: "upsert" | "revoke";
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
  platform?: string;
  userAgent?: string;
}

interface CallerProfile {
  id: string;
}

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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

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

    const payload = await req.json() as SyncPayload;
    const endpoint = payload.endpoint?.trim();

    if (!payload.action || !["upsert", "revoke"].includes(payload.action)) {
      return new Response(
        JSON.stringify({ error: "Invalid action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!endpoint) {
      return new Response(
        JSON.stringify({ error: "Missing endpoint" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: callerProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError || !callerProfile) {
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const typedProfile = callerProfile as CallerProfile;

    if (payload.action === "revoke") {
      const { error: revokeError, count } = await supabase
        .from("push_subscriptions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("profile_id", typedProfile.id)
        .eq("endpoint", endpoint)
        .is("revoked_at", null);

      if (revokeError) {
        console.error("Failed to revoke push subscription:", revokeError);
        return new Response(
          JSON.stringify({ error: "Failed to revoke push subscription" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ ok: true, action: "revoke", revoked: count ?? 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const p256dh = payload.keys?.p256dh?.trim();
    const auth = payload.keys?.auth?.trim();

    if (!p256dh || !auth) {
      return new Response(
        JSON.stringify({ error: "Missing subscription keys" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const normalizedPlatform = payload.platform?.slice(0, 80) ?? null;
    const normalizedUserAgent = (payload.userAgent ?? req.headers.get("user-agent") ?? "").slice(0, 500) || null;

    const { data: activeMembership } = await supabase
      .from("family_members")
      .select("family_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: existingSubscription } = await supabase
      .from("push_subscriptions")
      .select("id")
      .eq("profile_id", typedProfile.id)
      .eq("endpoint", endpoint)
      .maybeSingle();

    const writePayload = {
      profile_id: typedProfile.id,
      family_id: activeMembership?.family_id ?? null,
      endpoint,
      p256dh_key: p256dh,
      auth_key: auth,
      platform: normalizedPlatform,
      user_agent: normalizedUserAgent,
      revoked_at: null,
      updated_at: new Date().toISOString(),
    };

    const subscriptionWrite = existingSubscription
      ? await supabase
          .from("push_subscriptions")
          .update(writePayload)
          .eq("id", existingSubscription.id)
          .select("id, profile_id, platform, endpoint, updated_at")
          .single()
      : await supabase
          .from("push_subscriptions")
          .insert(writePayload)
          .select("id, profile_id, platform, endpoint, updated_at")
          .single();

    if (subscriptionWrite.error || !subscriptionWrite.data) {
      console.error("Failed to sync push subscription:", subscriptionWrite.error);
      return new Response(
        JSON.stringify({ error: "Failed to sync push subscription" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        action: "upsert",
        subscription: subscriptionWrite.data,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("sync-push-subscription error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
