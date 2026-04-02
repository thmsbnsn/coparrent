import { Link } from "react-router-dom";
import { Loader2, Play, Rocket, Users } from "lucide-react";
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
import { cn } from "@/lib/utils";

interface GameLobbyCardProps {
  currentProfileId: string | null;
  joining?: boolean;
  members: FamilyGameLobbyMember[];
  onJoin: () => Promise<void> | void;
  onSetReady: (isReady: boolean) => Promise<void> | void;
  onStart: () => Promise<void> | void;
  readyUpdating?: boolean;
  session: FamilyGameSessionSummary;
  starting?: boolean;
}

export const GameLobbyCard = ({
  currentProfileId,
  joining = false,
  members,
  onJoin,
  onSetReady,
  onStart,
  readyUpdating = false,
  session,
  starting = false,
}: GameLobbyCardProps) => {
  const game = FAMILY_GAMES.flappyPlane;
  const currentMember = members.find((member) => member.profileId === currentProfileId) ?? null;
  const canStart = isFamilyGameSessionStartable(session) && Boolean(currentMember?.isCreator);
  const isSessionActive = session.status === "active";
  const statusLabel = getFamilyGameSessionStatusLabel(session.status);
  const readyLabel = `${session.readyCount}/${session.memberCount} ready`;

  return (
    <section className="rounded-[2rem] border border-border/70 bg-card/90 p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="inline-flex items-center rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
            {game.displayName} lobby
          </div>
          <div>
            <h1 className="text-3xl font-display font-semibold text-slate-950 sm:text-4xl">
              Gather the family before takeoff
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Join the same family-scoped lobby, mark everyone ready, and use this room as the
              launch step before the live race layer is added.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[1.5rem] bg-slate-950 px-4 py-4 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/65">
              Session status
            </p>
            <p className="mt-2 text-sm font-medium">{statusLabel}</p>
          </div>
          <div className="rounded-[1.5rem] bg-sky-50 px-4 py-4 text-slate-900">
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
            <div className="rounded-[1.5rem] border border-border/70 bg-muted/30 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Host
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-950">
                {session.createdByDisplayName}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-border/70 bg-muted/30 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Seats
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-950">
                {session.memberCount} / {session.maxPlayers}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-border/70 bg-muted/30 px-4 py-4">
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

        <aside className="rounded-[1.75rem] border border-border/70 bg-slate-950 p-5 text-white shadow-sm">
          <div className="flex items-center gap-2 text-sky-200">
            <Users className="h-4 w-4" />
            <p className="text-sm font-semibold">Pre-flight controls</p>
          </div>

          <div className="mt-4 space-y-4">
            <p className="text-sm leading-6 text-slate-200/86">
              Everyone can join this family lobby. Ready status is tracked server-side, the host
              starts the shared countdown, and the game page uses the same family-scoped session
              state for the race seed and results.
            </p>

            {!currentMember ? (
              <Button
                type="button"
                className="h-12 w-full rounded-full bg-white text-slate-950 hover:bg-slate-100"
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
              <Button
                type="button"
                className={cn(
                  "h-12 w-full rounded-full text-white",
                  currentMember.status === "ready"
                    ? "bg-amber-500 hover:bg-amber-400"
                    : "bg-emerald-500 hover:bg-emerald-400",
                )}
                disabled={readyUpdating || isSessionActive}
                onClick={() => {
                  void onSetReady(currentMember.status !== "ready");
                }}
              >
                {readyUpdating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : currentMember.status === "ready" ? (
                  "Not ready yet"
                ) : (
                  <>
                    <Rocket className="mr-2 h-4 w-4" />
                    I'm ready
                  </>
                )}
              </Button>
            )}

            <Button
              type="button"
              className="h-12 w-full rounded-full bg-sky-500 text-white hover:bg-sky-400"
              disabled={!canStart || starting}
                onClick={() => {
                  void onStart();
                }}
              >
              {starting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isSessionActive ? (
                "Race is live"
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Start synchronized race
                </>
              )}
            </Button>

            <Separator className="bg-white/12" />

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-300/78">
                Quick fallback
              </p>
              <Button
                asChild
                type="button"
                variant="outline"
                className="h-11 w-full rounded-full border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <Link to={game.playPath}>Open solo preview</Link>
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
};
