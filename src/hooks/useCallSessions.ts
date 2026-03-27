import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFamilyRole } from "@/hooks/useFamilyRole";
import type { CallSessionRow, CallSource, CallType } from "@/lib/calls";
import { toast } from "sonner";

const OPEN_STATUSES = ["ringing", "accepted"] as const;

export const useCallSessions = (activeThreadId: string | null) => {
  const { activeFamilyId, profileId } = useFamilyRole();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<CallSessionRow[]>([]);

  const fetchSessions = useCallback(async () => {
    if (!activeFamilyId || !profileId) {
      setSessions([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("call_sessions")
      .select("*")
      .eq("family_id", activeFamilyId)
      .in("status", [...OPEN_STATUSES])
      .or(`initiator_profile_id.eq.${profileId},callee_profile_id.eq.${profileId}`)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching call sessions:", error);
      toast.error("Unable to load call status right now.");
      setLoading(false);
      return;
    }

    setSessions(data ?? []);
    setLoading(false);
  }, [activeFamilyId, profileId]);

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    if (!activeFamilyId) {
      return;
    }

    const channel = supabase
      .channel(`call-sessions-${activeFamilyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "call_sessions",
          filter: `family_id=eq.${activeFamilyId}`,
        },
        () => {
          void fetchSessions();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeFamilyId, fetchSessions]);

  const createCall = useCallback(
    async (params: {
      callType: CallType;
      calleeProfileId: string;
      source?: CallSource;
      threadId?: string | null;
    }) => {
      if (!activeFamilyId) {
        toast.error("Open a family conversation before starting a call.");
        return null;
      }

      const { data, error } = await supabase.functions.invoke("create-call-session", {
        body: {
          call_type: params.callType,
          callee_profile_id: params.calleeProfileId,
          family_id: activeFamilyId,
          source: params.source ?? "messaging_hub",
          thread_id: params.threadId ?? null,
        },
      });

      if (error || !data?.success) {
        toast.error(data?.error ?? error?.message ?? "Unable to start the call.");
        return null;
      }

      await fetchSessions();
      return data.session as CallSessionRow;
    },
    [activeFamilyId, fetchSessions],
  );

  const respondToCall = useCallback(
    async (callSessionId: string, response: "accept" | "decline") => {
      const { data, error } = await supabase.functions.invoke("respond-to-call", {
        body: {
          call_session_id: callSessionId,
          response,
        },
      });

      if (error || !data?.success) {
        toast.error(data?.error ?? error?.message ?? "Unable to update the call.");
        return null;
      }

      await fetchSessions();
      return data.session as CallSessionRow;
    },
    [fetchSessions],
  );

  const endCall = useCallback(
    async (
      callSessionId: string,
      outcome?: "cancelled" | "ended" | "failed" | "missed",
      failedReason?: string,
    ) => {
      const { data, error } = await supabase.functions.invoke("end-call-session", {
        body: {
          call_session_id: callSessionId,
          outcome,
          failed_reason: failedReason,
        },
      });

      if (error || !data?.success) {
        toast.error(data?.error ?? error?.message ?? "Unable to end the call.");
        return null;
      }

      await fetchSessions();
      return data.session as CallSessionRow;
    },
    [fetchSessions],
  );

  const currentThreadCall = useMemo(() => {
    if (!activeThreadId) {
      return null;
    }

    return sessions.find((session) => session.thread_id === activeThreadId) ?? null;
  }, [activeThreadId, sessions]);

  const incomingSession = useMemo(() => {
    if (!profileId) {
      return null;
    }

    return (
      sessions.find(
        (session) => session.status === "ringing" && session.callee_profile_id === profileId,
      ) ?? null
    );
  }, [profileId, sessions]);

  const activeSession = useMemo(() => {
    if (!profileId) {
      return null;
    }

    return (
      sessions.find(
        (session) =>
          session.status === "accepted" &&
          (session.initiator_profile_id === profileId || session.callee_profile_id === profileId),
      ) ?? null
    );
  }, [profileId, sessions]);

  return {
    activeSession,
    createCall,
    currentThreadCall,
    endCall,
    fetchSessions,
    incomingSession,
    loading,
    respondToCall,
    sessions,
  };
};
