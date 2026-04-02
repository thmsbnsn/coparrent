import { Link } from "react-router-dom";
import { CarFront, Rocket, ShipWheel, TimerReset } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { FamilyGameActivityPanel } from "@/components/games/FamilyGameActivityPanel";
import { GameCard } from "@/components/games/GameCard";
import { GameComingSoonCard } from "@/components/games/GameComingSoonCard";
import { GameDashboardHero } from "@/components/games/GameDashboardHero";
import { FLAPPY_ASSETS } from "@/assets/games/flappy";
import { Button } from "@/components/ui/button";
import { ParentHeaderCallAction } from "@/components/calls/ParentHeaderCallAction";
import { useFamily } from "@/contexts/FamilyContext";
import { useChildAccount } from "@/hooks/useChildAccount";
import { useFamilyPresence } from "@/hooks/useFamilyPresence";
import { useGameSessions } from "@/hooks/useGameSessions";
import { useFamilyRole } from "@/hooks/useFamilyRole";
import { isChildGameAllowed } from "@/lib/childAccess";
import { isMissingSupabaseFunctionError } from "@/lib/featureAvailabilityErrors";
import { FAMILY_GAMES } from "@/lib/gameRegistry";

const AVAILABLE_GAMES = [
  {
    accentClass: "from-sky-500 via-cyan-500 to-emerald-400",
    artAlt: "Blue toy plane",
    artClassName: "h-24 w-auto sm:h-28",
    artSrc: FLAPPY_ASSETS.sprites.plane,
    description:
      "Open a family lobby first, then launch the synchronized Toy Plane Dash race once everyone is ready.",
    eyebrow: "Playable now",
    icon: TimerReset,
    title: FAMILY_GAMES.flappyPlane.displayName,
  },
] as const;

const COMING_SOON_GAMES = [
  {
    accentClass: "from-rose-500 via-orange-400 to-amber-300",
    description: "Friendly lap races built for side-by-side family competition with simple touch controls.",
    icon: CarFront,
    label: "Future racing",
    title: FAMILY_GAMES.familyRaceway.displayName,
  },
  {
    accentClass: "from-indigo-500 via-sky-500 to-cyan-300",
    description: "Picture-first space missions, quick co-op goals, and bright exploration moments.",
    icon: Rocket,
    label: "Future space",
    title: FAMILY_GAMES.starHopper.displayName,
  },
  {
    accentClass: "from-emerald-500 via-teal-500 to-cyan-400",
    description: "Treasure maps, shared puzzles, and playful pirate adventures without cluttered controls.",
    icon: ShipWheel,
    label: "Future pirate",
    title: FAMILY_GAMES.pirateHarbor.displayName,
  },
] as const;

export default function GameDashboard() {
  const featuredGame = FAMILY_GAMES.flappyPlane;
  const { activeFamily, activeFamilyId, loading: familyLoading, profileId } = useFamily();
  const { activeFamilyId: roleFamilyId, isLawOffice, isParent, isThirdParty } = useFamilyRole();
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

  const viewerName = members.find((member) => member.profileId === profileId)?.displayName ?? null;
  const familyLobbyUpdating = isMissingSupabaseFunctionError(sessionsScopeError, [
    "get_family_game_sessions_overview",
    "rpc_create_family_game_session",
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
  const availableGames = AVAILABLE_GAMES.map((game) => ({
    ...game,
    actionLabel: featuredActionLabel,
    to: featuredActionHref,
  })).filter(() => childCanPlayFlappy);
  const showCallLauncher =
    Boolean(roleFamilyId) && isParent && !isThirdParty && !isLawOffice && !isChildAccount;

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
      <div className="mx-auto max-w-[1400px] min-w-0 space-y-8">
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
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Featured game
              </p>
              {availableGames.length > 0 ? (
                availableGames.map((game) => (
                  <GameCard key={game.title} {...game} className="min-h-[20rem]" />
                ))
              ) : (
                <section className="rounded-[2rem] border border-border/70 bg-card/88 p-6 shadow-[0_22px_42px_-32px_rgba(8,21,47,0.3)]">
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

            <section className="rounded-[2rem] border border-border/70 bg-card/85 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
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
                <div className="rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  1 live game
                </div>
              </div>

              <div className="mt-5 rounded-[1.75rem] border border-border/70 bg-[linear-gradient(135deg,hsl(var(--muted)/0.65),hsl(var(--accent)/0.24))] p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
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

            <section className="rounded-[2rem] border border-border/70 bg-card/85 p-5 shadow-sm">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
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
                {COMING_SOON_GAMES.map((game) => (
                  <GameComingSoonCard key={game.title} {...game} />
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

            <section className="rounded-[2rem] border border-border/70 bg-card/88 p-5 shadow-[0_22px_42px_-32px_rgba(8,21,47,0.3)]">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Multiplayer lane
              </p>
              <h2 className="mt-1 text-2xl font-display font-semibold text-foreground">
                Built for shared family play
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                The shared games dashboard is the family entry point for quick rounds now and
                cleaner multiplayer matchmaking later. Presence already shows who is browsing or
                playing without exposing parent-only tools.
              </p>
            </section>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
