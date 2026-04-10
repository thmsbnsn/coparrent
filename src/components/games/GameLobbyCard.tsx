import { Link } from "react-router-dom";
import { ArrowRight, Loader2, RotateCcw, TimerReset, Users } from "lucide-react";
import { GameLobbyMemberRow } from "@/components/games/GameLobbyMemberRow";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FAMILY_GAMES } from "@/lib/gameRegistry";
import {
  getFamilyGameSessionStatusLabel,
  isFamilyGameSessionStartable,
  type FamilyGameLobbyMember,
  type FamilyGameSessionSummary,
} from "@/lib/gameSessions";

interface GameLobbyCardProps {
  currentProfileId: string | null;
  flightDeckHref: string;
  joining?: boolean;
  members: FamilyGameLobbyMember[];
  onJoin: () => Promise<void> | void;
  onPrepareRematch?: () => Promise<void> | void;
  rematchPending?: boolean;
  session: FamilyGameSessionSummary;
}

export const GameLobbyCard = ({
  currentProfileId,
  flightDeckHref,
  joining = false,
  members,
  onJoin,
  onPrepareRematch,
  rematchPending = false,
  session,
}: GameLobbyCardProps) => {
  const game = FAMILY_GAMES.flappyPlane;
  const currentMember = members.find((member) => member.profileId === currentProfileId) ?? null;
  const isSessionActive = session.status === "active";
  const isSessionFinished = session.status === "finished";
  const statusLabel = getFamilyGameSessionStatusLabel(session.status);
  const readyLabel = `${session.readyCount}/${session.memberCount} ready`;
  const readinessMessage = isSessionFinished
    ? currentMember?.isCreator
      ? "Reset this room with a fresh shared seed, then have everyone reopen the preflight screen before the next launch."
      : "The race is over. Wait for the host to reset the room, then reopen the preflight screen for the next takeoff."
    : isSessionActive
      ? "The synchronized race is already live. Rejoin the flight deck to keep flying or watch the standings land."
      : currentMember
        ? isFamilyGameSessionStartable(session)
          ? "Everyone is in place. Open the flight deck so the host can begin the countdown after the family is fully set."
          : "Open the flight deck when you are ready to rotate, fullscreen, and mark yourself ready for takeoff."
        : "Join this family-scoped room first, then open the flight deck when you want to start your preflight setup.";

  return (
    <section className="rounded-[2rem] border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(244,248,255,0.88))] p-5 shadow-[0_28px_58px_-42px_rgba(8,21,47,0.42)] sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="inline-flex items-center rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
            {game.displayName} lobby
          </div>
          <div>
            <h1 className="text-3xl font-display font-semibold text-slate-950 sm:text-4xl">
              Gather the family, then move into preflight
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Use this room to gather the family and confirm who is here. The actual ready-up,
              fullscreen setup, rotate hint, and synchronized launch now happen inside the flight
              deck so nobody loses time before the countdown begins.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[1.5rem] bg-slate-950 px-4 py-4 text-white shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/65">
              Session status
            </p>
            <p className="mt-2 text-sm font-medium">{statusLabel}</p>
          </div>
          <div className="rounded-[1.5rem] border border-sky-200/80 bg-sky-50 px-4 py-4 text-slate-900">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700/70">
              Pilots ready
            </p>
            <p className="mt-2 text-sm font-medium">{readyLabel}</p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.5rem] border border-white/70 bg-white/70 px-4 py-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Host
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-950">
                {session.createdByDisplayName}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-white/70 bg-white/70 px-4 py-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Seats
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-950">
                {session.memberCount} / {session.maxPlayers}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-white/70 bg-white/70 px-4 py-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Session
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-950">
                {session.id.slice(0, 8).toUpperCase()}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {members.map((member) => (
              <GameLobbyMemberRow
                key={member.profileId}
                isCurrentUser={member.profileId === currentProfileId}
                member={member}
              />
            ))}
          </div>
        </div>

        <aside className="rounded-[1.75rem] border border-sky-200/70 bg-[linear-gradient(180deg,rgba(239,246,255,0.94),rgba(255,255,255,0.96))] p-5 text-slate-900 shadow-sm">
          <div className="flex items-center gap-2 text-sky-700">
            <TimerReset className="h-4 w-4" />
            <p className="text-sm font-semibold">Flight deck handoff</p>
          </div>

          <div className="mt-4 space-y-4">
            <p className="text-sm leading-6 text-slate-700">
              {isSessionFinished
                ? "This race is complete. Reset the room here, then send everyone back into the flight deck for another family-scoped countdown."
                : "This room only tracks who is here. Ready status and launch timing stay server-owned, but the actual ready-up happens in the flight deck after each player has had a chance to rotate and fullscreen."}
            </p>

            <div className="rounded-[1.4rem] border border-sky-200/80 bg-white px-4 py-3 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Launch status
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{readinessMessage}</p>
            </div>

            {isSessionFinished ? (
              currentMember?.isCreator ? (
                <Button
                  type="button"
                  className="h-12 w-full rounded-full bg-slate-950 text-white hover:bg-slate-800"
                  disabled={rematchPending}
                  onClick={() => {
                    void onPrepareRematch?.();
                  }}
                >
                  {rematchPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Set up rematch
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  type="button"
                  className="h-12 w-full rounded-full bg-slate-100 text-slate-500 hover:bg-slate-100"
                  disabled
                >
                  Waiting for host reset
                </Button>
              )
            ) : !currentMember ? (
              <Button
                type="button"
                className="h-12 w-full rounded-full bg-slate-950 text-white hover:bg-slate-800"
                disabled={joining || isSessionActive}
                onClick={() => {
                  void onJoin();
                }}
              >
                {joining ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Users className="mr-2 h-4 w-4" />
                    Join lobby
                  </>
                )}
              </Button>
            ) : (
              <Button asChild className="h-12 w-full rounded-full bg-sky-600 text-white hover:bg-sky-500">
                <Link to={flightDeckHref}>
                  {isSessionActive ? "Rejoin live flight" : "Open flight deck"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )}

            <Separator className="bg-white/12" />

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Quick options
              </p>
              {currentMember && !isSessionFinished ? (
                <div className="rounded-[1.35rem] border border-sky-200/70 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-900">
                  Open the flight deck before marking ready. That preflight screen is where
                  fullscreen, rotate guidance, and the shared countdown now live.
                </div>
              ) : null}
              <Button
                asChild
                type="button"
                variant="outline"
                className="h-11 w-full rounded-full border-border/70 bg-white hover:bg-slate-50"
              >
                <Link to={game.playPath}>Open solo start screen</Link>
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
};
