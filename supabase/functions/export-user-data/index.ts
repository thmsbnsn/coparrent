import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface ExportData {
  profile: Record<string, unknown>;
  children: Record<string, unknown>[];
  messages: Record<string, unknown>[];
  documents: Record<string, unknown>[];
  expenses: Record<string, unknown>[];
  journal_entries: Record<string, unknown>[];
  schedule_requests: Record<string, unknown>[];
  exchange_checkins: Record<string, unknown>[];
  notifications: Record<string, unknown>[];
  audit_logs: Record<string, unknown>[];
  export_metadata: {
    exported_at: string;
    user_email: string;
    gdpr_request: boolean;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) {
    return preflightResponse;
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const anonClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get the current user
    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all user data in parallel
    const [
      childrenResult,
      messagesResult,
      documentsResult,
      expensesResult,
      journalResult,
      scheduleResult,
      exchangeResult,
      notificationsResult,
      auditResult,
    ] = await Promise.all([
      // Children linked to this parent - get child IDs first
      supabase
        .from("parent_children")
        .select("child_id")
        .eq("parent_id", profile.id),
      
      // Messages sent by user
      supabase
        .from("thread_messages")
        .select("id, content, created_at, thread_id, sender_role")
        .eq("sender_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(1000),
      
      // Documents uploaded by user
      supabase
        .from("documents")
        .select("id, title, file_name, category, created_at")
        .eq("uploaded_by", profile.id)
        .order("created_at", { ascending: false }),
      
      // Expenses created by user
      supabase
        .from("expenses")
        .select("id, description, amount, category, expense_date, created_at")
        .eq("created_by", profile.id)
        .order("created_at", { ascending: false }),
      
      // Journal entries
      supabase
        .from("journal_entries")
        .select("id, title, content, mood, tags, created_at")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false }),
      
      // Schedule requests
      supabase
        .from("schedule_requests")
        .select("*")
        .or(`requester_id.eq.${profile.id},recipient_id.eq.${profile.id}`)
        .order("created_at", { ascending: false }),
      
      // Exchange check-ins
      supabase
        .from("exchange_checkins")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false }),
      
      // Notifications
      supabase
        .from("notifications")
        .select("id, title, message, type, created_at, read_at")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(500),
      
      // Audit logs for user
      supabase
        .from("audit_logs")
        .select("id, action, entity_type, created_at")
        .eq("actor_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

    // Fetch children details separately
    const childIds = childrenResult.data?.map((c: { child_id: string }) => c.child_id) || [];
    let childrenData: Record<string, unknown>[] = [];
    if (childIds.length > 0) {
      const { data: children } = await supabase
        .from("children")
        .select("name, date_of_birth, grade, school_name, created_at")
        .in("id", childIds);
      childrenData = (children || []) as Record<string, unknown>[];
    }

    // Sanitize profile data (remove internal IDs and sensitive fields)
    const sanitizedProfile = {
      full_name: profile.full_name,
      email: profile.email,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
      subscription_status: profile.subscription_status,
      subscription_tier: profile.subscription_tier,
      notification_preferences: profile.notification_preferences,
      preferences: profile.preferences,
    };

    const exportData: ExportData = {
      profile: sanitizedProfile,
      children: childrenData,
      messages: (messagesResult.data || []) as Record<string, unknown>[],
      documents: (documentsResult.data || []) as Record<string, unknown>[],
      expenses: (expensesResult.data || []) as Record<string, unknown>[],
      journal_entries: (journalResult.data || []) as Record<string, unknown>[],
      schedule_requests: (scheduleResult.data || []) as Record<string, unknown>[],
      exchange_checkins: (exchangeResult.data || []) as Record<string, unknown>[],
      notifications: (notificationsResult.data || []) as Record<string, unknown>[],
      audit_logs: (auditResult.data || []) as Record<string, unknown>[],
      export_metadata: {
        exported_at: new Date().toISOString(),
        user_email: user.email || "unknown",
        gdpr_request: true,
      },
    };

    // Log the export action via RPC (bypasses INSERT policy, captures role)
    await supabase.rpc("log_audit_event_system", {
      _actor_user_id: user.id,
      _actor_profile_id: profile.id,
      _action: "DATA_EXPORT",
      _entity_type: "user_data",
      _metadata: { export_type: "gdpr_full_export" },
    });

    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="coparrent-data-export-${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to export data" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
