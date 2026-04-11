import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFamilyRole } from "@/hooks/useFamilyRole";
import type { CallSessionRow } from "@/lib/calls";

const CALL_HISTORY_LIMIT = 50;

export type CallHistoryRow = Pick<
  CallSessionRow,
  | "answered_at"
  | "callee_display_name"
  | "callee_profile_id"
  | "call_type"
  | "created_at"
  | "ended_at"
  | "family_id"
  | "id"
  | "initiator_display_name"
  | "initiator_profile_id"
  | "source"
  | "status"
  | "thread_id"
>;

const CALL_HISTORY_COLUMNS = `
  id,
  family_id,
  thread_id,
  created_at,
  answered_at,
  ended_at,
  call_type,
  status,
  source,
  initiator_profile_id,
  initiator_display_name,
  callee_profile_id,
  callee_display_name
`;

export const useCallHistory = () => {
  const { activeFamilyId, profileId } = useFamilyRole();
  const [calls, setCalls] = useState<CallHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [scopeError, setScopeError] = useState<string | null>(null);
  const latestFetchIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const fetchId = latestFetchIdRef.current + 1;
    latestFetchIdRef.current = fetchId;

    if (!activeFamilyId || !profileId) {
      setCalls([]);
      setScopeError("An active family and profile are required before loading call history.");
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("call_sessions")
      .select(CALL_HISTORY_COLUMNS)
      .eq("family_id", activeFamilyId)
      .or(`initiator_profile_id.eq.${profileId},callee_profile_id.eq.${profileId}`)
      .order("created_at", { ascending: false })
      .limit(CALL_HISTORY_LIMIT)
      .returns<CallHistoryRow[]>();

    if (fetchId !== latestFetchIdRef.current) {
      return;
    }

    if (error) {
      console.error("Error fetching call history:", error);
      setCalls([]);
      setScopeError(error.message || "Unable to load call history for the active family.");
      setLoading(false);
      return;
    }

    setCalls(data ?? []);
    setScopeError(null);
    setLoading(false);
  }, [activeFamilyId, profileId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    calls,
    loading,
    refresh,
    scopeError,
  };
};
