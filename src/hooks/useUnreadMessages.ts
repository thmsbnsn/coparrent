/**
 * useUnreadMessages - Tracks unread message counts across all messaging threads
 * 
 * Architecture:
 * - Uses `thread_messages` as the single source of truth
 * - Uses `message_read_receipts` to track read status per user
 * - Subscribes to realtime updates for both tables
 * - Respects notification preferences (showIndicator flag)
 * 
 * Integration:
 * - Used by MessagingHubPage for sidebar unread badges
 * - Used by DashboardLayout for navigation indicators
 * 
 * @see useMessagingHub for message fetching and sending
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFamilyRole } from "./useFamilyRole";
import { useNotifications } from "./useNotifications";

interface UnreadCount {
  threadId: string;
  threadType: string;
  count: number;
  lastMessageAt: string | null;
}

interface ThreadAccessRow {
  id: string;
  thread_type: string;
  participant_a_id: string | null;
  participant_b_id: string | null;
}

interface ThreadMessageLite {
  id: string;
  thread_id: string;
  created_at: string;
}

export const useUnreadMessages = () => {
  const { activeFamilyId, profileId, primaryParentId } = useFamilyRole();
  const { preferences } = useNotifications();
  const [unreadCounts, setUnreadCounts] = useState<UnreadCount[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchUnreadCounts = useCallback(async () => {
    if (!profileId || (!activeFamilyId && !primaryParentId)) {
      setUnreadCounts([]);
      setTotalUnread(0);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // Fetch thread access once, then batch unread work across the accessible set.
      const scopedThreadMap = new Map<string, ThreadAccessRow>();

      if (activeFamilyId) {
        const { data: familyThreads, error: familyThreadsError } = await supabase
          .from("message_threads")
          .select("id, thread_type, participant_a_id, participant_b_id")
          .eq("family_id", activeFamilyId);

        if (familyThreadsError) throw familyThreadsError;

        (familyThreads as ThreadAccessRow[] | null)?.forEach((thread) => {
          scopedThreadMap.set(thread.id, thread);
        });
      }

      if (primaryParentId) {
        const { data: legacyThreads, error: legacyThreadsError } = await supabase
          .from("message_threads")
          .select("id, thread_type, participant_a_id, participant_b_id")
          .is("family_id", null)
          .eq("primary_parent_id", primaryParentId);

        if (legacyThreadsError) throw legacyThreadsError;

        (legacyThreads as ThreadAccessRow[] | null)?.forEach((thread) => {
          scopedThreadMap.set(thread.id, thread);
        });
      }

      const threads = Array.from(scopedThreadMap.values());

      const accessibleThreads: ThreadAccessRow[] = [];

      threads.forEach((thread) => {
        if (thread.thread_type === "family_channel") {
          accessibleThreads.push(thread);
          return;
        }

        if (
          thread.thread_type === "direct_message" &&
          (thread.participant_a_id === profileId || thread.participant_b_id === profileId)
        ) {
          accessibleThreads.push(thread);
        }
      });

      const groupChatIds = threads
        .filter((thread) => thread.thread_type === "group_chat")
        .map((thread) => thread.id);

      if (groupChatIds.length > 0) {
        const { data: groupParticipations, error: groupParticipationsError } = await supabase
          .from("group_chat_participants")
          .select("thread_id")
          .in("thread_id", groupChatIds)
          .eq("profile_id", profileId);

        if (groupParticipationsError) throw groupParticipationsError;

        const allowedGroupIds = new Set((groupParticipations || []).map((item) => item.thread_id));
        threads
          .filter((thread) => thread.thread_type === "group_chat" && allowedGroupIds.has(thread.id))
          .forEach((thread) => accessibleThreads.push(thread));
      }

      if (accessibleThreads.length === 0) {
        setUnreadCounts([]);
        setTotalUnread(0);
        return;
      }

      const accessibleThreadIds = accessibleThreads.map((thread) => thread.id);

      const { data: unreadMessages, error: unreadError } = await supabase
        .from("thread_messages")
        .select("id, thread_id, created_at")
        .in("thread_id", accessibleThreadIds)
        .neq("sender_id", profileId);

      if (unreadError) throw unreadError;

      const candidateMessages = (unreadMessages || []) as ThreadMessageLite[];
      if (candidateMessages.length === 0) {
        setUnreadCounts([]);
        setTotalUnread(0);
        return;
      }

      const { data: readReceipts, error: readReceiptsError } = await supabase
        .from("message_read_receipts")
        .select("message_id")
        .in("message_id", candidateMessages.map((message) => message.id))
        .eq("reader_id", profileId);

      if (readReceiptsError) throw readReceiptsError;

      const readMessageIds = new Set((readReceipts || []).map((receipt) => receipt.message_id));
      const threadTypeLookup = new Map(accessibleThreads.map((thread) => [thread.id, thread.thread_type]));
      const countsByThread = new Map<string, UnreadCount>();

      candidateMessages.forEach((message) => {
        if (readMessageIds.has(message.id)) {
          return;
        }

        const existing = countsByThread.get(message.thread_id);
        if (existing) {
          existing.count += 1;
          if (
            !existing.lastMessageAt ||
            new Date(message.created_at).getTime() > new Date(existing.lastMessageAt).getTime()
          ) {
            existing.lastMessageAt = message.created_at;
          }
          return;
        }

        countsByThread.set(message.thread_id, {
          threadId: message.thread_id,
          threadType: threadTypeLookup.get(message.thread_id) || "direct_message",
          count: 1,
          lastMessageAt: message.created_at,
        });
      });

      const counts = Array.from(countsByThread.values()).sort((a, b) => {
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bTime - aTime;
      });

      setUnreadCounts(counts);
      setTotalUnread(counts.reduce((sum, c) => sum + c.count, 0));
    } catch (error) {
      console.error("Error fetching unread counts:", error);
    } finally {
      setLoading(false);
    }
  }, [activeFamilyId, profileId, primaryParentId]);

  // Initial fetch
  useEffect(() => {
    fetchUnreadCounts();
  }, [fetchUnreadCounts]);

  // Subscribe to new messages
  useEffect(() => {
    if (!activeFamilyId && !primaryParentId) return;

    const channel = supabase
      .channel("unread-messages-updates")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "thread_messages",
        },
        () => {
          // Refetch counts when new message arrives
          fetchUnreadCounts();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message_read_receipts",
        },
        () => {
          // Refetch counts when message is read
          fetchUnreadCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeFamilyId, primaryParentId, fetchUnreadCounts]);

  // Helper to check if notifications are enabled
  const showIndicator = preferences.enabled && preferences.new_messages;

  const getUnreadForThread = (threadId: string) => {
    return unreadCounts.find(c => c.threadId === threadId)?.count || 0;
  };

  const getUnreadByType = (threadType: string) => {
    return unreadCounts
      .filter(c => c.threadType === threadType)
      .reduce((sum, c) => sum + c.count, 0);
  };

  return {
    unreadCounts,
    totalUnread,
    loading,
    showIndicator,
    getUnreadForThread,
    getUnreadByType,
    refresh: fetchUnreadCounts,
  };
};
