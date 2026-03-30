import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamily } from "@/contexts/FamilyContext";
import { fetchFamilyChildIds, fetchFamilyParentProfiles } from "@/lib/familyScope";
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
  const { activeFamilyId, loading: familyLoading, profileId } = useFamily();
  const [loading, setLoading] = useState(false);

  const fetchExportData = useCallback(async (
    dateRange: { start: Date; end: Date }
  ): Promise<CourtExportData | null> => {
    if (!user) {
      toast.error("You must be logged in to export data");
      return null;
    }

    if (familyLoading) {
      toast.error("Family context is still loading");
      return null;
    }

    if (!activeFamilyId || !profileId) {
      toast.error("Select an active family before exporting data");
      return null;
    }

    setLoading(true);

    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", profileId)
        .maybeSingle();

      if (profileError || !profile) {
        throw new Error("Failed to fetch user profile");
      }

      const [familyParentProfiles, familyChildIds] = await Promise.all([
        fetchFamilyParentProfiles(activeFamilyId),
        fetchFamilyChildIds(activeFamilyId),
      ]);

      const otherParentProfileIds = familyParentProfiles
        .map((familyParent) => familyParent.profileId)
        .filter((familyProfileId) => familyProfileId !== profileId);

      const startStr = dateRange.start.toISOString();
      const endStr = dateRange.end.toISOString();
      const startDateOnly = startStr.split("T")[0];
      const endDateOnly = endStr.split("T")[0];

      const [
        threadRes,
        expensesRes,
        scheduleRequestsRes,
        scheduleRes,
        documentAccessLogsRes,
        childrenRes,
      ] = await Promise.all([
        supabase
          .from("message_threads")
          .select("id, name, thread_type")
          .eq("family_id", activeFamilyId),

        supabase
          .from("expenses")
          .select("id, amount, description, category, expense_date, split_percentage, notes, created_by, child:children(name)")
          .eq("family_id", activeFamilyId)
          .gte("expense_date", startDateOnly)
          .lte("expense_date", endDateOnly)
          .order("expense_date", { ascending: true }),

        supabase
          .from("schedule_requests")
          .select("*")
          .eq("family_id", activeFamilyId)
          .gte("created_at", startStr)
          .lte("created_at", endStr)
          .order("created_at", { ascending: true }),

        supabase
          .from("custody_schedules")
          .select("id, pattern, start_date, exchange_time, exchange_location, holidays")
          .eq("family_id", activeFamilyId)
          .maybeSingle(),

        supabase
          .from("document_access_logs")
          .select(`
            id,
            document_id,
            action,
            accessed_by,
            created_at,
            document:documents(title, uploaded_by, family_id)
          `)
          .gte("created_at", startStr)
          .lte("created_at", endStr)
          .order("created_at", { ascending: true }),

        familyChildIds.length > 0
          ? supabase
              .from("children")
              .select("id, name")
              .in("id", familyChildIds)
              .order("name")
          : Promise.resolve({ data: [] as Array<{ id: string; name: string }>, error: null }),
      ]);

      if (threadRes.error) throw threadRes.error;
      if (expensesRes.error) throw expensesRes.error;
      if (scheduleRequestsRes.error) throw scheduleRequestsRes.error;
      if (scheduleRes.error) throw scheduleRes.error;
      if (documentAccessLogsRes.error) throw documentAccessLogsRes.error;
      if (childrenRes.error) throw childrenRes.error;

      const threadIds = (threadRes.data ?? []).map((thread) => thread.id);

      const threadMessagesRes = threadIds.length > 0
        ? await supabase
            .from("thread_messages")
            .select(`
              id,
              content,
              created_at,
              sender_id,
              sender_role,
              thread_id,
              thread:message_threads(name, thread_type)
            `)
            .in("thread_id", threadIds)
            .gte("created_at", startStr)
            .lte("created_at", endStr)
            .order("created_at", { ascending: true })
        : { data: [], error: null };

      if (threadMessagesRes.error) {
        throw threadMessagesRes.error;
      }

      const scheduleIds = scheduleRes.data?.id ? [scheduleRes.data.id] : [];
      const exchangeCheckinsRes = scheduleIds.length > 0
        ? await supabase
            .from("exchange_checkins")
            .select("id, exchange_date, checked_in_at, note, user_id")
            .in("schedule_id", scheduleIds)
            .gte("exchange_date", startDateOnly)
            .lte("exchange_date", endDateOnly)
            .order("exchange_date", { ascending: true })
        : { data: [], error: null };

      if (exchangeCheckinsRes.error) {
        throw exchangeCheckinsRes.error;
      }

      const relatedProfileIds = [...new Set([
        ...otherParentProfileIds,
        ...(threadMessagesRes.data ?? []).map((message) => message.sender_id),
        ...(documentAccessLogsRes.data ?? []).map((log) => log.accessed_by),
      ].filter((value): value is string => Boolean(value)))];

      const relatedProfilesRes = relatedProfileIds.length > 0
        ? await supabase
            .from("profiles")
            .select("id, full_name, email")
            .in("id", relatedProfileIds)
        : { data: [] as ExportProfile[], error: null };

      if (relatedProfilesRes.error) {
        throw relatedProfilesRes.error;
      }

      const relatedProfiles = new Map(
        (relatedProfilesRes.data ?? []).map((relatedProfile) => [relatedProfile.id, relatedProfile]),
      );

      const coParent = otherParentProfileIds
        .map((otherParentProfileId) => relatedProfiles.get(otherParentProfileId) ?? null)
        .find((candidate): candidate is ExportProfile => Boolean(candidate)) ?? null;

      const messages: ExportMessage[] = (threadMessagesRes.data ?? []).map((message) => {
        const thread = message.thread as { name: string | null; thread_type: string } | null;
        const senderProfile = relatedProfiles.get(message.sender_id) ?? null;

        return {
          id: message.id,
          content: message.content,
          created_at: message.created_at,
          sender_id: message.sender_id,
          sender_name:
            message.sender_id === profile.id
              ? (profile.full_name || "You")
              : (senderProfile?.full_name || senderProfile?.email || "Unknown"),
          sender_role: message.sender_role,
          thread_name: thread?.name ?? null,
          thread_type: thread?.thread_type ?? "unknown",
        };
      });

      const rawAccessLogs = documentAccessLogsRes.data ?? [];
      const documentAccessLogs: ExportDocumentAccessLog[] = rawAccessLogs
        .filter((log) => {
          const document = log.document as { title: string; uploaded_by: string; family_id: string | null } | null;
          return document?.family_id === activeFamilyId;
        })
        .map((log) => {
          const document = log.document as { title: string; uploaded_by: string; family_id: string | null } | null;
          const accessedByProfile = relatedProfiles.get(log.accessed_by) ?? null;

          return {
            id: log.id,
            document_id: log.document_id,
            document_title: document?.title || "Unknown Document",
            action: log.action,
            accessed_by: log.accessed_by,
            accessed_by_name:
              log.accessed_by === profile.id
                ? (profile.full_name || "You")
                : (accessedByProfile?.full_name || accessedByProfile?.email || "Unknown"),
            created_at: log.created_at,
          };
        });

      return {
        userProfile: { id: profile.id, full_name: profile.full_name, email: profile.email },
        coParent,
        messages,
        expenses: (expensesRes.data ?? []).map((expense) => ({
          ...expense,
          child: expense.child ? { name: (expense.child as { name: string }).name } : null,
        })),
        scheduleRequests: scheduleRequestsRes.data ?? [],
        exchangeCheckins: exchangeCheckinsRes.data ?? [],
        documentAccessLogs,
        schedule: scheduleRes.data ?? null,
        dateRange,
        children: childrenRes.data ?? [],
      };
    } catch (error) {
      console.error("Error fetching export data:", error);
      toast.error("Failed to fetch export data");
      return null;
    } finally {
      setLoading(false);
    }
  }, [activeFamilyId, familyLoading, profileId, user]);

  return {
    loading,
    fetchExportData,
  };
};
