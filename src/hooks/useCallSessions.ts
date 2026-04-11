import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFamily } from "@/contexts/FamilyContext";
import type { CallSessionRow, CallSource, CallType } from "@/lib/calls";
import { toast } from "sonner";

const OPEN_STATUSES = ["ringing", "accepted"] as const;
export const CALL_SESSION_MUTATION_EVENT = "coparrent:call-session-mutated";

const notifyCallSessionMutation = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(CALL_SESSION_MUTATION_EVENT));
};

export const useCallSessions = (activeThreadId: string | null) => {
  const { activeFamilyId, memberships, profileId } = useFamily();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<CallSessionRow[]>([]);
  const latestFetchIdRef = useRef(0);
  const familyIds = useMemo(
    () => [...new Set(memberships.map((membership) => membership.familyId).filter(Boolean))],
    [memberships],
  );
  const familyIdsKey = familyIds.join(",");

  const fetchSessions = useCallback(async (options?: { background?: boolean }) => {
    if (familyIds.length === 0 || !profileId) {
      setSessions([]);
      setLoading(false);
      return;
    }

    const fetchId = latestFetchIdRef.current + 1;
    latestFetchIdRef.current = fetchId;

    if (!options?.background) {
      setLoading(true);
    }

    const { data, error } = await supabase
      .from("call_sessions")
      .select("*")
      .in("family_id", familyIds)
      .in("status", [...OPEN_STATUSES])
      .or(`initiator_profile_id.eq.${profileId},callee_profile_id.eq.${profileId}`)
      .order("created_at", { ascending: false });

    if (fetchId !== latestFetchIdRef.current) {
      return;
    }

    if (error) {
      console.error("Error fetching call sessions:", error);
      if (!options?.background) {
        toast.error("Unable to load call status right now.");
      }
      setLoading(false);
      return;
    }

    setSessions(data ?? []);
    setLoading(false);
  }, [familyIds, profileId]);

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleMutation = () => {
      void fetchSessions({ background: true });
    };

    window.addEventListener(CALL_SESSION_MUTATION_EVENT, handleMutation);

    return () => {
      window.removeEventListener(CALL_SESSION_MUTATION_EVENT, handleMutation);
    };
  }, [fetchSessions]);

  useEffect(() => {
    if (familyIds.length === 0 || !profileId || sessions.length === 0) {
      return;
    }

    const interval = window.setInterval(() => {
      void fetchSessions({ background: true });
    }, 2_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [familyIds.length, fetchSessions, profileId, sessions.length]);

  useEffect(() => {
    if (familyIds.length === 0) {
      return;
    }

    const channels = familyIds.map((familyId) =>
      supabase
        .channel(`call-sessions-${familyId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "call_sessions",
            filter: `family_id=eq.${familyId}`,
          },
          () => {
            void fetchSessions({ background: true });
          },
        )
        .subscribe(),
    );

    return () => {
      channels.forEach((channel) => {
        void supabase.removeChannel(channel);
      });
    };
  }, [familyIds, familyIdsKey, fetchSessions]);

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
      notifyCallSessionMutation();
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
      notifyCallSessionMutation();
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
      notifyCallSessionMutation();
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
