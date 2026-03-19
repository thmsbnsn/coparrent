import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ERROR_MESSAGES } from "@/lib/errorMessages";

export interface AuditLog {
  id: string;
  created_at: string;
  actor_user_id: string;
  actor_profile_id: string | null;
  actor_role_at_action: string | null; // Role snapshot at time of action
  action: string;
  entity_type: string;
  entity_id: string | null;
  child_id: string | null;
  family_context: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  // Joined fields
  actor_name?: string;
  actor_email?: string;
  child_name?: string;
}

interface UseAuditLogsOptions {
  childId?: string | null;
  action?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  limit?: number;
}

interface AuditLogRow extends AuditLog {
  actor?: {
    full_name: string | null;
    email: string | null;
  } | null;
  child?: {
    name: string | null;
  } | null;
}

export const useAuditLogs = (options: UseAuditLogsOptions = {}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { childId, action, startDate, endDate, limit = 100 } = options;

  const fetchLogs = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from("audit_logs")
        .select(`
          *,
          actor:profiles!audit_logs_actor_profile_id_fkey(full_name, email),
          child:children(name)
        `)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (childId) {
        query = query.eq("child_id", childId);
      }

      if (action) {
        query = query.eq("action", action);
      }

      if (startDate) {
        query = query.gte("created_at", startDate.toISOString());
      }

      if (endDate) {
        query = query.lte("created_at", endDate.toISOString());
      }

      const { data, error: queryError } = await query;

      if (queryError) {
        console.error("Error fetching audit logs:", queryError);
        setError("Failed to load audit logs");
        toast({
          title: "Error",
          description: "Failed to load audit logs",
          variant: "destructive",
        });
        return;
      }

      // Transform the data to flatten the joins
      const transformedLogs: AuditLog[] = ((data || []) as AuditLogRow[]).map((log) => ({
        ...log,
        actor_name: log.actor?.full_name || null,
        actor_email: log.actor?.email || null,
        child_name: log.child?.name || null,
      }));

      setLogs(transformedLogs);
    } catch (err) {
      console.error("Unexpected error fetching audit logs:", err);
      setError(ERROR_MESSAGES.GENERIC);
    } finally {
      setLoading(false);
    }
  }, [user, childId, action, startDate, endDate, limit, toast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("audit-logs-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "audit_logs",
        },
        (payload) => {
          // Refetch to get joined data
          fetchLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchLogs]);

  return {
    logs,
    loading,
    error,
    refetch: fetchLogs,
  };
};

// Helper to get human-readable action names
export const getActionLabel = (action: string): string => {
  const labels: Record<string, string> = {
    // Child actions
    CHILD_VIEW: "Viewed Child",
    CHILD_INSERT: "Created Child",
    CHILD_UPDATE: "Updated Child",
    CHILD_DELETE: "Deleted Child",

    // Activity/Event actions
    ACTIVITY_EVENT_VIEW: "Viewed Activity",
    ACTIVITY_EVENT_INSERT: "Created Activity Event",
    ACTIVITY_EVENT_UPDATE: "Updated Activity Event",
    ACTIVITY_EVENT_DELETE: "Deleted Activity Event",

    // Calendar actions
    CALENDAR_EVENT_VIEW: "Viewed Calendar Event",
    CALENDAR_EVENT_INSERT: "Created Calendar Event",
    CALENDAR_EVENT_UPDATE: "Updated Calendar Event",
    CALENDAR_EVENT_DELETE: "Deleted Calendar Event",

    // Message actions
    MESSAGE_VIEW: "Viewed Message",
    MESSAGE_INSERT: "Sent Message",
    MESSAGE_UPDATE: "Edited Message",
    MESSAGE_DELETE: "Deleted Message",

    // Document actions
    DOCUMENT_VIEW: "Viewed Document",
    DOCUMENT_INSERT: "Uploaded Document",
    DOCUMENT_UPDATE: "Updated Document",
    DOCUMENT_DELETE: "Deleted Document",

    // Expense actions
    EXPENSE_VIEW: "Viewed Expense",
    EXPENSE_INSERT: "Created Expense",
    EXPENSE_UPDATE: "Updated Expense",
    EXPENSE_DELETE: "Deleted Expense",

    // Gift actions
    GIFT_LIST_VIEW: "Viewed Gift List",
    GIFT_LIST_INSERT: "Created Gift List",
    GIFT_LIST_UPDATE: "Updated Gift List",
    GIFT_LIST_DELETE: "Deleted Gift List",
    GIFT_ITEM_VIEW: "Viewed Gift Item",
    GIFT_ITEM_INSERT: "Added Gift Item",
    GIFT_ITEM_UPDATE: "Updated Gift Item",
    GIFT_ITEM_DELETE: "Removed Gift Item",

    // Chore actions
    CHORE_VIEW: "Viewed Chore",
    CHORE_INSERT: "Created Chore",
    CHORE_UPDATE: "Updated Chore",
    CHORE_DELETE: "Deleted Chore",
    CHORE_COMPLETE: "Completed Chore",

    // Permission actions
    PERMISSION_VIEW: "Viewed Permissions",
    PERMISSION_UPDATE: "Updated Permissions",

    // Profile actions
    PROFILE_VIEW: "Viewed Profile",
    PROFILE_UPDATE: "Updated Profile",

    // Family actions
    FAMILY_MEMBER_VIEW: "Viewed Family Member",
    FAMILY_MEMBER_INSERT: "Added Family Member",
    FAMILY_MEMBER_UPDATE: "Updated Family Member",
    FAMILY_MEMBER_DELETE: "Removed Family Member",

    // Notification actions
    NOTIFICATION_VIEW: "Viewed Notification",
    NOTIFICATION_SEND: "Sent Notification",

    // Data export
    DATA_EXPORT: "Exported Data",

    // Admin actions
    ADMIN_CLEANUP: "Admin Cleanup",
  };
  return labels[action] || action;
};

// Helper to get action color/variant
export const getActionVariant = (action: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (action) {
    // Destructive actions (deletions)
    case "CHILD_DELETE":
    case "ACTIVITY_EVENT_DELETE":
    case "CALENDAR_EVENT_DELETE":
    case "MESSAGE_DELETE":
    case "DOCUMENT_DELETE":
    case "EXPENSE_DELETE":
    case "GIFT_LIST_DELETE":
    case "GIFT_ITEM_DELETE":
    case "CHORE_DELETE":
    case "FAMILY_MEMBER_DELETE":
      return "destructive";

    // Creation actions
    case "CHILD_INSERT":
    case "ACTIVITY_EVENT_INSERT":
    case "CALENDAR_EVENT_INSERT":
    case "MESSAGE_INSERT":
    case "DOCUMENT_INSERT":
    case "EXPENSE_INSERT":
    case "GIFT_LIST_INSERT":
    case "GIFT_ITEM_INSERT":
    case "CHORE_INSERT":
    case "FAMILY_MEMBER_INSERT":
    case "NOTIFICATION_SEND":
      return "default";

    // Update actions
    case "CHILD_UPDATE":
    case "ACTIVITY_EVENT_UPDATE":
    case "CALENDAR_EVENT_UPDATE":
    case "MESSAGE_UPDATE":
    case "DOCUMENT_UPDATE":
    case "EXPENSE_UPDATE":
    case "GIFT_LIST_UPDATE":
    case "GIFT_ITEM_UPDATE":
    case "CHORE_UPDATE":
    case "PERMISSION_UPDATE":
    case "PROFILE_UPDATE":
    case "FAMILY_MEMBER_UPDATE":
      return "secondary";

    // View/read actions
    case "CHILD_VIEW":
    case "ACTIVITY_EVENT_VIEW":
    case "CALENDAR_EVENT_VIEW":
    case "MESSAGE_VIEW":
    case "DOCUMENT_VIEW":
    case "EXPENSE_VIEW":
    case "GIFT_LIST_VIEW":
    case "GIFT_ITEM_VIEW":
    case "CHORE_VIEW":
    case "PERMISSION_VIEW":
    case "PROFILE_VIEW":
    case "FAMILY_MEMBER_VIEW":
    case "NOTIFICATION_VIEW":
    case "DATA_EXPORT":
    case "ADMIN_CLEANUP":
    default:
      return "outline";
  }
};

// Helper to get human-readable role names
export const getRoleLabel = (role: string | null): string => {
  if (!role) return "Unknown";
  const labels: Record<string, string> = {
    parent: "Parent",
    co_parent: "Co-Parent",
    third_party: "Third-Party",
    child: "Child",
    admin: "Admin",
    system: "System",
  };
  return labels[role] || role;
};

// Helper to get role badge variant
export const getRoleVariant = (role: string | null): "default" | "secondary" | "outline" => {
  switch (role) {
    case "admin":
    case "system":
      return "default";
    case "parent":
    case "co_parent":
      return "secondary";
    default:
      return "outline";
  }
};
