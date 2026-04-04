import { useCallback, useEffect, useMemo, useState } from "react";
import { useFamily } from "@/contexts/FamilyContext";
import { supabase } from "@/integrations/supabase/client";
import { normalizeFeatureAvailabilityError } from "@/lib/featureAvailabilityErrors";
import {
  mapFamilyGameChallengeOverview,
  type FamilyGameChallengeOverview,
  type FamilyGameChallengeOverviewPayload,
  type FamilyGameChallengeSubmission,
} from "@/lib/gameChallenges";

interface SubmitFamilyGameChallengeResultInput {
  distance: number;
  score: number;
  submittedAt?: string;
}

interface UseGameChallengesOptions {
  challengeId?: string | null;
  enabled?: boolean;
  gameDisplayName: string;
  gameSlug: string;
}

const maintenanceMessage =
  "Family challenges are still being enabled on this server. Solo preview remains available while we finish the rollout.";

const EMPTY_CHALLENGE_OVERVIEW: FamilyGameChallengeOverview = {
  challenge: null,
  leaderboard: [],
  participants: [],
};

export const useGameChallenges = ({
  challengeId = null,
  enabled = true,
  gameDisplayName,
  gameSlug,
}: UseGameChallengesOptions) => {
  const { activeFamilyId, loading: familyLoading, profileId } = useFamily();
  const [challengeOverview, setChallengeOverview] = useState<FamilyGameChallengeOverview>(
    EMPTY_CHALLENGE_OVERVIEW,
  );
  const [loading, setLoading] = useState(true);
  const [scopeError, setScopeError] = useState<string | null>(null);

  const fetchChallengeOverview = useCallback(async () => {
    if (!enabled) {
      setChallengeOverview(EMPTY_CHALLENGE_OVERVIEW);
      setScopeError(null);
      setLoading(false);
      return;
    }

    if (familyLoading) {
      return;
    }

    if (!activeFamilyId) {
      setChallengeOverview(EMPTY_CHALLENGE_OVERVIEW);
      setScopeError("Select an active family before loading family game challenges.");
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.rpc(
      "get_family_game_challenge_overview" as never,
      {
        p_family_id: activeFamilyId,
        p_game_slug: gameSlug,
      } as never,
    );

    if (error) {
      console.error("Error loading family game challenge overview:", error);
      setChallengeOverview(EMPTY_CHALLENGE_OVERVIEW);
      setScopeError(
        normalizeFeatureAvailabilityError(
          error.message,
          maintenanceMessage,
          ["get_family_game_challenge_overview"],
        ),
      );
      setLoading(false);
      return;
    }

    const nextOverview = mapFamilyGameChallengeOverview(
      (data as FamilyGameChallengeOverviewPayload | null) ?? null,
    );

    if (challengeId && nextOverview.challenge?.id !== challengeId) {
      setChallengeOverview(nextOverview);
      setScopeError("This family challenge could not be found for the active family.");
      setLoading(false);
      return;
    }

    setChallengeOverview(nextOverview);
    setScopeError(null);
    setLoading(false);
  }, [activeFamilyId, challengeId, enabled, familyLoading, gameSlug]);

  useEffect(() => {
    void fetchChallengeOverview();
  }, [fetchChallengeOverview]);

  useEffect(() => {
    if (!enabled || !activeFamilyId) {
      return;
    }

    const channel = supabase
      .channel(`family-game-challenges-${activeFamilyId}-${gameSlug}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "family_game_challenges",
          filter: `family_id=eq.${activeFamilyId}`,
        },
        () => {
          void fetchChallengeOverview();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "family_game_challenge_members",
          filter: `family_id=eq.${activeFamilyId}`,
        },
        () => {
          void fetchChallengeOverview();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "family_game_challenge_results",
          filter: `family_id=eq.${activeFamilyId}`,
        },
        () => {
          void fetchChallengeOverview();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeFamilyId, enabled, fetchChallengeOverview, gameSlug]);

  const resolveChallengeId = useCallback(() => {
    const resolvedChallengeId = challengeId ?? challengeOverview.challenge?.id ?? null;

    if (!resolvedChallengeId) {
      setScopeError("A family challenge is required before continuing.");
      return null;
    }

    return resolvedChallengeId;
  }, [challengeId, challengeOverview.challenge?.id]);

  const createChallenge = useCallback(async () => {
    if (!activeFamilyId) {
      setScopeError("An active family is required before starting a family challenge.");
      return null;
    }

    if (!enabled) {
      setScopeError("Family challenges are unavailable until challenge mode is enabled for this view.");
      return null;
    }

    const { data, error } = await supabase.rpc(
      "rpc_create_family_game_challenge" as never,
      {
        p_family_id: activeFamilyId,
        p_game_display_name: gameDisplayName,
        p_game_slug: gameSlug,
      } as never,
    );

    if (error) {
      console.error("Error creating family game challenge:", error);
      setScopeError(
        normalizeFeatureAvailabilityError(
          error.message,
          maintenanceMessage,
          ["rpc_create_family_game_challenge"],
        ),
      );
      return null;
    }

    await fetchChallengeOverview();
    setScopeError(null);

    return ((data as { id?: string } | null)?.id ?? null) as string | null;
  }, [activeFamilyId, enabled, fetchChallengeOverview, gameDisplayName, gameSlug]);

  const acceptChallenge = useCallback(async () => {
    if (!activeFamilyId) {
      setScopeError("An active family is required before accepting a family challenge.");
      return false;
    }

    if (!enabled) {
      setScopeError("Family challenges are unavailable until challenge mode is enabled for this view.");
      return false;
    }

    const resolvedChallengeId = resolveChallengeId();
    if (!resolvedChallengeId) {
      return false;
    }

    const { error } = await supabase.rpc(
      "rpc_accept_family_game_challenge" as never,
      {
        p_challenge_id: resolvedChallengeId,
        p_family_id: activeFamilyId,
      } as never,
    );

    if (error) {
      console.error("Error accepting family game challenge:", error);
      setScopeError(
        normalizeFeatureAvailabilityError(
          error.message,
          maintenanceMessage,
          ["rpc_accept_family_game_challenge"],
        ),
      );
      return false;
    }

    await fetchChallengeOverview();
    setScopeError(null);
    return true;
  }, [activeFamilyId, enabled, fetchChallengeOverview, resolveChallengeId]);

  const closeChallenge = useCallback(async () => {
    if (!activeFamilyId) {
      setScopeError("An active family is required before closing a family challenge.");
      return false;
    }

    if (!enabled) {
      setScopeError("Family challenges are unavailable until challenge mode is enabled for this view.");
      return false;
    }

    const resolvedChallengeId = resolveChallengeId();
    if (!resolvedChallengeId) {
      return false;
    }

    const { error } = await supabase.rpc(
      "rpc_close_family_game_challenge" as never,
      {
        p_challenge_id: resolvedChallengeId,
        p_family_id: activeFamilyId,
      } as never,
    );

    if (error) {
      console.error("Error closing family game challenge:", error);
      setScopeError(
        normalizeFeatureAvailabilityError(
          error.message,
          maintenanceMessage,
          ["rpc_close_family_game_challenge"],
        ),
      );
      return false;
    }

    await fetchChallengeOverview();
    setScopeError(null);
    return true;
  }, [activeFamilyId, enabled, fetchChallengeOverview, resolveChallengeId]);

  const submitResult = useCallback(
    async ({ distance, score, submittedAt }: SubmitFamilyGameChallengeResultInput) => {
      if (!activeFamilyId) {
        setScopeError("An active family is required before submitting a challenge score.");
        return null;
      }

      if (!enabled) {
        setScopeError("Family challenges are unavailable until challenge mode is enabled for this view.");
        return null;
      }

      const resolvedChallengeId = resolveChallengeId();
      if (!resolvedChallengeId) {
        return null;
      }

      const { data, error } = await supabase.rpc(
        "rpc_submit_family_game_challenge_result" as never,
        {
          p_challenge_id: resolvedChallengeId,
          p_distance: distance,
          p_family_id: activeFamilyId,
          p_score: score,
          p_submitted_at: submittedAt ?? new Date().toISOString(),
        } as never,
      );

      if (error) {
        console.error("Error submitting family game challenge result:", error);
        setScopeError(
          normalizeFeatureAvailabilityError(
            error.message,
            maintenanceMessage,
            ["rpc_submit_family_game_challenge_result"],
          ),
        );
        return null;
      }

      await fetchChallengeOverview();
      setScopeError(null);

      const payload = (data as Record<string, unknown> | null) ?? {};
      return {
        accepted: Boolean(payload.accepted),
        challengeId: String(payload.challenge_id ?? resolvedChallengeId),
        distance: Number(payload.distance ?? distance),
        leadingProfileId:
          payload.leading_profile_id === null || payload.leading_profile_id === undefined
            ? null
            : String(payload.leading_profile_id),
        profileId: String(payload.profile_id ?? profileId ?? ""),
        score: Number(payload.score ?? score),
        status: String(payload.status ?? "active") as FamilyGameChallengeSubmission["status"],
        submittedAt: String(payload.submitted_at ?? submittedAt ?? new Date().toISOString()),
      } satisfies FamilyGameChallengeSubmission;
    },
    [activeFamilyId, enabled, fetchChallengeOverview, profileId, resolveChallengeId],
  );

  const challenge = challengeOverview.challenge;
  const leaderboard = challengeOverview.leaderboard;
  const participants = challengeOverview.participants;
  const currentParticipant = useMemo(
    () => participants.find((participant) => participant.profileId === profileId) ?? null,
    [participants, profileId],
  );
  const currentResult = useMemo(
    () => leaderboard.find((entry) => entry.profileId === profileId) ?? null,
    [leaderboard, profileId],
  );

  return {
    acceptChallenge,
    challenge,
    closeChallenge,
    createChallenge,
    currentParticipant,
    currentResult,
    leaderboard,
    loading: loading || familyLoading,
    participants,
    refresh: fetchChallengeOverview,
    scopeError,
    submitResult,
  };
};
