import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Crown, Flag, Sparkles, Swords, Trophy } from "lucide-react";
import { ParentHeaderCallAction } from "@/components/calls/ParentHeaderCallAction";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { GameChallengeLeaderboard } from "@/components/games/GameChallengeLeaderboard";
import { Button } from "@/components/ui/button";
import { useFamily } from "@/contexts/FamilyContext";
import { useChildAccount } from "@/hooks/useChildAccount";
import { useGameChallenges } from "@/hooks/useGameChallenges";
import { useFamilyRole } from "@/hooks/useFamilyRole";
import { isChildGameAllowed } from "@/lib/childAccess";
import { getFamilyGameChallengeStatusLabel } from "@/lib/gameChallenges";
import { getFamilyGameBySlug } from "@/lib/gameRegistry";

export default function GameChallengePage() {
  const navigate = useNavigate();
  const { gameSlug } = useParams<{ gameSlug?: string }>();
  const game = getFamilyGameBySlug(gameSlug ?? null);
  const { activeFamilyId, loading: familyLoading, profileId } = useFamily();
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
    acceptChallenge,
    challenge,
    closeChallenge,
    createChallenge,
    currentParticipant,
    currentResult,
    leaderboard,
    loading: challengeLoading,
    participants,
    scopeError: challengeScopeError,
  } = useGameChallenges({
    gameDisplayName: game?.displayName ?? "Family game",
    gameSlug: game?.slug ?? "flappy-plane",
  });
  const [actionPending, setActionPending] = useState<"accept" | "close" | "create" | null>(null);

  const showCallLauncher =
    Boolean(roleFamilyId) && isParent && !isThirdParty && !isLawOffice && !isChildAccount;
  const childCanUseChallenge =
    !isChildAccount ||
    Boolean(
      game &&
        multiplayer_enabled &&
        isChildGameAllowed(
          {
            allowed_game_slugs,
            games_enabled,
          },
          game.slug,
        ),
    );
  const scopeError = childScopeError ?? challengeScopeError ?? null;
  const isLoading = familyLoading || childLoading || challengeLoading;
  const leader = leaderboard[0] ?? null;
  const currentPlacement = profileId
    ? leaderboard.findIndex((entry) => entry.profileId === profileId)
    : -1;

  const handleCreateChallenge = async () => {
    setActionPending("create");
    try {
      await createChallenge();
    } finally {
      setActionPending(null);
    }
  };

  const handleAcceptChallenge = async () => {
    setActionPending("accept");
    try {
      await acceptChallenge();
    } finally {
      setActionPending(null);
    }
  };

  const handleCloseChallenge = async () => {
    setActionPending("close");
    try {
      await closeChallenge();
    } finally {
      setActionPending(null);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="rounded-full bg-card px-5 py-3 text-sm font-medium text-muted-foreground shadow-sm">
            Loading family challenge...
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!game) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-xl rounded-[2rem] border border-border/70 bg-card/90 p-8 shadow-sm">
          <h1 className="text-2xl font-display font-semibold text-foreground">Game unavailable</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            That family challenge route is not registered in the shared game platform.
          </p>
          <Button asChild className="mt-5 rounded-full">
            <Link to="/dashboard/games">Back to Games</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  if (scopeError) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-xl rounded-[2rem] border border-rose-200 bg-white/90 p-8 shadow-sm">
          <h1 className="text-2xl font-display font-semibold">Family scope required</h1>
          <p className="mt-3 text-sm text-muted-foreground">{scopeError}</p>
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
            Select an active family before opening a family challenge.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  if (game.availability !== "playable") {
    return (
      <DashboardLayout headerActions={showCallLauncher ? <ParentHeaderCallAction /> : null}>
        <div className="mx-auto max-w-2xl rounded-[2rem] border border-border/70 bg-card/90 p-8 shadow-sm">
          <h1 className="text-3xl font-display font-semibold text-foreground">{game.displayName}</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Async family challenges will land here once this title moves from the shared registry
            plan into a playable game. The challenge platform is now being proven first with Toy
            Plane Dash.
          </p>
          <Button asChild className="mt-5 rounded-full">
            <Link to="/dashboard/games">Back to Games</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  if (isChildAccount && !childCanUseChallenge) {
    return (
      <DashboardLayout headerActions={showCallLauncher ? <ParentHeaderCallAction /> : null}>
        <div className="mx-auto max-w-xl rounded-[2rem] border border-amber-200 bg-white/90 p-8 shadow-sm">
          <h1 className="text-2xl font-display font-semibold">Challenge unavailable</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            A parent or guardian needs to enable multiplayer and allow {game.displayName} before
            this child account can join the family challenge.
          </p>
          <Button asChild className="mt-5 rounded-full">
            <Link to={game.playPath}>Open solo preview</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout headerActions={showCallLauncher ? <ParentHeaderCallAction /> : null}>
      <div className="mx-auto max-w-[1320px] space-y-6">
        <section className="relative overflow-hidden rounded-[2.3rem] border border-border/70 bg-card/95 p-6 shadow-[0_30px_70px_-40px_rgba(8,21,47,0.5)] sm:p-7">
          <div className={`absolute inset-0 bg-gradient-to-br ${game.accentClass} opacity-[0.16]`} />
          <div className="absolute inset-y-0 right-8 w-36 rounded-full bg-primary/12 blur-3xl" />

          <div className="relative space-y-5">
            <Button asChild variant="outline" className="rounded-full bg-background/90">
              <Link to="/dashboard/games">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Games
              </Link>
            </Button>

            <div className="space-y-3">
              <div className="inline-flex items-center rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                <Sparkles className="mr-2 h-3.5 w-3.5" />
                Async family challenge
              </div>
              <div>
                <h1 className="text-3xl font-display font-semibold tracking-tight text-foreground sm:text-4xl">
                  {game.displayName} challenge board
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                  This is the non-simultaneous family competition lane. Everyone plays on their own
                  time, best score wins, and all results stay scoped to the active family.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {!challenge ? (
                <Button
                  type="button"
                  className="rounded-full"
                  disabled={actionPending === "create"}
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
                  disabled={actionPending === "accept"}
                  onClick={() => {
                    void handleAcceptChallenge();
                  }}
                >
                  Accept challenge
                </Button>
              ) : challenge.status === "active" ? (
                <Button
                  type="button"
                  className="rounded-full"
                  onClick={() => navigate(`${game.playPath}?challengeId=${challenge.id}`)}
                >
                  Play to beat score
                </Button>
              ) : (
                <Button
                  type="button"
                  className="rounded-full"
                  disabled={actionPending === "create"}
                  onClick={() => {
                    void handleCreateChallenge();
                  }}
                >
                  Start next challenge
                </Button>
              )}

              <Button asChild variant="outline" className="rounded-full bg-background/85">
                <Link to={game.playPath}>Solo preview</Link>
              </Button>

              {challenge?.status === "active" && challenge.createdByProfileId === profileId ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-full"
                  disabled={actionPending === "close"}
                  onClick={() => {
                    void handleCloseChallenge();
                  }}
                >
                  Close challenge
                </Button>
              ) : null}
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="rounded-[2rem] border border-border/70 bg-card/90 p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Family standings
                </p>
                <h2 className="mt-2 text-2xl font-display font-semibold text-foreground">
                  {challenge
                    ? challenge.status === "active"
                      ? "Beat the current family lead"
                      : "Final challenge standings"
                    : "No family challenge is open yet"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {challenge
                    ? challenge.status === "active"
                      ? "Each accepted family member gets one best score on the board. Better scores replace lower ones, weaker runs do not overwrite the current best."
                      : "This challenge is no longer collecting scores. Start a fresh round when the family is ready for the next leaderboard."
                    : "Start a challenge from here to let the family compete without being online at the same time."}
                </p>
              </div>
              {challenge ? (
                <div className="rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  {getFamilyGameChallengeStatusLabel(challenge.status)}
                </div>
              ) : null}
            </div>

            <div className="mt-5">
              <GameChallengeLeaderboard currentProfileId={profileId} leaderboard={leaderboard} />
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-[2rem] border border-border/70 bg-card/90 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Challenge snapshot
              </p>
              {!challenge ? (
                <div className="mt-4 rounded-[1.5rem] border border-dashed border-border/70 bg-muted/20 p-4">
                  <p className="text-sm leading-6 text-muted-foreground">
                    No active family challenge exists for {game.displayName} yet.
                  </p>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <div className="rounded-[1.5rem] border border-border/70 bg-background/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Status
                    </p>
                    <p className="mt-2 text-lg font-display font-semibold text-foreground">
                      {getFamilyGameChallengeStatusLabel(challenge.status)}
                    </p>
                  </div>

                  <div className="rounded-[1.5rem] border border-border/70 bg-background/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Accepted players
                    </p>
                    <p className="mt-2 text-lg font-display font-semibold text-foreground">
                      {participants.length}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {participants.filter((participant) => participant.hasResult).length} already on
                      the board
                    </p>
                  </div>

                  <div className="rounded-[1.5rem] border border-border/70 bg-background/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Current leader
                    </p>
                    <p className="mt-2 text-lg font-display font-semibold text-foreground">
                      {leader ? leader.displayName : "No score yet"}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {leader
                        ? `${leader.score} points and ${leader.distance} distance units`
                        : "The first accepted family member to submit a score becomes the lead to beat."}
                    </p>
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-[2rem] border border-border/70 bg-card/90 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Your standing
              </p>
              <div className="mt-4 space-y-3">
                <div className="rounded-[1.5rem] border border-border/70 bg-background/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Participation
                  </p>
                  <p className="mt-2 text-lg font-display font-semibold text-foreground">
                    {currentParticipant ? "Accepted" : "Not joined yet"}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {currentParticipant
                      ? "You are in the family challenge and can keep improving your best score."
                      : "Accept the challenge first so your best run can be recorded."}
                  </p>
                </div>

                <div className="rounded-[1.5rem] border border-border/70 bg-background/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Best result
                  </p>
                  <p className="mt-2 text-lg font-display font-semibold text-foreground">
                    {currentResult ? `#${currentPlacement + 1}` : "No score yet"}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {currentResult
                      ? currentPlacement === 0
                        ? `You currently lead with ${currentResult.score} points.`
                        : leader
                          ? `You are behind ${leader.score} points and need a stronger run to take the lead.`
                          : `Your best run is ${currentResult.score} points.`
                      : "Open the game and submit your first family challenge run."}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-border/70 bg-card/90 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Challenge rules
              </p>
              <div className="mt-4 space-y-3">
                <div className="flex gap-3 rounded-[1.4rem] border border-border/70 bg-background/80 p-4">
                  <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p className="text-sm leading-6 text-muted-foreground">
                    Best score wins. Better runs replace lower ones, but weaker runs do not erase a
                    family member&apos;s current best.
                  </p>
                </div>
                <div className="flex gap-3 rounded-[1.4rem] border border-border/70 bg-background/80 p-4">
                  <Crown className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p className="text-sm leading-6 text-muted-foreground">
                    The leaderboard stays family-scoped and breaks ties with distance, then earlier
                    submission time.
                  </p>
                </div>
                <div className="flex gap-3 rounded-[1.4rem] border border-border/70 bg-background/80 p-4">
                  <Flag className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p className="text-sm leading-6 text-muted-foreground">
                    Only one active family challenge can exist per game, so the whole family sees
                    the same target to beat.
                  </p>
                </div>
                <div className="flex gap-3 rounded-[1.4rem] border border-border/70 bg-background/80 p-4">
                  <Swords className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p className="text-sm leading-6 text-muted-foreground">
                    This is challenge mode, not live multiplayer. Family members can compete on
                    their own time.
                  </p>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
}
