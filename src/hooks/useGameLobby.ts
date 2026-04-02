import { useCallback, useEffect, useMemo, useState } from "react";
import { useFamily } from "@/contexts/FamilyContext";
import { supabase } from "@/integrations/supabase/client";
import {
  type FamilyGameLobbyPayload,
  mapFamilyGameLobby,
} from "@/lib/gameSessions";

interface ReportGameResultInput {
  distance: number;
  reportedAt?: string;
  score: number;
}

interface UseGameLobbyOptions {
  gameSlug?: string | null;
  sessionId: string | null;
}

export const useGameLobby = ({
  gameSlug = null,
  sessionId,
}: UseGameLobbyOptions) => {
  const { activeFamilyId, loading: familyLoading, profileId } = useFamily();
  const [loading, setLoading] = useState(true);
  const [lobby, setLobby] = useState(() => mapFamilyGameLobby(null));
  const [scopeError, setScopeError] = useState<string | null>(null);

  const fetchLobby = useCallback(async () => {
    if (familyLoading) {
      return;
    }

    if (!sessionId) {
      setLobby(null);
      setScopeError(null);
      setLoading(false);
      return;
    }

    if (!activeFamilyId) {
      setLobby(null);
      setScopeError("Select an active family before loading the game lobby.");
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.rpc("get_family_game_lobby", {
      p_family_id: activeFamilyId,
      p_session_id: sessionId,
    });

    if (error) {
      console.error("Error loading game lobby:", error);
      setLobby(null);
      setScopeError(error.message || "Unable to load the game lobby.");
      setLoading(false);
      return;
    }

    const nextLobby = mapFamilyGameLobby(data as FamilyGameLobbyPayload | null);
    if (gameSlug && nextLobby?.session.gameSlug !== gameSlug) {
      setLobby(null);
      setScopeError("The requested game session does not match the selected game.");
      setLoading(false);
      return;
    }

    setLobby(nextLobby);
    setScopeError(null);
    setLoading(false);
  }, [activeFamilyId, familyLoading, gameSlug, sessionId]);

  useEffect(() => {
    void fetchLobby();
  }, [fetchLobby]);

  useEffect(() => {
    if (!activeFamilyId || !sessionId) {
      return;
    }

    const channel = supabase
      .channel(`family-game-lobby-${activeFamilyId}-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "family_game_sessions",
          filter: `family_id=eq.${activeFamilyId}`,
        },
        () => {
          void fetchLobby();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "family_game_session_members",
          filter: `family_id=eq.${activeFamilyId}`,
        },
        () => {
          void fetchLobby();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "family_game_session_results",
          filter: `family_id=eq.${activeFamilyId}`,
        },
        () => {
          void fetchLobby();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeFamilyId, fetchLobby, sessionId]);

  const joinLobby = useCallback(async () => {
    if (!sessionId) {
      setScopeError("A game session is required before joining the lobby.");
      return false;
    }

    if (!activeFamilyId) {
      setScopeError("An active family is required before joining the lobby.");
      return false;
    }

    const { error } = await supabase.rpc("rpc_join_family_game_session", {
      p_family_id: activeFamilyId,
      p_session_id: sessionId,
    });

    if (error) {
      console.error("Error joining game lobby:", error);
      setScopeError(error.message || "Unable to join the game lobby.");
      return false;
    }

    await fetchLobby();
    setScopeError(null);
    return true;
  }, [activeFamilyId, fetchLobby, sessionId]);

  const setReady = useCallback(
    async (isReady: boolean) => {
      if (!sessionId) {
        setScopeError("A game session is required before updating ready state.");
        return false;
      }

      if (!activeFamilyId) {
        setScopeError("An active family is required before updating ready state.");
        return false;
      }

      const { error } = await supabase.rpc("rpc_set_family_game_session_ready", {
        p_family_id: activeFamilyId,
        p_is_ready: isReady,
        p_session_id: sessionId,
      });

      if (error) {
        console.error("Error updating lobby ready state:", error);
        setScopeError(error.message || "Unable to update lobby ready state.");
        return false;
      }

      await fetchLobby();
      setScopeError(null);
      return true;
    },
    [activeFamilyId, fetchLobby, sessionId],
  );

  const startSession = useCallback(async () => {
    if (!sessionId) {
      setScopeError("A game session is required before starting the flight.");
      return false;
    }

    if (!activeFamilyId) {
      setScopeError("An active family is required before starting the flight.");
      return false;
    }

    const { error } = await supabase.rpc("rpc_start_family_game_session", {
      p_family_id: activeFamilyId,
      p_session_id: sessionId,
    });

    if (error) {
      console.error("Error starting family game session:", error);
      setScopeError(error.message || "Unable to start the family game session.");
      return false;
    }

    await fetchLobby();
    setScopeError(null);
    return true;
  }, [activeFamilyId, fetchLobby, sessionId]);

  const reportResult = useCallback(
    async ({ distance, reportedAt, score }: ReportGameResultInput) => {
      if (!sessionId) {
        setScopeError("A game session is required before reporting results.");
        return false;
      }

      if (!activeFamilyId) {
        setScopeError("An active family is required before reporting results.");
        return false;
      }

      const { error } = await supabase.rpc("rpc_report_family_game_session_result", {
        p_distance: distance,
        p_family_id: activeFamilyId,
        p_reported_at: reportedAt ?? new Date().toISOString(),
        p_score: score,
        p_session_id: sessionId,
      });

      if (error) {
        console.error("Error reporting family game result:", error);
        setScopeError(error.message || "Unable to report the game result.");
        return false;
      }

      await fetchLobby();
      setScopeError(null);
      return true;
    },
    [activeFamilyId, fetchLobby, sessionId],
  );

  const currentMember = useMemo(
    () => lobby?.members.find((member) => member.profileId === profileId) ?? null,
    [lobby?.members, profileId],
  );

  const currentResult = useMemo(
    () => lobby?.results.find((result) => result.profileId === profileId) ?? null,
    [lobby?.results, profileId],
  );

  return {
    currentMember,
    currentResult,
    isCreator: Boolean(currentMember?.isCreator),
    isJoined: Boolean(currentMember),
    joinLobby,
    loading: loading || familyLoading,
    lobby,
    members: lobby?.members ?? [],
    refresh: fetchLobby,
    reportResult,
    results: lobby?.results ?? [],
    scopeError,
    session: lobby?.session ?? null,
    setReady,
    startSession,
  };
};
