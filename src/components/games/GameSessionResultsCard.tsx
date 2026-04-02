import { useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Medal, Sparkles, Trophy } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { FamilyGameSessionResult, FamilyGameSessionStatus } from "@/lib/gameSessions";
import { getFamilyPresenceInitials } from "@/lib/familyPresence";
import { cn } from "@/lib/utils";

interface GameSessionResultsCardProps {
  actions?: ReactNode;
  currentProfileId: string | null;
  headline: string;
  results: FamilyGameSessionResult[];
  sessionStatus: FamilyGameSessionStatus;
  subcopy: string;
}

const PODIUM_ORDER = [1, 0, 2] as const;

const sortResults = (results: FamilyGameSessionResult[]) =>
  [...results].sort((left, right) => {
    if (left.isWinner !== right.isWinner) {
      return left.isWinner ? -1 : 1;
    }

    if (left.score !== right.score) {
      return right.score - left.score;
    }

    if (left.distance !== right.distance) {
      return right.distance - left.distance;
    }

    return new Date(left.reportedAt).getTime() - new Date(right.reportedAt).getTime();
  });

const getPlacementLabel = (placement: number) => {
  switch (placement) {
    case 0:
      return "1st";
    case 1:
      return "2nd";
    case 2:
      return "3rd";
    default:
      return `${placement + 1}th`;
  }
};

const getPodiumTone = (placement: number) => {
  switch (placement) {
    case 0:
      return "border-amber-300/80 bg-[linear-gradient(180deg,rgba(251,191,36,0.22),rgba(255,255,255,0.92))] dark:bg-[linear-gradient(180deg,rgba(251,191,36,0.18),rgba(17,24,39,0.96))]";
    case 1:
      return "border-slate-300/70 bg-[linear-gradient(180deg,rgba(148,163,184,0.16),rgba(255,255,255,0.92))] dark:bg-[linear-gradient(180deg,rgba(148,163,184,0.14),rgba(17,24,39,0.96))]";
    default:
      return "border-amber-500/30 bg-[linear-gradient(180deg,rgba(245,158,11,0.14),rgba(255,255,255,0.92))] dark:bg-[linear-gradient(180deg,rgba(245,158,11,0.12),rgba(17,24,39,0.96))]";
  }
};

const getRankBadgeTone = (placement: number) => {
  switch (placement) {
    case 0:
      return "bg-amber-400 text-slate-950";
    case 1:
      return "bg-slate-800 text-white";
    case 2:
      return "bg-orange-500 text-white";
    default:
      return "bg-slate-950 text-white";
  }
};

export const GameSessionResultsCard = ({
  actions,
  currentProfileId,
  headline,
  results,
  sessionStatus,
  subcopy,
}: GameSessionResultsCardProps) => {
  const [skipAnimations, setSkipAnimations] = useState(false);

  const sortedResults = useMemo(() => sortResults(results), [results]);
  const podiumResults = sortedResults.slice(0, 3);
  const shouldAnimate = !skipAnimations;

  if (sortedResults.length === 0) {
    return (
      <section className="rounded-[2rem] border border-border/70 bg-card/90 p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Race results
            </p>
            <h2 className="mt-1 text-2xl font-display font-semibold text-slate-950">{headline}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{subcopy}</p>
          </div>
          <div className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
            {sessionStatus === "finished" ? "Final" : "Live"}
          </div>
        </div>

        <div className="mt-5 rounded-[1.5rem] border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          Results will appear here as each family member finishes the race.
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-[2rem] border border-border/70 bg-card/95 shadow-[0_26px_60px_-40px_rgba(8,21,47,0.42)]">
      <div className="border-b border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.14),transparent_24%),radial-gradient(circle_at_top_right,rgba(20,184,166,0.16),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.97),rgba(248,250,252,0.94))] px-5 py-5 dark:bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.16),transparent_24%),radial-gradient(circle_at_top_right,rgba(20,184,166,0.16),transparent_30%),linear-gradient(180deg,rgba(10,16,27,0.98),rgba(12,18,31,0.96))] sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Race results
            </div>
            <div>
              <h2 className="text-2xl font-display font-semibold text-slate-950 dark:text-white">
                {headline}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{subcopy}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {sortedResults.length > 1 ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => setSkipAnimations(true)}
              >
                {skipAnimations ? "Animation skipped" : "Skip reveal"}
              </Button>
            ) : null}
            <div className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
              {sessionStatus === "finished" ? "Final" : "Live"}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-5 sm:p-6">
        <div className="grid gap-3 lg:grid-cols-3">
          {PODIUM_ORDER.map((placement, index) => {
            const result = podiumResults[placement];

            if (!result) {
              return (
                <div
                  key={`empty-${placement}`}
                  className="hidden rounded-[1.75rem] border border-dashed border-border/70 bg-muted/20 lg:block"
                />
              );
            }

            const isCurrentProfile = result.profileId === currentProfileId;
            const animationDelay = skipAnimations ? 0 : index * 0.08;

            return (
              <motion.div
                key={result.profileId}
                initial={shouldAnimate ? { opacity: 0, y: 20 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: animationDelay, duration: 0.32 }}
                className={cn(
                  "rounded-[1.75rem] border p-5 shadow-[0_24px_45px_-38px_rgba(8,21,47,0.42)]",
                  getPodiumTone(placement),
                  placement === 0 && "lg:-order-none lg:-translate-y-3",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className={cn("rounded-full px-3 py-1 text-xs font-semibold", getRankBadgeTone(placement))}>
                    {getPlacementLabel(placement)}
                  </div>
                  {result.isWinner ? (
                    <div className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-100">
                      <Trophy className="h-3.5 w-3.5" />
                      Winner
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 flex items-center gap-4">
                  <Avatar className="h-14 w-14 ring-1 ring-border/60">
                    <AvatarImage src={result.avatarUrl ?? undefined} alt={result.displayName} />
                    <AvatarFallback className="bg-sky-100 text-sm font-semibold text-sky-700">
                      {getFamilyPresenceInitials(result.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-slate-950 dark:text-white">
                      {result.displayName}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {isCurrentProfile ? (
                        <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
                          You
                        </span>
                      ) : null}
                      <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                        Score {result.score}
                      </span>
                      <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                        Distance {result.distance}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="rounded-[1.75rem] border border-border/70 bg-muted/20 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Leaderboard
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Final standings stay family-scoped and resolve from the shared session results.
              </p>
            </div>
            <div className="hidden rounded-full bg-background/90 px-3 py-1 text-xs font-medium text-muted-foreground sm:block">
              {sortedResults.length} racers
            </div>
          </div>

          <div className="space-y-3">
            {sortedResults.map((result, index) => {
              const isCurrentProfile = result.profileId === currentProfileId;

              return (
                <motion.div
                  key={`${result.profileId}-${result.reportedAt}`}
                  initial={shouldAnimate ? { opacity: 0, x: -10 } : false}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: skipAnimations ? 0 : 0.18 + index * 0.04, duration: 0.24 }}
                  className={cn(
                    "flex flex-col gap-4 rounded-[1.5rem] border border-border/70 bg-background/80 p-4 sm:flex-row sm:items-center sm:justify-between",
                    isCurrentProfile && "border-primary/20 bg-primary/5 shadow-[0_20px_40px_-34px_hsl(var(--primary)/0.35)]",
                    result.isWinner && "border-amber-300/70 bg-amber-50/60 dark:bg-amber-500/10",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold", getRankBadgeTone(index))}>
                      {index + 1}
                    </div>

                    <Avatar className="h-12 w-12 ring-1 ring-border/60">
                      <AvatarImage src={result.avatarUrl ?? undefined} alt={result.displayName} />
                      <AvatarFallback className="bg-sky-100 text-sm font-semibold text-sky-700">
                        {getFamilyPresenceInitials(result.displayName)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                          {result.displayName}
                        </p>
                        {isCurrentProfile ? (
                          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                            You
                          </span>
                        ) : null}
                        {result.isWinner ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-100">
                            <Medal className="h-3 w-3" />
                            Winner
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Reported {new Date(result.reportedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:w-auto">
                    <div className="rounded-2xl bg-slate-950 px-4 py-3 text-center text-white">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65">
                        Score
                      </p>
                      <p className="mt-1 text-lg font-display font-semibold">{result.score}</p>
                    </div>
                    <div className="rounded-2xl bg-sky-50 px-4 py-3 text-center text-slate-900 dark:bg-sky-500/10 dark:text-white">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700/70 dark:text-sky-200/70">
                        Distance
                      </p>
                      <p className="mt-1 text-lg font-display font-semibold">{result.distance}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
      {actions ? (
        <div className="border-t border-border/70 bg-muted/10 px-5 py-4 sm:px-6">
          {actions}
        </div>
      ) : null}
    </section>
  );
};
