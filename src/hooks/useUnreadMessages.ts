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

export const useUnreadMessages = () => {
  const { profileId, primaryParentId } = useFamilyRole();
  const { preferences } = useNotifications();
  const [unreadCounts, setUnreadCounts] = useState<UnreadCount[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchUnreadCounts = useCallback(async () => {
    if (!profileId || !primaryParentId) {
      setLoading(false);
      return;
    }

    try {
      // Fetch all threads for this user
      const { data: threads, error: threadsError } = await supabase
        .from("message_threads")
        .select("id, thread_type, updated_at")
        .eq("primary_parent_id", primaryParentId);

      if (threadsError) throw threadsError;

      const counts: UnreadCount[] = [];

      for (const thread of threads || []) {
        // Check if user has access to this thread
        if (thread.thread_type === "direct_message") {
          // For DMs, check participation through another query
          const { data: dmThread } = await supabase
            .from("message_threads")
            .select("participant_a_id, participant_b_id")
            .eq("id", thread.id)
            .single();
          
          if (!dmThread || 
              (dmThread.participant_a_id !== profileId && dmThread.participant_b_id !== profileId)) {
            continue;
          }
        } else if (thread.thread_type === "group_chat") {
          // Check group participation
          const { data: participation } = await supabase
            .from("group_chat_participants")
            .select("id")
            .eq("thread_id", thread.id)
            .eq("profile_id", profileId)
            .maybeSingle();
          
          if (!participation) continue;
        }

        // Count unread messages: messages not sent by me that I haven't read
        const { data: unreadMessages, error: unreadError } = await supabase
          .from("thread_messages")
          .select("id, created_at")
          .eq("thread_id", thread.id)
          .neq("sender_id", profileId);

        if (unreadError) continue;

        // Check which of these messages I've read
        const messageIds = (unreadMessages || []).map(m => m.id);
        if (messageIds.length === 0) continue;

        const { data: readReceipts } = await supabase
          .from("message_read_receipts")
          .select("message_id")
          .in("message_id", messageIds)
          .eq("reader_id", profileId);

        const readMessageIds = new Set((readReceipts || []).map(r => r.message_id));
        const unreadCount = messageIds.filter(id => !readMessageIds.has(id)).length;

        if (unreadCount > 0) {
          const lastMessage = unreadMessages?.sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0];

          counts.push({
            threadId: thread.id,
            threadType: thread.thread_type,
            count: unreadCount,
            lastMessageAt: lastMessage?.created_at || null,
          });
        }
      }

      setUnreadCounts(counts);
      setTotalUnread(counts.reduce((sum, c) => sum + c.count, 0));
    } catch (error) {
      console.error("Error fetching unread counts:", error);
    } finally {
      setLoading(false);
    }
  }, [profileId, primaryParentId]);

  // Initial fetch
  useEffect(() => {
    fetchUnreadCounts();
  }, [fetchUnreadCounts]);

  // Subscribe to new messages
  useEffect(() => {
    if (!primaryParentId) return;

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
  }, [primaryParentId, fetchUnreadCounts]);

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
