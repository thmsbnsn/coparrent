import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CarFront, Rocket, ShipWheel, TimerReset, type LucideIcon } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { FamilyGameActivityPanel } from "@/components/games/FamilyGameActivityPanel";
import { GameChallengeLeaderboard } from "@/components/games/GameChallengeLeaderboard";
import { GameComingSoonCard } from "@/components/games/GameComingSoonCard";
import { GameDashboardHero } from "@/components/games/GameDashboardHero";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/StatusPill";
import { ParentHeaderCallAction } from "@/components/calls/ParentHeaderCallAction";
import { useFamily } from "@/contexts/FamilyContext";
import { useChildAccount } from "@/hooks/useChildAccount";
import { useGameChallenges } from "@/hooks/useGameChallenges";
import { useFamilyPresence } from "@/hooks/useFamilyPresence";
import { useGameSessions } from "@/hooks/useGameSessions";
import { useFamilyRole } from "@/hooks/useFamilyRole";
import { isChildGameAllowed } from "@/lib/childAccess";
import { isMissingSupabaseFunctionError } from "@/lib/featureAvailabilityErrors";
import { getFamilyGameChallengeStatusLabel } from "@/lib/gameChallenges";
import {
  FAMILY_GAMES,
  UPCOMING_FAMILY_GAMES,
  type FamilyGameSlug,
} from "@/lib/gameRegistry";

const GAME_ICONS: Record<FamilyGameSlug, LucideIcon> = {
  "family-raceway": CarFront,
  "flappy-plane": TimerReset,
  "pirate-harbor": ShipWheel,
  "star-hopper": Rocket,
};

export default function GameDashboard() {
  const navigate = useNavigate();
  const featuredGame = FAMILY_GAMES.flappyPlane;
  const { activeFamily, activeFamilyId, loading: familyLoading, profileId } = useFamily();
  const { activeFamilyId: roleFamilyId, isLawOffice, isParent, isThirdParty } = useFamilyRole();
  const [challengeActionPending, setChallengeActionPending] = useState<"accept" | "create" | null>(null);
  const {
    allowed_game_slugs,
    games_enabled,
    isChildAccount,
    loading: childLoading,
    multiplayer_enabled,
    scopeError: childScopeError,
  } = useChildAccount();
  const {
    activeCount,
    loading: presenceLoading,
    members,
    scopeError,
  } = useFamilyPresence();
  const {
    loading: sessionsLoading,
    openSession,
    scopeError: sessionsScopeError,
  } = useGameSessions({
    gameDisplayName: featuredGame.displayName,
    gameSlug: featuredGame.slug,
  });
  const {
    acceptChallenge,
    challenge,
    createChallenge,
    currentParticipant,
    leaderboard,
    loading: challengeLoading,
    participants,
    scopeError: challengeScopeError,
  } = useGameChallenges({
    gameDisplayName: featuredGame.displayName,
    gameSlug: featuredGame.slug,
  });

  const viewerName = members.find((member) => member.profileId === profileId)?.displayName ?? null;
  const familyLobbyUpdating = isMissingSupabaseFunctionError(sessionsScopeError, [
    "get_family_game_sessions_overview",
    "rpc_create_family_game_session",
  ]);
  const familyChallengeUpdating = isMissingSupabaseFunctionError(challengeScopeError, [
    "get_family_game_challenge_overview",
    "rpc_create_family_game_challenge",
    "rpc_accept_family_game_challenge",
    "rpc_submit_family_game_challenge_result",
  ]);
  const childCanPlayFlappy = !isChildAccount || isChildGameAllowed(
    {
      allowed_game_slugs,
      games_enabled,
    },
    featuredGame.slug,
  );
  const featuredActionLabel =
    isChildAccount && !multiplayer_enabled
      ? "Play solo"
      : familyLobbyUpdating
        ? "Solo preview"
      : openSession
        ? "Join lobby"
        : "Open family lobby";
  const featuredActionHref =
    isChildAccount && !multiplayer_enabled
      ? featuredGame.playPath
      : familyLobbyUpdating
        ? featuredGame.playPath
        : featuredGame.launcherPath;
  const featuredHeroActionLabel =
    isChildAccount && !multiplayer_enabled
      ? `Open ${featuredGame.displayName} preview`
      : familyLobbyUpdating
        ? `Open ${featuredGame.displayName} preview`
        : `Open ${featuredGame.displayName} lobby`;
  const showCallLauncher =
    Boolean(roleFamilyId) && isParent && !isThirdParty && !isLawOffice && !isChildAccount;
  const childCanUseChallenges = !isChildAccount || (childCanPlayFlappy && multiplayer_enabled);
  const challengeLeader = leaderboard[0] ?? null;
  const featuredLobbyTitle = sessionsScopeError
    ? "Lobby unavailable"
    : familyLobbyUpdating
      ? "Solo preview only"
      : sessionsLoading
        ? "Checking lobby"
        : openSession
          ? "Family lobby live"
          : "No lobby open yet";
  const featuredLobbyMeta = sessionsScopeError
    ? sessionsScopeError
    : familyLobbyUpdating
      ? "The shared lobby rollout is still finishing on this server, so the family can use the solo start screen for now."
      : sessionsLoading
        ? "Looking for an active Toy Plane Dash room for this family."
        : openSession
          ? `${openSession.memberCount}/${openSession.maxPlayers} pilots in the room. Host: ${openSession.createdByDisplayName}.`
          : "Open the family lobby when everyone is ready to move into the shared preflight screen.";

  const handleCreateChallenge = async () => {
    setChallengeActionPending("create");
    try {
      const challengeId = await createChallenge();
      if (challengeId) {
        navigate(featuredGame.challengePath);
      }
      return challengeId;
    } finally {
      setChallengeActionPending(null);
    }
  };

  const handleAcceptChallenge = async () => {
    setChallengeActionPending("accept");
    try {
      await acceptChallenge();
    } finally {
      setChallengeActionPending(null);
    }
  };

  if (familyLoading || childLoading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="rounded-full bg-card px-5 py-3 text-sm font-medium text-muted-foreground shadow-sm">
            Loading game dashboard...
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (isChildAccount && childScopeError) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-xl rounded-[2rem] border border-rose-200 bg-white/90 p-8 shadow-sm">
          <h1 className="text-2xl font-display font-semibold">Family scope required</h1>
          <p className="mt-3 text-sm text-muted-foreground">{childScopeError}</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!activeFamilyId) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-xl rounded-[2rem] border border-rose-200 bg-white/90 p-8 shadow-sm">
          <h1 className="text-2xl font-display font-semibold">Family scope required</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Select an active family before opening the shared games dashboard.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      headerActions={
        showCallLauncher ? <ParentHeaderCallAction /> : null
      }
      showFamilyPresenceToggle
    >
      <div className="page-shell-app page-stack min-w-0">
        <GameDashboardHero
          activeCount={activeCount}
          familyName={activeFamily?.display_name ?? null}
          featuredActionLabel={featuredHeroActionLabel}
          featuredGameHref={featuredActionHref}
          featuredGameName={featuredGame.displayName}
          members={members}
          viewerName={viewerName}
        />

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="min-w-0 space-y-6">
            {childCanPlayFlappy ? (
              <section className="surface-primary overflow-hidden p-5">
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_320px]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="section-kicker text-slate-500">
                        Featured game
                      </p>
                      <StatusPill variant="highlight">
                        1 live game
                      </StatusPill>
                    </div>

                    <h2 className="mt-3 text-3xl font-display font-semibold text-foreground sm:text-4xl">
                      {featuredGame.displayName}
                    </h2>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                      A gentler toy-plane run for solo play, plus a shared family flight deck with a
                      real ready-up step before the synchronized countdown begins.
                    </p>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <Button asChild className="rounded-full">
                        <Link to={featuredActionHref}>
                          {featuredActionLabel}
                        </Link>
                      </Button>
                      <Button asChild variant="outline" className="rounded-full bg-background/85">
                        <Link to={featuredGame.playPath}>Open solo start screen</Link>
                      </Button>
                      <Button asChild variant="outline" className="rounded-full bg-background/85">
                        <Link to={featuredGame.challengePath}>Challenge board</Link>
                      </Button>
                    </div>

                    <div className="mt-6 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-[1.5rem] border border-border/70 bg-white/80 p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Solo path
                        </p>
                        <p className="mt-2 text-lg font-display font-semibold text-foreground">
                          Start from preflight
                        </p>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          No more auto-start on page load. Kids land on a clear start screen first.
                        </p>
                      </div>
                      <div className="rounded-[1.5rem] border border-border/70 bg-white/80 p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Family lobby
                        </p>
                        <p className="mt-2 text-lg font-display font-semibold text-foreground">
                          Join, then ready up
                        </p>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          Presence and family scope stay in the lobby, but the countdown waits for the shared preflight screen.
                        </p>
                      </div>
                      <div className="rounded-[1.5rem] border border-border/70 bg-white/80 p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Challenge mode
                        </p>
                        <p className="mt-2 text-lg font-display font-semibold text-foreground">
                          Async leaderboard
                        </p>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          Keep best-score-only family competition without needing everyone online at once.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-[1.75rem] border border-sky-200/70 bg-[linear-gradient(180deg,rgba(239,246,255,0.95),rgba(255,255,255,0.98))] p-5 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700/70">
                        Family lobby
                      </p>
                      <h3 className="mt-2 text-xl font-display font-semibold text-slate-950">
                        {featuredLobbyTitle}
                      </h3>
                      <p className={`mt-2 text-sm leading-6 ${sessionsScopeError ? "text-rose-700" : "text-muted-foreground"}`}>
                        {isChildAccount && !multiplayer_enabled
                          ? "Multiplayer is off for this child account, so the shared lobby stays hidden and solo play remains available."
                          : featuredLobbyMeta}
                      </p>
                    </div>

                    <div className="rounded-[1.75rem] border border-border/70 bg-slate-950 p-5 text-white shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/65">
                        Best feel
                      </p>
                      <p className="mt-2 text-lg font-display font-semibold">
                        Floatier plane, friendlier start
                      </p>
                      <p className="mt-2 text-sm leading-6 text-white/75">
                        Early obstacles stay wider and calmer so the first runs feel playful instead of punishing.
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            ) : (
              <section className="surface-primary p-6">
                <h2 className="text-2xl font-display font-semibold text-foreground">
                  Games are unavailable for this child account right now.
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                  A parent or guardian needs to turn games back on or explicitly allow Toy Plane
                  Dash before this child can open the family game surface.
                </p>
              </section>
            )}

            <section className="surface-standard p-5">
              <div className="space-y-2">
                <p className="section-kicker text-muted-foreground">
                  Coming soon
                </p>
                <h2 className="text-2xl font-display font-semibold text-foreground">
                  Next up for family play
                </h2>
                <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                  This shared game space is where future multiplayer launches, quick challenges, and
                  family tournaments will land.
                </p>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                {UPCOMING_FAMILY_GAMES.map((game) => (
                  <GameComingSoonCard
                    key={game.slug}
                    accentClass={game.accentClass}
                    description={game.teaserDescription}
                    icon={GAME_ICONS[game.slug]}
                    label={game.teaserLabel}
                    title={game.displayName}
                    to={game.playPath}
                  />
                ))}
              </div>
            </section>
          </section>

          <div className="min-w-0 space-y-6">
            <FamilyGameActivityPanel
              activeCount={activeCount}
              loading={presenceLoading}
              members={members}
              scopeError={scopeError}
            />

            <section className="surface-primary p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="section-kicker text-muted-foreground">
                    Family challenge
                  </p>
                  <h2 className="mt-1 text-2xl font-display font-semibold text-foreground">
                    Beat the family score on your own time
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Async challenges keep one shared score target for the active family without
                    needing everyone online at once.
                  </p>
                </div>
                {challenge ? (
                  <StatusPill variant="scope">
                    {getFamilyGameChallengeStatusLabel(challenge.status)}
                  </StatusPill>
                ) : null}
              </div>

              <div className="mt-5 space-y-4">
                {!childCanUseChallenges ? (
                  <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-muted/20 p-4">
                    <p className="text-sm leading-6 text-muted-foreground">
                      Family challenges stay off for this child account while multiplayer is disabled.
                    </p>
                  </div>
                ) : familyChallengeUpdating ? (
                  <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-muted/20 p-4">
                    <p className="text-sm leading-6 text-muted-foreground">
                      Family challenges are still being enabled on this server. Solo preview stays
                      available while the rollout finishes.
                    </p>
                  </div>
                ) : challengeScopeError ? (
                  <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50/70 p-4">
                    <p className="text-sm leading-6 text-rose-700">{challengeScopeError}</p>
                  </div>
                ) : challengeLoading ? (
                  <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-muted/20 p-4">
                    <p className="text-sm leading-6 text-muted-foreground">
                      Loading the current family challenge board...
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[1.5rem] border border-border/70 bg-background/80 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Current leader
                        </p>
                        <p className="mt-2 text-lg font-display font-semibold text-foreground">
                          {challengeLeader ? challengeLeader.displayName : "No score yet"}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {challengeLeader
                            ? `${challengeLeader.score} points and ${challengeLeader.distance} distance units`
                            : "Start the board and let the family chase the first score."}
                        </p>
                      </div>
                      <div className="rounded-[1.5rem] border border-border/70 bg-background/80 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Accepted players
                        </p>
                        <p className="mt-2 text-lg font-display font-semibold text-foreground">
                          {challenge ? participants.length : 0}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {challenge
                            ? `${challenge.resultCount} score${challenge.resultCount === 1 ? "" : "s"} on the board`
                            : "No active challenge open yet"}
                        </p>
                      </div>
                    </div>

                    <GameChallengeLeaderboard
                      compact
                      currentProfileId={profileId}
                      emptyLabel="No challenge scores yet. Open the board and be the first pilot to post a family score."
                      leaderboard={leaderboard.slice(0, 3)}
                    />

                    <div className="flex flex-wrap gap-3">
                      {!challenge ? (
                        <Button
                          type="button"
                          className="rounded-full"
                          disabled={challengeActionPending === "create"}
                          onClick={() => {
                            void handleCreateChallenge();
                          }}
                        >
                          Start family challenge
                        </Button>
                      ) : challenge.status === "active" && !currentParticipant ? (
                        <Button
                          type="button"
                          className="rounded-full"
                          disabled={challengeActionPending === "accept"}
                          onClick={() => {
                            void handleAcceptChallenge();
                          }}
                        >
                          Accept challenge
                        </Button>
                      ) : challenge.status === "active" ? (
                        <Button asChild className="rounded-full">
                          <Link to={`${featuredGame.playPath}?challengeId=${challenge.id}`}>Play to beat score</Link>
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          className="rounded-full"
                          disabled={challengeActionPending === "create"}
                          onClick={() => {
                            void handleCreateChallenge();
                          }}
                        >
                          Start next challenge
                        </Button>
                      )}

                      <Button asChild variant="outline" className="rounded-full bg-background/85">
                        <Link to={featuredGame.challengePath}>Open challenge board</Link>
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </section>

            <section className="surface-standard p-5">
              <p className="section-kicker text-muted-foreground">
                Family loop
              </p>
              <h2 className="mt-1 text-2xl font-display font-semibold text-foreground">
                Cleaner shared-game flow
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Open the lobby, move into the flight deck, then let everyone ready up only after
                their device setup feels right. The shared dashboard stays readable without stacking
                repeated dark panels across every step.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[1.5rem] border border-border/70 bg-white/75 p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    1. Gather
                  </p>
                  <p className="mt-2 text-sm font-semibold text-foreground">Join the family lobby</p>
                </div>
                <div className="rounded-[1.5rem] border border-border/70 bg-white/75 p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    2. Preflight
                  </p>
                  <p className="mt-2 text-sm font-semibold text-foreground">Fullscreen and rotate first</p>
                </div>
                <div className="rounded-[1.5rem] border border-border/70 bg-white/75 p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    3. Launch
                  </p>
                  <p className="mt-2 text-sm font-semibold text-foreground">Ready up, then start the countdown</p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
