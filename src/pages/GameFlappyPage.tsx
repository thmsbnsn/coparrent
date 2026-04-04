import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { GameSessionResultsCard } from "@/components/games/GameSessionResultsCard";
import { FlappyPlaneGame, type FlappyRoundSummary } from "@/components/kids/games/FlappyPlaneGame";
import { GameShell } from "@/components/kids/games/GameShell";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useAuth } from "@/contexts/AuthContext";
import { useFamily } from "@/contexts/FamilyContext";
import { useChildAccount } from "@/hooks/useChildAccount";
import { useGameChallenges } from "@/hooks/useGameChallenges";
import { useGameLobby } from "@/hooks/useGameLobby";
import { useKidPortalAccess } from "@/hooks/useKidPortalAccess";
import { usePresenceHeartbeat } from "@/hooks/usePresenceHeartbeat";
import { isChildGameAllowed } from "@/lib/childAccess";
import { FAMILY_GAMES } from "@/lib/gameRegistry";
import type { FamilyGameChallengeSubmission } from "@/lib/gameChallenges";
import { requiresPortalApproval } from "@/lib/kidsPortal";

export default function GameFlappyPage() {
  const game = FAMILY_GAMES.flappyPlane;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { profileId } = useFamily();
  const {
    allowed_game_slugs,
    child_name,
    games_enabled,
    isChildAccount,
    loading: childLoading,
    portal_mode,
    scopeError,
  } = useChildAccount();
  const { loading: portalLoading, requestState } = useKidPortalAccess();
  const sessionId = searchParams.get("sessionId");
  const challengeId = searchParams.get("challengeId");
  const modeConflictError = sessionId && challengeId
    ? "Choose either a shared family session or a family challenge before opening Toy Plane Dash."
    : null;
  const {
    currentResult,
    isCreator,
    loading: lobbyLoading,
    prepareRematch,
    reportResult,
    results,
    scopeError: lobbyScopeError,
    session,
  } = useGameLobby({
    gameSlug: game.slug,
    sessionId,
  });
  const {
    challenge,
    currentResult: currentChallengeResult,
    currentParticipant,
    leaderboard: challengeLeaderboard,
    loading: challengeLoading,
    scopeError: challengeScopeError,
    submitResult: submitChallengeResult,
  } = useGameChallenges({
    challengeId,
    enabled: Boolean(challengeId),
    gameDisplayName: game.displayName,
    gameSlug: game.slug,
  });
  const [autoStartSignal, setAutoStartSignal] = useState(0);
  const [challengeSubmission, setChallengeSubmission] = useState<FamilyGameChallengeSubmission | null>(null);
  const [countdownLabel, setCountdownLabel] = useState<string | null>(null);
  const [isReportingResult, setIsReportingResult] = useState(false);
  const [localRoundResult, setLocalRoundResult] = useState<FlappyRoundSummary | null>(null);
  const [raceStarted, setRaceStarted] = useState(false);
  const launchKeyRef = useRef<string | null>(null);
  const reportedResultRef = useRef(false);
  const childCanPlayFlappy = !isChildAccount || isChildGameAllowed(
    {
      allowed_game_slugs,
      games_enabled,
    },
    game.slug,
  );
  const childCanUseChallengeMode = !isChildAccount || childCanPlayFlappy;
  const presenceLocationType = sessionId
    ? localRoundResult
      ? "lobby"
      : raceStarted
        ? "game"
        : "lobby"
    : "game";

  usePresenceHeartbeat({
    enabled: Boolean(
      !authLoading &&
      user &&
      !scopeError &&
      !lobbyScopeError &&
      !challengeScopeError &&
      !modeConflictError &&
      childCanPlayFlappy,
    ),
    gameDisplayName: game.displayName,
    gameSlug: game.slug,
    locationType: presenceLocationType,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login", { replace: true });
    }
  }, [authLoading, navigate, user]);

  useEffect(() => {
    if (
      !authLoading &&
      !childLoading &&
      !portalLoading &&
      isChildAccount &&
      requiresPortalApproval(portal_mode, requestState)
    ) {
      navigate("/kids/portal", { replace: true });
    }
  }, [authLoading, childLoading, isChildAccount, navigate, portalLoading, portal_mode, requestState]);

  useEffect(() => {
    reportedResultRef.current = Boolean(sessionId && currentResult);
    if (sessionId && currentResult && !localRoundResult) {
      setLocalRoundResult({
        bestScore: currentResult.score,
        distance: currentResult.distance,
        score: currentResult.score,
        seed: session?.seed ?? 1,
      });
    }
  }, [currentResult, localRoundResult, session?.seed, sessionId]);

  useEffect(() => {
    if (!challengeId) {
      setChallengeSubmission(null);
    }
  }, [challengeId]);

  useEffect(() => {
    if (!sessionId) {
      setCountdownLabel(null);
      setRaceStarted(false);
      return;
    }

    if (!session || session.status !== "active" || !session.startTime || localRoundResult) {
      setCountdownLabel(null);
      if (localRoundResult) {
        setRaceStarted(false);
      }
      return;
    }

    const nextLaunchKey = `${session.id}:${session.startTime}`;
    const updateCountdown = () => {
      const msRemaining = new Date(session.startTime ?? 0).getTime() - Date.now();

      if (msRemaining <= 0) {
        if (launchKeyRef.current !== nextLaunchKey) {
          launchKeyRef.current = nextLaunchKey;
          setAutoStartSignal((current) => current + 1);
        }

        setRaceStarted(true);
        setCountdownLabel("Go!");
        return;
      }

      setRaceStarted(false);
      setCountdownLabel(String(Math.max(1, Math.ceil(msRemaining / 1000))));
    };

    updateCountdown();
    const intervalId = window.setInterval(updateCountdown, 120);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [localRoundResult, session, sessionId]);

  useEffect(() => {
    if (!sessionId || !session) {
      return;
    }

    if (session.status !== "waiting" && session.status !== "ready") {
      return;
    }

    reportedResultRef.current = false;
    setLocalRoundResult(null);
    setCountdownLabel(null);
    setRaceStarted(false);

    navigate(`${game.launcherPath}/${session.id}`, { replace: true });
  }, [game.launcherPath, navigate, session, sessionId]);

  const handleRoundEnd = useCallback(
    async (summary: FlappyRoundSummary) => {
      setLocalRoundResult(summary);
      setRaceStarted(false);

      if (sessionId) {
        if (reportedResultRef.current) {
          return;
        }

        reportedResultRef.current = true;
        setIsReportingResult(true);

        try {
          const reported = await reportResult({
            distance: summary.distance,
            reportedAt: new Date().toISOString(),
            score: summary.score,
          });

          if (!reported) {
            reportedResultRef.current = false;
          }
        } finally {
          setIsReportingResult(false);
        }

        return;
      }

      if (challengeId) {
        setIsReportingResult(true);

        try {
          const submission = await submitChallengeResult({
            distance: summary.distance,
            score: summary.score,
            submittedAt: new Date().toISOString(),
          });

          setChallengeSubmission(submission);
        } finally {
          setIsReportingResult(false);
        }
      }
    },
    [challengeId, reportResult, sessionId, submitChallengeResult],
  );

  const currentPlayerResult = useMemo(
    () => currentResult ?? (
      localRoundResult
        ? {
            avatarUrl: null,
            displayName: child_name ?? "You",
            distance: localRoundResult.distance,
            isWinner: session?.winnerProfileId === profileId,
            profileId: profileId ?? "current-player",
            reportedAt: new Date().toISOString(),
            score: localRoundResult.score,
          }
        : null
    ),
    [child_name, currentResult, localRoundResult, profileId, session?.winnerProfileId],
  );
  const challengeLeader = challengeLeaderboard[0] ?? null;
  const challengeDisplayResult = useMemo(
    () =>
      currentChallengeResult ?? (
        challengeSubmission
          ? {
              avatarUrl: null,
              displayName: child_name ?? "You",
              distance: challengeSubmission.distance,
              isLeader: challengeSubmission.leadingProfileId === profileId,
              profileId: profileId ?? "current-player",
              relationshipLabel: null,
              role: "parent",
              score: challengeSubmission.score,
              submittedAt: challengeSubmission.submittedAt,
            }
          : null
      ),
    [challengeSubmission, child_name, currentChallengeResult, profileId],
  );
  const challengeDisplayResults = useMemo(() => {
    if (challengeLeaderboard.length > 0) {
      return challengeLeaderboard.map((entry) => ({
        avatarUrl: entry.avatarUrl,
        displayName: entry.displayName,
        distance: entry.distance,
        isWinner: entry.isLeader,
        profileId: entry.profileId,
        reportedAt: entry.submittedAt,
        score: entry.score,
      }));
    }

    return challengeDisplayResult
      ? [{
          avatarUrl: challengeDisplayResult.avatarUrl,
          displayName: challengeDisplayResult.displayName,
          distance: challengeDisplayResult.distance,
          isWinner: challengeDisplayResult.isLeader,
          profileId: challengeDisplayResult.profileId,
          reportedAt: challengeDisplayResult.submittedAt,
          score: challengeDisplayResult.score,
        }]
      : [];
  }, [challengeDisplayResult, challengeLeaderboard]);
  const challengePlacement = useMemo(() => {
    if (!profileId) {
      return null;
    }

    const placementIndex = challengeDisplayResults.findIndex((result) => result.profileId === profileId);
    return placementIndex >= 0 ? placementIndex : null;
  }, [challengeDisplayResults, profileId]);

  const resultsHeadline = useMemo(() => {
    if (challengeId && localRoundResult) {
      if (challengePlacement === 0) {
        return "You are #1";
      }

      if (challengePlacement !== null) {
        return `You are #${challengePlacement + 1}`;
      }

      return "Challenge score submitted";
    }

    if (!currentPlayerResult) {
      return sessionId ? "Shared race results" : "Flight summary";
    }

    if (session?.status === "finished" && session.winnerProfileId === profileId) {
      return "You win";
    }

    if (session?.status === "finished") {
      return "You lost";
    }

    return "Flight complete";
  }, [
    challengeId,
    challengePlacement,
    currentPlayerResult,
    localRoundResult,
    profileId,
    session?.status,
    session?.winnerProfileId,
    sessionId,
  ]);

  const resultsSubcopy = useMemo(() => {
    if (challengeId && localRoundResult) {
      if (isReportingResult) {
        return "Sending your result to the family challenge board now.";
      }

      if (challengeDisplayResult && challengePlacement === 0) {
        return `You lead the family challenge with ${challengeDisplayResult.score} points and ${challengeDisplayResult.distance} distance units.`;
      }

      if (challengeDisplayResult && challengePlacement !== null && challengeLeader) {
        return challengeSubmission?.accepted === false
          ? `Your best challenge score stays at ${challengeDisplayResult.score}. Beat ${challengeLeader.score} to take the family lead.`
          : `Beat ${challengeLeader.score} to take the family lead.`;
      }

      return "The family challenge board updates after each accepted score submission.";
    }

    if (!sessionId) {
      return currentPlayerResult
        ? `You scored ${currentPlayerResult.score} and flew ${currentPlayerResult.distance} distance units this round.`
        : "Finish a round to see your score and local best summary here.";
    }

    if (isReportingResult) {
      return "Sending your result to the family session now.";
    }

    if (session?.status === "finished") {
      return "The winner is decided on the server from the shared family-scoped results.";
    }

    return "Waiting for the rest of the family to finish so the final standings can lock in.";
  }, [
    challengeDisplayResult,
    challengeId,
    challengeLeader,
    challengePlacement,
    challengeSubmission?.accepted,
    currentPlayerResult,
    isReportingResult,
    localRoundResult,
    session?.status,
    sessionId,
  ]);

  const displayedResults = useMemo(() => {
    if (challengeId && localRoundResult) {
      return challengeDisplayResults;
    }

    if (results.length > 0) {
      return results;
    }

    return currentPlayerResult ? [currentPlayerResult] : [];
  }, [challengeDisplayResults, challengeId, currentPlayerResult, localRoundResult, results]);

  const currentPlacement = useMemo(() => {
    if (!profileId) {
      return null;
    }

    const placementIndex = displayedResults.findIndex((result) => result.profileId === profileId);
    return placementIndex >= 0 ? placementIndex : null;
  }, [displayedResults, profileId]);

  const nextStepLabel = useMemo(() => {
    if (challengeId && localRoundResult) {
      if (!challenge) {
        return "Head back to the shared games dashboard and reopen the family challenge board when it is ready again.";
      }

      if (challenge.status === "active") {
        return currentParticipant
          ? "Best-score-only mode is active. Play again later if you want to improve your family challenge rank."
          : "Accept the family challenge from the board before trying another async family run.";
      }

      return "This challenge is no longer collecting scores. Start the next family challenge from the board when everyone is ready for a fresh leaderboard.";
    }

    if (!sessionId) {
      return "Try another round from here or head back to the shared games dashboard for the next family launch.";
    }

    if (session?.status === "finished") {
      return isCreator
        ? "Set up the rematch when the family is ready, then everyone can mark ready again in the same room."
        : "Head back to the lobby and wait for the host to reset the room for another shared launch.";
    }

    if (session?.memberCount && displayedResults.length < session.memberCount) {
      return `${displayedResults.length} of ${session.memberCount} pilots have reported so far. The standings will settle when the rest of the family finishes.`;
    }

    return "The race is still live. Stay here while the server collects the rest of the family results.";
  }, [
    challenge,
    challengeId,
    currentParticipant,
    displayedResults.length,
    isCreator,
    localRoundResult,
    session?.memberCount,
    session?.status,
    sessionId,
  ]);

  const readyDescription = sessionId
    ? session?.status === "active" && countdownLabel
      ? `Synchronized family race launch in ${countdownLabel}. Everyone gets the same seeded obstacle layout.`
      : "Wait for the shared family race countdown to begin. The host controls takeoff from the lobby."
    : challengeId
      ? "This run will report to the active family challenge board. Better scores replace lower ones, but weaker runs never overwrite your current best."
      : `${child_name ? `${child_name}, ` : ""}keep the blue plane gliding through the rocky gaps without touching the grass.`;

  const gameOverDescription = challengeId
    ? challengeDisplayResult
      ? `Score ${challengeDisplayResult.score}. Distance ${challengeDisplayResult.distance}.`
      : undefined
    : currentPlayerResult
      ? `Score ${currentPlayerResult.score}. Distance ${currentPlayerResult.distance}.`
    : undefined;

  const handlePrepareRematch = useCallback(async () => {
    if (!sessionId || !session) {
      return;
    }

    const prepared = await prepareRematch();
    if (!prepared) {
      return;
    }

    reportedResultRef.current = false;
    setLocalRoundResult(null);
    setCountdownLabel(null);
    setRaceStarted(false);

    navigate(`${game.launcherPath}/${session.id}`, { replace: true });
  }, [game.launcherPath, navigate, prepareRematch, session, sessionId]);

  const resolvedScopeError = modeConflictError ?? scopeError ?? lobbyScopeError ?? challengeScopeError ?? null;
  const isLoading =
    authLoading ||
    childLoading ||
    portalLoading ||
    (Boolean(sessionId) && lobbyLoading) ||
    (Boolean(challengeId) && challengeLoading);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <LoadingSpinner fullScreen message="Loading game..." />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (resolvedScopeError) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-xl rounded-[2rem] border border-rose-200 bg-white/90 p-8 shadow-sm">
          <h1 className="text-2xl font-display font-semibold">Family scope required</h1>
          <p className="mt-3 text-sm text-muted-foreground">{resolvedScopeError}</p>
        </div>
      </DashboardLayout>
    );
  }

  if (isChildAccount && !childCanPlayFlappy) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-xl rounded-[2rem] border border-amber-200 bg-white/90 p-8 shadow-sm">
          <h1 className="text-2xl font-display font-semibold">Game unavailable</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            A parent or guardian needs to enable {game.displayName} for this child account before the
            game can open here.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  if (challengeId && !childCanUseChallengeMode) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-xl rounded-[2rem] border border-amber-200 bg-white/90 p-8 shadow-sm">
          <h1 className="text-2xl font-display font-semibold">Challenge unavailable</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            A parent or guardian needs to enable family challenges for this child account before
            challenge mode can open here.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  if (sessionId && !session) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-xl rounded-[2rem] border border-border/70 bg-card/90 p-8 shadow-sm">
          <h1 className="text-2xl font-display font-semibold text-slate-950">
            Session unavailable
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            This family race session could not be found for the active family.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  if (challengeId && !challenge) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-xl rounded-[2rem] border border-border/70 bg-card/90 p-8 shadow-sm">
          <h1 className="text-2xl font-display font-semibold text-slate-950">
            Challenge unavailable
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            This family challenge could not be found for the active family.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              type="button"
              className="rounded-full"
              onClick={() => navigate(game.challengePath)}
            >
              Back to challenge board
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => navigate("/dashboard/games")}
            >
              Back to Games
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1400px] space-y-5">
        {sessionId && session ? (
          <section className="rounded-[2rem] border border-border/70 bg-card/90 p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Shared race session
                </p>
                <h2 className="mt-1 text-2xl font-display font-semibold text-slate-950">
                  {session.status === "active" && countdownLabel
                    ? `Race starts in ${countdownLabel}`
                    : session.status === "finished"
                      ? "Race finished"
                      : "Waiting on the synchronized launch"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  The server picked seed {session.seed ?? 1}. Everyone in this family session gets the
                  same obstacle order and the winner is resolved from shared results.
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-border/70 bg-muted/30 px-4 py-4 text-sm text-slate-900">
                <p className="font-semibold">{results.length} result{results.length === 1 ? "" : "s"} received</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {session.status === "finished"
                    ? "Final standings are locked."
                    : "Standings update as family members finish."}
                </p>
              </div>
            </div>
          </section>
        ) : challengeId && challenge ? (
          <section className="rounded-[2rem] border border-border/70 bg-card/90 p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Family challenge
                </p>
                <h2 className="mt-1 text-2xl font-display font-semibold text-slate-950">
                  {challenge.status === "active"
                    ? "Async family challenge is live"
                    : "Challenge board is closed"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Best-score-only mode is active for the selected family challenge. Play on your own
                  time, then post the strongest run you can to the board.
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-border/70 bg-muted/30 px-4 py-4 text-sm text-slate-900">
                <p className="font-semibold">
                  {challenge.resultCount} score{challenge.resultCount === 1 ? "" : "s"} submitted
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {challengeLeader
                    ? `${challengeLeader.displayName} leads with ${challengeLeader.score} points.`
                    : "No family score is on the board yet."}
                </p>
              </div>
            </div>
          </section>
        ) : null}

        <GameShell
          backLabel="Back to Games"
          title={game.displayName}
          description={readyDescription}
          onBack={() =>
            navigate(
              sessionId
                ? `${game.launcherPath}/${sessionId}`
                : challengeId
                  ? game.challengePath
                : "/dashboard/games",
            )
          }
        >
          <FlappyPlaneGame
            autoStartSignal={sessionId ? autoStartSignal : undefined}
            gameOverDescription={gameOverDescription}
            gameOverTitle={resultsHeadline}
            manualStartEnabled={!sessionId}
            onRoundEnd={handleRoundEnd}
            readyDescription={readyDescription}
            readyTitle={game.displayName}
            seed={session?.seed ?? null}
          />
        </GameShell>

        {(sessionId || localRoundResult) ? (
          <GameSessionResultsCard
            actions={(
              <div className="flex flex-wrap gap-3">
                {sessionId && session?.status === "finished" && isCreator ? (
                  <Button
                    type="button"
                    className="rounded-full"
                    onClick={() => {
                      void handlePrepareRematch();
                    }}
                  >
                    Set up rematch
                  </Button>
                ) : null}
                {sessionId ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => navigate(`${game.launcherPath}/${session?.id ?? sessionId}`)}
                  >
                    Back to Lobby
                  </Button>
                ) : null}
                {challengeId ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => navigate(game.challengePath)}
                  >
                    Back to challenge board
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant={sessionId || challengeId ? "ghost" : "outline"}
                  className="rounded-full"
                  onClick={() => navigate("/dashboard/games")}
                >
                  Back to Games
                </Button>
              </div>
            )}
            currentPlacement={currentPlacement}
            currentProfileId={profileId}
            headline={resultsHeadline}
            nextStepLabel={nextStepLabel}
            results={displayedResults}
            sessionStatus={
              challengeId
                ? challenge?.status === "completed" || challenge?.status === "expired"
                  ? "finished"
                  : "active"
                : session?.status ?? "finished"
            }
            subcopy={resultsSubcopy}
            totalMembers={challengeId ? challenge?.participantCount ?? null : session?.memberCount ?? null}
          />
        ) : null}
      </div>
    </DashboardLayout>
  );
}
