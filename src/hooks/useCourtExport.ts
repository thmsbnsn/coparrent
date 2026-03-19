import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface ExportProfile {
  id: string;
  full_name: string | null;
  email: string | null;
}

export interface ExportMessage {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  sender_name: string | null;
  sender_role: string;
  thread_name: string | null;
  thread_type: string;
}

export interface ExportExpense {
  id: string;
  amount: number;
  description: string;
  category: string;
  expense_date: string;
  split_percentage: number | null;
  notes: string | null;
  created_by: string;
  child?: { name: string } | null;
}

export interface ExportScheduleRequest {
  id: string;
  request_type: string;
  original_date: string;
  proposed_date: string | null;
  reason: string | null;
  status: string;
  requester_id: string;
  recipient_id: string;
  created_at: string;
  updated_at: string;
}

export interface ExportExchangeCheckin {
  id: string;
  exchange_date: string;
  checked_in_at: string;
  note: string | null;
  user_id: string;
}

export interface ExportDocumentAccessLog {
  id: string;
  document_id: string;
  document_title: string;
  action: string;
  accessed_by: string;
  accessed_by_name: string | null;
  created_at: string;
}

// Journal entries are intentionally excluded from court exports to preserve privacy

export interface ExportSchedule {
  id: string;
  pattern: string;
  start_date: string;
  exchange_time: string | null;
  exchange_location: string | null;
  holidays: unknown;
}

export interface CourtExportData {
  userProfile: ExportProfile | null;
  coParent: ExportProfile | null;
  messages: ExportMessage[];
  expenses: ExportExpense[];
  scheduleRequests: ExportScheduleRequest[];
  exchangeCheckins: ExportExchangeCheckin[];
  documentAccessLogs: ExportDocumentAccessLog[];
  schedule: ExportSchedule | null;
  dateRange: { start: Date; end: Date };
  children: { id: string; name: string }[];
}

export const useCourtExport = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const fetchExportData = useCallback(async (
    dateRange: { start: Date; end: Date }
  ): Promise<CourtExportData | null> => {
    if (!user) {
      toast.error("You must be logged in to export data");
      return null;
    }

    setLoading(true);

    try {
      // Fetch user profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email, co_parent_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileError || !profile) {
        throw new Error("Failed to fetch user profile");
      }

      // Fetch co-parent profile
      let coParent: ExportProfile | null = null;
      if (profile.co_parent_id) {
        const { data: coParentData } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("id", profile.co_parent_id)
          .maybeSingle();
        coParent = coParentData;
      }

      const startStr = dateRange.start.toISOString();
      const endStr = dateRange.end.toISOString();

      // Fetch all data in parallel (journal entries excluded for privacy)
      const [
        threadMessagesRes,
        expensesRes,
        scheduleRequestsRes,
        exchangeCheckinsRes,
        scheduleRes,
        childrenRes,
        documentAccessLogsRes,
      ] = await Promise.all([
        // Thread Messages (new messaging system)
        supabase
          .from("thread_messages")
          .select(`
            id,
            content,
            created_at,
            sender_id,
            sender_role,
            thread:message_threads(name, thread_type, primary_parent_id)
          `)
          .gte("created_at", startStr)
          .lte("created_at", endStr)
          .order("created_at", { ascending: true }),

        // Expenses
        supabase
          .from("expenses")
          .select("id, amount, description, category, expense_date, split_percentage, notes, created_by, child:children(name)")
          .gte("expense_date", dateRange.start.toISOString().split('T')[0])
          .lte("expense_date", dateRange.end.toISOString().split('T')[0])
          .order("expense_date", { ascending: true }),

        // Schedule Requests
        supabase
          .from("schedule_requests")
          .select("*")
          .or(`requester_id.eq.${profile.id},recipient_id.eq.${profile.id}`)
          .gte("created_at", startStr)
          .lte("created_at", endStr)
          .order("created_at", { ascending: true }),

        // Exchange Checkins
        supabase
          .from("exchange_checkins")
          .select("id, exchange_date, checked_in_at, note, user_id")
          .eq("user_id", user.id)
          .gte("exchange_date", dateRange.start.toISOString().split('T')[0])
          .lte("exchange_date", dateRange.end.toISOString().split('T')[0])
          .order("exchange_date", { ascending: true }),

        // Custody Schedule
        supabase
          .from("custody_schedules")
          .select("id, pattern, start_date, exchange_time, exchange_location, holidays")
          .or(`parent_a_id.eq.${profile.id},parent_b_id.eq.${profile.id}`)
          .maybeSingle(),

        // Children
        supabase
          .from("parent_children")
          .select("child:children(id, name)")
          .eq("parent_id", profile.id),

        // Document Access Logs
        supabase
          .from("document_access_logs")
          .select(`
            id,
            document_id,
            action,
            accessed_by,
            created_at,
            document:documents(title, uploaded_by)
          `)
          .gte("created_at", startStr)
          .lte("created_at", endStr)
          .order("created_at", { ascending: true }),
        // Journal entries intentionally excluded from court exports to preserve privacy
      ]);

      // Process thread messages - filter to user's family threads
      const rawThreadMessages = threadMessagesRes.data || [];
      const messages: ExportMessage[] = rawThreadMessages
        .filter(msg => {
          const thread = msg.thread as { primary_parent_id: string; thread_type: string } | null;
          if (!thread) return false;
          // Include if user is primary parent or co-parent is primary parent
          return thread.primary_parent_id === profile.id || 
                 thread.primary_parent_id === profile.co_parent_id;
        })
        .map(msg => {
          const thread = msg.thread as { name: string | null; thread_type: string } | null;
          const isSender = msg.sender_id === profile.id;
          return {
            id: msg.id,
            content: msg.content,
            created_at: msg.created_at,
            sender_id: msg.sender_id,
            sender_name: isSender 
              ? (profile.full_name || 'You') 
              : (coParent?.full_name || 'Co-Parent'),
            sender_role: msg.sender_role,
            thread_name: thread?.name || null,
            thread_type: thread?.thread_type || 'unknown',
          };
        });

      const expenses = expensesRes.data || [];
      const scheduleRequests = scheduleRequestsRes.data || [];
      const exchangeCheckins = exchangeCheckinsRes.data || [];
      const schedule = scheduleRes.data;
      const children = (childrenRes.data || [])
        .filter(pc => pc.child)
        .map(pc => pc.child as { id: string; name: string });

      // Process document access logs
      const rawAccessLogs = documentAccessLogsRes.data || [];
      const documentAccessLogs: ExportDocumentAccessLog[] = rawAccessLogs
        .filter(log => {
          const doc = log.document as { title: string; uploaded_by: string } | null;
          return doc && (doc.uploaded_by === profile.id || log.accessed_by === profile.id);
        })
        .map(log => {
          const doc = log.document as { title: string; uploaded_by: string } | null;
          const isUser = log.accessed_by === profile.id;
          const isCoParent = log.accessed_by === coParent?.id;
          return {
            id: log.id,
            document_id: log.document_id,
            document_title: doc?.title || 'Unknown Document',
            action: log.action,
            accessed_by: log.accessed_by,
            accessed_by_name: isUser 
              ? (profile.full_name || 'You') 
              : isCoParent 
                ? (coParent?.full_name || 'Co-Parent')
                : 'Unknown',
            created_at: log.created_at,
          };
        });

      return {
        userProfile: { id: profile.id, full_name: profile.full_name, email: profile.email },
        coParent,
        messages,
        expenses: expenses.map(e => ({
          ...e,
          child: e.child ? { name: (e.child as { name: string }).name } : null
        })),
        scheduleRequests,
        exchangeCheckins,
        documentAccessLogs,
        schedule,
        dateRange,
        children,
      };
    } catch (error) {
      console.error("Error fetching export data:", error);
      toast.error("Failed to fetch export data");
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  return {
    loading,
    fetchExportData,
  };
};
