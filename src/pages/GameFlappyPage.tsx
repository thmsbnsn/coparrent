import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Maximize2,
  Minimize2,
  Play,
  RotateCw,
  ShieldCheck,
  Trophy,
  Users,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { GameSessionResultsCard } from "@/components/games/GameSessionResultsCard";
import {
  FlappyPlaneGame,
  type FlappyRoundSummary,
} from "@/components/kids/games/FlappyPlaneGame";
import { readBestFlappyScore } from "@/components/kids/games/flappyBestScore";
import {
  GameShell,
  type GameShellImmersiveState,
} from "@/components/kids/games/GameShell";
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

const START_CONFIRMATION_TIMEOUT_MS = 900;
const GO_LABEL_DURATION_MS = 850;

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
    currentMember,
    currentResult,
    isCreator,
    loading: lobbyLoading,
    members,
    prepareRematch,
    reportResult,
    results,
    scopeError: lobbyScopeError,
    session,
    setReady,
    startSession,
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
  const [localBestScore, setLocalBestScore] = useState(() => readBestFlappyScore());
  const [localRoundResult, setLocalRoundResult] = useState<FlappyRoundSummary | null>(null);
  const [raceStarted, setRaceStarted] = useState(false);
  const [runtimeArmed, setRuntimeArmed] = useState(false);
  const [runtimeResetSignal, setRuntimeResetSignal] = useState(0);
  const [sessionActionPending, setSessionActionPending] = useState<"ready" | "start" | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const launchKeyRef = useRef<string | null>(null);
  const preflightResetKeyRef = useRef<string | null>(null);
  const reportedResultRef = useRef(false);
  const raceStartedRef = useRef(false);
  const runtimeArmedRef = useRef(false);
  const startPendingTimeoutRef = useRef<number | null>(null);
  const goLabelTimeoutRef = useRef<number | null>(null);
  const resultsSectionRef = useRef<HTMLDivElement | null>(null);
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
    raceStartedRef.current = raceStarted;
  }, [raceStarted]);

  useEffect(() => {
    runtimeArmedRef.current = runtimeArmed;
  }, [runtimeArmed]);

  useEffect(() => () => {
    if (startPendingTimeoutRef.current !== null) {
      window.clearTimeout(startPendingTimeoutRef.current);
    }

    if (goLabelTimeoutRef.current !== null) {
      window.clearTimeout(goLabelTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    reportedResultRef.current = Boolean(sessionId && currentResult);
    if (sessionId && currentResult && !localRoundResult) {
      setLocalRoundResult({
        bestScore: currentResult.score,
        distance: currentResult.distance,
        score: currentResult.score,
        seed: session?.seed ?? 1,
      });
      setLocalBestScore((currentBest) => Math.max(currentBest, currentResult.score));
    }
  }, [currentResult, localRoundResult, session?.seed, sessionId]);

  useEffect(() => {
    if (!challengeId) {
      setChallengeSubmission(null);
    }
  }, [challengeId]);

  useEffect(() => {
    if (!sessionId || !session) {
      return;
    }

    if (session.status !== "waiting" && session.status !== "ready") {
      return;
    }

    const nextResetKey = `${session.id}:${session.status}:${session.startedAt ?? "nostart"}:${session.startTime ?? "nostart"}`;
    if (preflightResetKeyRef.current === nextResetKey) {
      return;
    }

    preflightResetKeyRef.current = nextResetKey;
    launchKeyRef.current = null;
    reportedResultRef.current = false;
    setCountdownLabel(null);
    setLocalRoundResult(null);
    setRaceStarted(false);
    setRuntimeResetSignal((current) => current + 1);
    setSyncError(null);

    if (startPendingTimeoutRef.current !== null) {
      window.clearTimeout(startPendingTimeoutRef.current);
      startPendingTimeoutRef.current = null;
    }
  }, [session?.id, session?.startTime, session?.startedAt, session?.status, sessionId, session]);

  useEffect(() => {
    if (!sessionId) {
      setCountdownLabel(null);
      setRaceStarted(false);
      setSyncError(null);
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
    const startTime = new Date(session.startTime).getTime();

    const updateCountdown = () => {
      const msRemaining = startTime - Date.now();

      if (msRemaining > 0) {
        setSyncError(null);
        setCountdownLabel(
          runtimeArmedRef.current
            ? String(Math.max(1, Math.ceil(msRemaining / 1000)))
            : "Arming",
        );
        return;
      }

      if (!runtimeArmedRef.current) {
        setCountdownLabel(null);
        if (launchKeyRef.current !== `${nextLaunchKey}:failed`) {
          launchKeyRef.current = `${nextLaunchKey}:failed`;
          setSyncError(
            "This device was not armed when the synchronized launch fired. Re-arm the flight deck or return to the lobby before retrying.",
          );
        }
        return;
      }

      if (launchKeyRef.current !== nextLaunchKey) {
        launchKeyRef.current = nextLaunchKey;
        setSyncError(null);
        setAutoStartSignal((current) => current + 1);

        if (startPendingTimeoutRef.current !== null) {
          window.clearTimeout(startPendingTimeoutRef.current);
        }

        startPendingTimeoutRef.current = window.setTimeout(() => {
          if (!raceStartedRef.current) {
            setCountdownLabel(null);
            setSyncError(
              "Takeoff was cleared, but this device never entered the round. Re-arm this cockpit or return to the lobby for a rematch.",
            );
          }
        }, START_CONFIRMATION_TIMEOUT_MS);
      }

      setCountdownLabel(raceStartedRef.current ? "Go!" : "Launching");
    };

    updateCountdown();
    const intervalId = window.setInterval(updateCountdown, 120);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [localRoundResult, session?.id, session?.startTime, session?.status, sessionId, session]);

  const handleRoundStart = useCallback(() => {
    if (startPendingTimeoutRef.current !== null) {
      window.clearTimeout(startPendingTimeoutRef.current);
      startPendingTimeoutRef.current = null;
    }

    setRaceStarted(true);
    setSyncError(null);
    setCountdownLabel("Go!");

    if (goLabelTimeoutRef.current !== null) {
      window.clearTimeout(goLabelTimeoutRef.current);
    }

    goLabelTimeoutRef.current = window.setTimeout(() => {
      setCountdownLabel((currentLabel) => (currentLabel === "Go!" ? null : currentLabel));
    }, GO_LABEL_DURATION_MS);
  }, []);

  const handleRuntimeArmedChange = useCallback((armed: boolean) => {
    setRuntimeArmed(armed);

    if (
      armed &&
      (!session?.startTime || new Date(session.startTime).getTime() > Date.now())
    ) {
      setSyncError(null);
    }
  }, [session?.startTime]);

  const handleRoundEnd = useCallback(
    async (summary: FlappyRoundSummary) => {
      setLocalBestScore(summary.bestScore);
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

  const handleSetSessionReady = useCallback(async () => {
    if (!sessionId || !currentMember) {
      return;
    }

    setSessionActionPending("ready");

    try {
      const updated = await setReady(currentMember.status !== "ready");
      if (!updated) {
        setSyncError("Toy Plane Dash could not update your ready state. Stay in this preflight screen and try again.");
        return;
      }

      setSyncError(null);
    } finally {
      setSessionActionPending(null);
    }
  }, [currentMember, sessionId, setReady]);

  const handleStartSession = useCallback(async () => {
    if (!sessionId || !session) {
      return;
    }

    setSessionActionPending("start");

    try {
      const started = await startSession();
      if (!started) {
        setSyncError("The synchronized launch did not arm on the server. Stay in preflight and try again.");
        return;
      }

      setSyncError(null);
    } finally {
      setSessionActionPending(null);
    }
  }, [session, sessionId, startSession]);

  const handleResetCockpit = useCallback(() => {
    launchKeyRef.current = null;
    setCountdownLabel(null);
    setRaceStarted(false);
    setRuntimeResetSignal((current) => current + 1);
    setSyncError(null);
  }, []);

  const handlePrepareRematch = useCallback(async () => {
    if (!sessionId || !session) {
      return;
    }

    const prepared = await prepareRematch();
    if (!prepared) {
      return;
    }

    launchKeyRef.current = null;
    reportedResultRef.current = false;
    setCountdownLabel(null);
    setLocalRoundResult(null);
    setRaceStarted(false);
    setRuntimeResetSignal((current) => current + 1);
    setSyncError(null);

    navigate(`${game.launcherPath}/${session.id}`, { replace: true });
  }, [game.launcherPath, navigate, prepareRematch, session, sessionId]);

  const scrollToResults = useCallback(() => {
    resultsSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

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

    if (challengeId) {
      return "Family challenge board";
    }

    if (!currentPlayerResult) {
      return sessionId ? "Shared race standings" : "Local scorecard";
    }

    if (session?.status === "finished" && session.winnerProfileId === profileId) {
      return "You win";
    }

    if (session?.status === "finished") {
      return "Shared race complete";
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

    if (challengeId) {
      if (challengeLeader) {
        return `${challengeLeader.displayName} leads with ${challengeLeader.score} points and ${challengeLeader.distance} distance units.`;
      }

      return "No family score is on the challenge board yet. Open the preflight screen when you are ready to post the first run.";
    }

    if (!sessionId) {
      return currentPlayerResult
        ? `You scored ${currentPlayerResult.score} and flew ${currentPlayerResult.distance} distance units this round.`
        : "Solo runs stay on this device until you move into a shared family lobby or challenge.";
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
    if (challengeId) {
      return challengeDisplayResults;
    }

    if (results.length > 0) {
      return results;
    }

    return currentPlayerResult ? [currentPlayerResult] : [];
  }, [challengeDisplayResults, challengeId, currentPlayerResult, results]);

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

    if (challengeId) {
      if (!challenge) {
        return "Open the family challenge board again from the games dashboard if you need to refresh the shared standings.";
      }

      if (challenge.status === "active" && currentParticipant) {
        return "Your next accepted run can still improve your family rank while the challenge stays open.";
      }

      if (challenge.status === "active") {
        return "Accept the active family challenge before you try to place a run on the shared board.";
      }

      return "This challenge is closed. Start the next family challenge from the board when everyone wants a fresh async leaderboard.";
    }

    if (!sessionId) {
      return "Start another solo run from the preflight screen or head back to the games dashboard for the next family launch.";
    }

    if (session?.status === "finished") {
      return isCreator
        ? "Set up the rematch when the family is ready, then everyone can return to preflight in the same room."
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

  const shellDescription = sessionId
    ? "Shared family flight deck. Rotate first, fullscreen if you want more runway, then mark ready so the host can start the synchronized countdown."
    : challengeId
      ? "Async family challenge mode. Start when you are ready and your strongest run will post back to the active family board."
      : `${child_name ? `${child_name}, ` : ""}Toy Plane Dash now starts from a calmer solo preflight screen with a softer glide and a gentler early runway.`;

  const gameOverDescription = challengeId
    ? challengeDisplayResult
      ? `Score ${challengeDisplayResult.score}. Distance ${challengeDisplayResult.distance}.`
      : undefined
    : currentPlayerResult
      ? `Score ${currentPlayerResult.score}. Distance ${currentPlayerResult.distance}.`
      : undefined;

  const sessionReadyCount = session?.readyCount ?? 0;
  const sessionMemberCount = session?.memberCount ?? 0;
  const allJoinedPlayersReady = Boolean(
    session &&
    sessionMemberCount > 0 &&
    sessionMemberCount === sessionReadyCount &&
    session.status === "ready",
  );
  const flightDeckBackLabel = sessionId
    ? "Back to Lobby"
    : challengeId
      ? "Back to challenge board"
      : "Back to Games";
  const flightDeckBackTarget = sessionId
    ? `${game.launcherPath}/${sessionId}`
    : challengeId
      ? game.challengePath
      : "/dashboard/games";

  const handleStartRoundInFullscreen = useCallback(
    (immersiveMode: GameShellImmersiveState, startRound: () => void) => {
      // Keep the fullscreen request in the same click handler so browsers preserve user activation.
      void immersiveMode.enterImmersiveMode();
      startRound();
    },
    [],
  );

  const renderImmersiveNotice = (immersiveMode: GameShellImmersiveState) => {
    if (!immersiveMode.immersiveNotice) {
      return null;
    }

    const noticeClasses = immersiveMode.immersiveNoticeTone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : immersiveMode.immersiveNoticeTone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-sky-200 bg-sky-50 text-sky-700";

    return (
      <div className={`mt-4 rounded-[1.4rem] border px-4 py-3 text-sm ${noticeClasses}`}>
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="leading-6">{immersiveMode.immersiveNotice}</p>
        </div>
      </div>
    );
  };

  const renderImmersiveButton = (
    immersiveMode: GameShellImmersiveState,
    labels: {
      enter: string;
      exit: string;
    } = {
      enter: "Enter Fullscreen",
      exit: "Exit Fullscreen",
    },
  ) =>
    immersiveMode.fullscreenSupported ? (
      immersiveMode.isFullscreenActive ? (
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          onClick={() => {
            void immersiveMode.exitImmersiveMode();
          }}
        >
          <Minimize2 className="mr-2 h-4 w-4" />
          {labels.exit}
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          onClick={() => {
            void immersiveMode.enterImmersiveMode();
          }}
        >
          <Maximize2 className="mr-2 h-4 w-4" />
          {labels.enter}
        </Button>
      )
    ) : (
      <div className="rounded-full border border-border/70 bg-slate-100 px-4 py-2 text-xs font-medium text-slate-600">
        Rotate manually
      </div>
    );

  const renderSessionReadyOverlay = (
    immersiveMode: GameShellImmersiveState,
    startRound: () => void,
  ) => {
    const sessionStateLabel = syncError
      ? "Needs attention"
      : raceStarted
        ? "In flight"
        : session?.status === "active" && countdownLabel
          ? `Launch ${countdownLabel}`
          : currentMember?.status === "ready"
            ? "Ready for takeoff"
            : currentMember
              ? "Not ready yet"
              : "Join from the lobby";

    return (
      <div className="rounded-[2rem] bg-white/97 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.2)] sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
            Shared family session
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {sessionReadyCount}/{sessionMemberCount} ready
          </div>
          {session?.seed ? (
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              Seed {session.seed}
            </div>
          ) : null}
        </div>

        <h2 className="mt-4 text-2xl font-display font-semibold text-slate-950">
          Family preflight
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Gather here inside the flight deck, rotate first, and only mark ready after your setup
          feels good. The countdown does not begin until the server says every joined pilot is ready
          and the host starts the synchronized launch.
        </p>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="space-y-3">
            <div className="rounded-[1.5rem] border border-border/70 bg-slate-950 px-4 py-4 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/65">
                Local status
              </p>
              <p className="mt-2 text-lg font-display font-semibold">{sessionStateLabel}</p>
              <p className="mt-2 text-sm leading-6 text-white/80">
                {currentMember
                  ? currentMember.status === "ready"
                    ? "You are counted for launch. Stay here while the family finishes setup."
                    : "Stay here after you rotate and fullscreen, then mark ready when you want to be counted."
                  : "Join this room from the lobby first. Family scope stays explicit and the ready flow will not guess for you."}
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-sky-200/80 bg-sky-50 px-4 py-4 text-slate-900">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700/70">
                Screen setup
              </p>
              <p className="mt-2 text-sm font-semibold">
                {immersiveMode.orientationLocked
                  ? "Landscape lock is active."
                  : immersiveMode.isLandscape
                    ? "Landscape view is active."
                    : "Rotate to landscape for the cleanest runway."}
              </p>
              <p className="mt-2 text-xs leading-5 text-sky-900/80">
                {immersiveMode.landscapeSupportLabel}
              </p>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-border/70 bg-slate-50/85 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Family readiness
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ready state is server-owned and scoped to this family session.
                </p>
              </div>
              <Users className="h-4 w-4 text-slate-500" />
            </div>

            <div className="mt-4 space-y-2.5">
              {members.map((member) => {
                const memberReady = member.status === "ready" && Boolean(member.readyAt);
                return (
                  <div
                    key={member.profileId}
                    className="flex items-center justify-between gap-3 rounded-[1.25rem] border border-white/80 bg-white/90 px-3 py-3 shadow-sm"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-slate-950">
                          {member.displayName}
                        </p>
                        {member.profileId === profileId ? (
                          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                            You
                          </span>
                        ) : null}
                        {member.isCreator ? (
                          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                            Host
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {memberReady
                          ? "Ready and counted for launch"
                          : "Present in the room, still setting up"}
                      </p>
                    </div>
                    <div className={`rounded-full px-3 py-1 text-[11px] font-semibold ${memberReady ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {memberReady ? "Ready" : "Waiting"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {syncError ? (
          <div className="mt-5 rounded-[1.4rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Launch sync failed closed</p>
                <p className="mt-1 leading-6">{syncError}</p>
              </div>
            </div>
          </div>
        ) : null}

        {renderImmersiveNotice(immersiveMode)}

        <div className="mt-5 flex flex-wrap gap-3">
          {currentMember ? (
            <Button
              type="button"
              className={`rounded-full ${currentMember.status === "ready" ? "bg-amber-500 text-white hover:bg-amber-400" : "bg-emerald-500 text-white hover:bg-emerald-400"}`}
              disabled={sessionActionPending === "ready" || session?.status === "active"}
              onClick={() => {
                void handleSetSessionReady();
              }}
            >
              {sessionActionPending === "ready" ? (
                <>
                  <RotateCw className="mr-2 h-4 w-4 animate-spin" />
                  Updating
                </>
              ) : currentMember.status === "ready" ? (
                "Not ready yet"
              ) : (
                <>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Ready up
                </>
              )}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => navigate(`${game.launcherPath}/${session?.id ?? sessionId}`)}
            >
              Join from lobby
            </Button>
          )}

          {renderImmersiveButton(immersiveMode)}

          {currentMember?.isCreator ? (
            <Button
              type="button"
              variant={allJoinedPlayersReady ? "default" : "outline"}
              className="rounded-full"
              disabled={
                sessionActionPending === "start" ||
                session?.status === "active" ||
                session?.status === "finished" ||
                !allJoinedPlayersReady
              }
              onClick={() => {
                void handleStartSession();
              }}
            >
              {sessionActionPending === "start" ? (
                <>
                  <RotateCw className="mr-2 h-4 w-4 animate-spin" />
                  Starting
                </>
              ) : session?.status === "active" ? (
                "Countdown live"
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Begin countdown
                </>
              )}
            </Button>
          ) : (
            <div className="rounded-full border border-border/70 bg-slate-100 px-4 py-2 text-xs font-medium text-slate-600">
              {allJoinedPlayersReady ? "Waiting for the host to begin countdown" : "Countdown stays locked until everyone is ready"}
            </div>
          )}

          <Button
            type="button"
            variant="ghost"
            className="rounded-full"
            onClick={scrollToResults}
          >
            Standings
          </Button>

          {syncError ? (
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={handleResetCockpit}
            >
              Reset cockpit
            </Button>
          ) : null}

          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => navigate(`${game.launcherPath}/${session?.id ?? sessionId}`)}
          >
            Back to Lobby
          </Button>

          {session?.status === "active" && countdownLabel === null && runtimeArmed && !raceStarted ? (
            <Button
              type="button"
              variant="ghost"
              className="rounded-full"
              onClick={startRound}
            >
              Retry local launch
            </Button>
          ) : null}
        </div>
      </div>
    );
  };

  const renderSoloOrChallengeReadyOverlay = (
    immersiveMode: GameShellImmersiveState,
    startRound: () => void,
    bestScore: number,
  ) => (
    <div className="rounded-[2rem] bg-white/97 p-5 text-left shadow-[0_24px_60px_rgba(15,23,42,0.2)] sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
          {challengeId ? "Family challenge run" : "Solo flight"}
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          Best {bestScore}
        </div>
      </div>

      <h2 className="mt-4 text-2xl font-display font-semibold text-slate-950">
        {challengeId ? "Take your best challenge shot" : "Start when the runway feels right"}
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {challengeId
          ? "This run reports back to the active family challenge board. Your strongest accepted score stays on the board and weaker retries never overwrite it."
          : "Solo mode never auto-starts now. Open fullscreen if you want the extra width, settle into landscape, then tap Start Game when you are ready."}
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[1.5rem] border border-border/70 bg-slate-950 px-4 py-4 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/65">
            How to play
          </p>
          <p className="mt-2 text-sm font-semibold">Tap to flap, glide through gaps, and keep the nose above the grass.</p>
          <p className="mt-2 text-xs leading-5 text-white/75">
            The new flight model gives the plane a softer glide and a more forgiving early obstacle curve.
          </p>
        </div>
        <div className="rounded-[1.5rem] border border-sky-200/80 bg-sky-50 px-4 py-4 text-slate-900">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700/70">
            Screen setup
          </p>
          <p className="mt-2 text-sm font-semibold">
            {immersiveMode.orientationLocked
              ? "Landscape lock is active."
              : immersiveMode.isLandscape
                ? "Landscape is active."
                : "Landscape gives the cleanest view."}
          </p>
          <p className="mt-2 text-xs leading-5 text-sky-900/80">
            {immersiveMode.landscapeSupportLabel}
          </p>
        </div>
      </div>

      {renderImmersiveNotice(immersiveMode)}

      <div className="mt-5 flex flex-wrap gap-3">
        <Button
          type="button"
          className="rounded-full bg-sky-600 text-white hover:bg-sky-500"
          onClick={startRound}
        >
          <Play className="mr-2 h-4 w-4" />
          {challengeId ? "Start challenge run" : "Start Game"}
        </Button>

        {!immersiveMode.isFullscreenActive && immersiveMode.fullscreenSupported ? (
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => {
              handleStartRoundInFullscreen(immersiveMode, startRound);
            }}
          >
            <Maximize2 className="mr-2 h-4 w-4" />
            Start in Fullscreen
          </Button>
        ) : null}

        {renderImmersiveButton(immersiveMode)}

        {challengeId ? (
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => navigate(game.challengePath)}
          >
            <Trophy className="mr-2 h-4 w-4" />
            Challenge board
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => navigate(game.launcherPath)}
          >
            <Users className="mr-2 h-4 w-4" />
            Join family lobby
          </Button>
        )}

        <Button
          type="button"
          variant="ghost"
          className="rounded-full"
          onClick={scrollToResults}
        >
          {challengeId ? "Results" : "Scorecard"}
        </Button>

        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          onClick={() => navigate(flightDeckBackTarget)}
        >
          {challengeId ? "Exit challenge" : "Back"}
        </Button>
      </div>
    </div>
  );

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
        <GameShell
          backLabel={flightDeckBackLabel}
          title={game.displayName}
          description={shellDescription}
          onBack={() => navigate(flightDeckBackTarget)}
        >
          {(immersiveMode) => (
            <div className="space-y-4">
              <FlappyPlaneGame
                autoStartSignal={sessionId ? autoStartSignal : undefined}
                gameOverDescription={gameOverDescription}
                gameOverTitle={resultsHeadline}
                manualStartEnabled={!sessionId}
                onRoundEnd={handleRoundEnd}
                onRoundStart={handleRoundStart}
                onRuntimeArmedChange={handleRuntimeArmedChange}
                readyDescription={shellDescription}
                readyTitle={game.displayName}
                renderReadyOverlay={({ bestScore, startRound }) =>
                  sessionId
                    ? renderSessionReadyOverlay(immersiveMode, startRound)
                    : renderSoloOrChallengeReadyOverlay(immersiveMode, startRound, bestScore)
                }
                resetSignal={runtimeResetSignal}
                seed={session?.seed ?? null}
              />

              {raceStarted && !localRoundResult ? (
                <section className="rounded-[1.5rem] border border-border/70 bg-white/92 p-4 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Flight controls
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Fullscreen, standings, and back controls stay available while the round is live.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {renderImmersiveButton(immersiveMode)}
                      <Button
                        type="button"
                        variant="ghost"
                        className="rounded-full"
                        onClick={scrollToResults}
                      >
                        Standings
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full"
                        onClick={() => navigate(flightDeckBackTarget)}
                      >
                        {flightDeckBackLabel}
                      </Button>
                    </div>
                  </div>

                  {renderImmersiveNotice(immersiveMode)}
                </section>
              ) : null}
            </div>
          )}
        </GameShell>

        {!sessionId && !challengeId && !localRoundResult ? (
          <div ref={resultsSectionRef}>
            <section className="rounded-[2rem] border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(244,248,255,0.88))] p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Local scorecard
                  </p>
                  <h2 className="mt-1 text-2xl font-display font-semibold text-slate-950">
                    Solo results stay on this device
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                    Solo runs never auto-post into a family session. Enter a family lobby or challenge
                    when you want shared standings or server-scoped result tracking.
                  </p>
                </div>
                <div className="rounded-full border border-sky-200/80 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-800">
                  Best score: {localBestScore}
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.5rem] border border-border/70 bg-slate-950 px-4 py-4 text-white">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/65">
                    Best on this device
                  </p>
                  <p className="mt-2 text-3xl font-display font-semibold">{localBestScore}</p>
                  <p className="mt-2 text-xs leading-5 text-white/75">
                    Ready whenever you want another local run.
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-border/70 bg-white/80 px-4 py-4 text-slate-900">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Last flight
                  </p>
                  <p className="mt-2 text-lg font-display font-semibold">
                    No solo round finished yet
                  </p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Tap Start Game in the preflight screen when you want your first scorecard entry.
                  </p>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {(sessionId || localRoundResult || challengeId) ? (
          <div ref={resultsSectionRef}>
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
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
