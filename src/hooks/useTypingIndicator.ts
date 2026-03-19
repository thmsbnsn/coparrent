import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFamilyRole } from "./useFamilyRole";
import { resolveDisplayName } from "@/lib/safeText";
import { logger } from "@/lib/logger";
interface TypingUser {
  profile_id: string;
  full_name: string | null;
  started_at: string;
}

interface TypingIndicatorRow {
  profile_id: string;
  started_at: string;
  profiles: { full_name: string | null } | null;
}

export const useTypingIndicator = (threadId: string | null) => {
  const { profileId } = useFamilyRole();
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingRef = useRef<number>(0);

  // Clear typing status
  const clearTyping = useCallback(async () => {
    if (!threadId || !profileId) return;

    try {
      await supabase
        .from("typing_indicators")
        .delete()
        .eq("thread_id", threadId)
        .eq("profile_id", profileId);
    } catch (error) {
      console.error("Error clearing typing indicator:", error);
    }
  }, [threadId, profileId]);

  // Broadcast typing status
  const setTyping = useCallback(async () => {
    if (!threadId || !profileId) return;

    const now = Date.now();
    // Throttle to once per second
    if (now - lastTypingRef.current < 1000) return;
    lastTypingRef.current = now;

    try {
      await supabase
        .from("typing_indicators")
        .upsert({
          thread_id: threadId,
          profile_id: profileId,
          started_at: new Date().toISOString(),
        }, { onConflict: "thread_id,profile_id" });

      // Clear typing after 3 seconds of inactivity
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        void clearTyping();
      }, 3000);
    } catch (error) {
      logger.error("Error setting typing indicator:", error);
    }
  }, [threadId, profileId, clearTyping]);

  // Fetch current typing users
  const fetchTypingUsers = useCallback(async () => {
    if (!threadId) return;

    try {
      // Only get typing indicators from the last 5 seconds
      const cutoff = new Date(Date.now() - 5000).toISOString();
      
      const { data } = await supabase
        .from("typing_indicators")
        .select(`
          profile_id,
          started_at,
          profiles!typing_indicators_profile_id_fkey (full_name)
        `)
        .eq("thread_id", threadId)
        .gt("started_at", cutoff)
        .neq("profile_id", profileId || "");

      const users = ((data || []) as TypingIndicatorRow[]).map((t) => ({
        profile_id: t.profile_id,
        full_name: t.profiles?.full_name,
        started_at: t.started_at,
      }));

      setTypingUsers(users);
    } catch (error) {
      console.error("Error fetching typing users:", error);
    }
  }, [threadId, profileId]);

  // Subscribe to typing indicator changes
  useEffect(() => {
    if (!threadId) return;

    // Initial fetch
    fetchTypingUsers();

    // Subscribe to changes
    const channel = supabase
      .channel(`typing-${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "typing_indicators",
          filter: `thread_id=eq.${threadId}`,
        },
        () => {
          fetchTypingUsers();
        }
      )
      .subscribe();

    // Poll every 2 seconds to clean up stale indicators
    const pollInterval = setInterval(fetchTypingUsers, 2000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [threadId, fetchTypingUsers]);

  // Clear typing when component unmounts or thread changes
  useEffect(() => {
    return () => {
      clearTyping();
    };
  }, [threadId, clearTyping]);

  // Format typing text with safe display names
  const getTypingUserName = (user: TypingUser) => 
    resolveDisplayName({ primary: user.full_name, fallback: "Someone" });

  const typingText = typingUsers.length > 0
    ? typingUsers.length === 1
      ? `${getTypingUserName(typingUsers[0])} is typing...`
      : typingUsers.length === 2
        ? `${getTypingUserName(typingUsers[0])} and ${getTypingUserName(typingUsers[1])} are typing...`
        : `${typingUsers.length} people are typing...`
    : null;

  return {
    typingUsers,
    typingText,
    setTyping,
    clearTyping,
  };
};
