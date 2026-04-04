import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CarFront, Rocket, ShipWheel, TimerReset, type LucideIcon } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { FamilyGameActivityPanel } from "@/components/games/FamilyGameActivityPanel";
import { GameChallengeLeaderboard } from "@/components/games/GameChallengeLeaderboard";
import { GameCard } from "@/components/games/GameCard";
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
  PLAYABLE_FAMILY_GAMES,
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
  const availableGames = PLAYABLE_FAMILY_GAMES.map((game) => ({
    accentClass: game.accentClass,
    actionLabel: featuredActionLabel,
    artAlt: game.previewArtAlt,
    artClassName: game.previewArtClassName,
    artSrc: game.previewArtSrc,
    description: game.dashboardDescription,
    eyebrow: game.dashboardEyebrow,
    icon: GAME_ICONS[game.slug],
    title: game.displayName,
    to: game.slug === featuredGame.slug ? featuredActionHref : game.playPath,
  })).filter((game) => (game.title === featuredGame.displayName ? childCanPlayFlappy : true));
  const showCallLauncher =
    Boolean(roleFamilyId) && isParent && !isThirdParty && !isLawOffice && !isChildAccount;
  const childCanUseChallenges = !isChildAccount || (childCanPlayFlappy && multiplayer_enabled);
  const challengeLeader = leaderboard[0] ?? null;

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
      showFamilyPresenceToggle={false}
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
            <div className="space-y-3">
              <p className="section-kicker text-slate-500">
                Featured game
              </p>
              {availableGames.length > 0 ? (
                availableGames.map((game) => (
                  <GameCard key={game.title} {...game} className="min-h-[20rem]" />
                ))
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
            </div>

            <section className="surface-primary p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="section-kicker text-muted-foreground">
                    Available now
                  </p>
                  <h2 className="mt-1 text-2xl font-display font-semibold text-foreground">
                    Start a quick round
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                    Shared games now start in a family-scoped lobby so everyone can gather before a
                    synchronized seeded race begins.
                  </p>
                </div>
                <StatusPill variant="highlight">
                  1 live game
                </StatusPill>
              </div>

              <div className="surface-secondary mt-5 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="section-kicker text-muted-foreground">
                      Family lobby
                    </p>
                    {isChildAccount && !multiplayer_enabled ? (
                      <p className="text-sm text-muted-foreground">
                        Multiplayer is off for this child account, so shared lobbies stay hidden.
                      </p>
                    ) : familyLobbyUpdating ? (
                      <p className="text-sm text-muted-foreground">
                        Family lobbies are still being enabled on this server. Solo preview is
                        available while we finish the update.
                      </p>
                    ) : sessionsScopeError ? (
                      <p className="text-sm text-rose-700">{sessionsScopeError}</p>
                    ) : sessionsLoading ? (
                      <p className="text-sm text-muted-foreground">
                        Checking for an open Toy Plane Dash lobby...
                      </p>
                    ) : openSession ? (
                      <p className="text-sm text-muted-foreground">
                        {openSession.memberCount}/{openSession.maxPlayers} pilots in the room.
                        Host: {openSession.createdByDisplayName}.
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No lobby is open yet. Start one and the family can gather here before
                        launch.
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {availableGames.length > 0 && (
                      <Button asChild className="rounded-full">
                        <Link to={featuredActionHref}>
                          {featuredActionLabel}
                        </Link>
                      </Button>
                    )}
                    {childCanPlayFlappy && (
                      <Button asChild variant="outline" className="rounded-full bg-background/85">
                        <Link to={featuredGame.playPath}>Solo preview</Link>
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {availableGames.map((game) => (
                  <GameCard key={`${game.title}-grid`} {...game} className="min-h-[15rem]" />
                ))}
              </div>
            </section>

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
                Multiplayer lane
              </p>
              <h2 className="mt-1 text-2xl font-display font-semibold text-foreground">
                Built for shared family play
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                The shared games dashboard is the family entry point for quick rounds, async
                family challenges, and cleaner multiplayer matchmaking later. Presence already
                shows who is browsing or playing without exposing parent-only tools.
              </p>
            </section>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
