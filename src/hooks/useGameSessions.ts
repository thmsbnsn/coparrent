import { useCallback, useEffect, useMemo, useState } from "react";
import { useFamily } from "@/contexts/FamilyContext";
import { supabase } from "@/integrations/supabase/client";
import { normalizeFeatureAvailabilityError } from "@/lib/featureAvailabilityErrors";
import {
  type FamilyGameSessionOverviewRow,
  type FamilyGameSessionSummary,
  mapFamilyGameSessionSummary,
} from "@/lib/gameSessions";

interface UseGameSessionsOptions {
  gameDisplayName: string;
  gameSlug: string;
  maxPlayers?: number;
}

export const useGameSessions = ({
  gameDisplayName,
  gameSlug,
  maxPlayers = 4,
}: UseGameSessionsOptions) => {
  const maintenanceMessage =
    "Shared family lobbies are still being enabled on this server. Solo preview is available while we finish the update.";
  const { activeFamilyId, loading: familyLoading } = useFamily();
  const [sessions, setSessions] = useState<FamilyGameSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [scopeError, setScopeError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    if (familyLoading) {
      return;
    }

    if (!activeFamilyId) {
      setSessions([]);
      setScopeError("Select an active family before loading family game sessions.");
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.rpc("get_family_game_sessions_overview", {
      p_family_id: activeFamilyId,
      p_game_slug: gameSlug,
    });

    if (error) {
      console.error("Error loading family game sessions:", error);
      setSessions([]);
      setScopeError(
        normalizeFeatureAvailabilityError(
          error.message,
          maintenanceMessage,
          ["get_family_game_sessions_overview"],
        ),
      );
      setLoading(false);
      return;
    }

    setSessions(
      ((data as FamilyGameSessionOverviewRow[] | null) ?? []).map((row) =>
        mapFamilyGameSessionSummary(row),
      ),
    );
    setScopeError(null);
    setLoading(false);
  }, [activeFamilyId, familyLoading, gameSlug]);

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    if (!activeFamilyId) {
      return;
    }

    const channel = supabase
      .channel(`family-game-sessions-${activeFamilyId}-${gameSlug}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "family_game_sessions",
          filter: `family_id=eq.${activeFamilyId}`,
        },
        () => {
          void fetchSessions();
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
          void fetchSessions();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeFamilyId, fetchSessions, gameSlug]);

  const createSession = useCallback(async () => {
    if (!activeFamilyId) {
      setScopeError("An active family is required before creating a game session.");
      return null;
    }

    const { data, error } = await supabase.rpc("rpc_create_family_game_session", {
      p_family_id: activeFamilyId,
      p_game_display_name: gameDisplayName,
      p_game_slug: gameSlug,
      p_max_players: maxPlayers,
    });

    if (error) {
      console.error("Error creating family game session:", error);
      setScopeError(
        normalizeFeatureAvailabilityError(
          error.message,
          maintenanceMessage,
          ["rpc_create_family_game_session"],
        ),
      );
      return null;
    }

    await fetchSessions();
    setScopeError(null);

    return ((data as { id?: string } | null)?.id ?? null) as string | null;
  }, [activeFamilyId, fetchSessions, gameDisplayName, gameSlug, maxPlayers]);

  const ensureSession = useCallback(async () => {
    if (!activeFamilyId) {
      setScopeError("An active family is required before opening a game lobby.");
      return null;
    }

    const existingSessionId = sessions[0]?.id ?? null;
    if (existingSessionId) {
      return existingSessionId;
    }

    return createSession();
  }, [activeFamilyId, createSession, sessions]);

  const openSession = useMemo(() => sessions[0] ?? null, [sessions]);

  return {
    createSession,
    ensureSession,
    loading: loading || familyLoading,
    openSession,
    refresh: fetchSessions,
    scopeError,
    sessions,
  };
};
