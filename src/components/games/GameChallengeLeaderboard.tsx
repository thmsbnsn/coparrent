import { Crown, Medal } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getFamilyPresenceInitials } from "@/lib/familyPresence";
import { type FamilyGameChallengeLeaderboardEntry } from "@/lib/gameChallenges";
import { cn } from "@/lib/utils";

interface GameChallengeLeaderboardProps {
  compact?: boolean;
  currentProfileId: string | null;
  emptyLabel?: string;
  leaderboard: FamilyGameChallengeLeaderboardEntry[];
}

export const GameChallengeLeaderboard = ({
  compact = false,
  currentProfileId,
  emptyLabel = "No challenge scores yet. Be the first family member to put a score on the board.",
  leaderboard,
}: GameChallengeLeaderboardProps) => {
  if (leaderboard.length === 0) {
    return (
      <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center text-sm leading-6 text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {leaderboard.map((entry, index) => {
        const isCurrentProfile = entry.profileId === currentProfileId;

        return (
          <div
            key={`${entry.profileId}-${entry.submittedAt}`}
            className={cn(
              "flex flex-col gap-4 rounded-[1.5rem] border border-border/70 bg-background/80 p-4 sm:flex-row sm:items-center sm:justify-between",
              compact && "rounded-[1.3rem] p-3.5",
              isCurrentProfile && "border-primary/20 bg-primary/5 shadow-[0_18px_36px_-30px_hsl(var(--primary)/0.38)]",
              entry.isLeader && "border-amber-300/70 bg-amber-50/60 dark:bg-amber-500/10",
            )}
          >
            <div className="flex min-w-0 items-center gap-4">
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white",
                  index === 0 && "bg-amber-400 text-slate-950",
                  compact && "h-9 w-9 text-xs",
                )}
              >
                {index + 1}
              </div>

              <Avatar className={cn("h-12 w-12 ring-1 ring-border/60", compact && "h-10 w-10")}>
                <AvatarImage src={entry.avatarUrl ?? undefined} alt={entry.displayName} />
                <AvatarFallback className="bg-sky-100 text-sm font-semibold text-sky-700">
                  {getFamilyPresenceInitials(entry.displayName)}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">{entry.displayName}</p>
                  {isCurrentProfile ? (
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                      You
                    </span>
                  ) : null}
                  {entry.isLeader ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-100">
                      {index === 0 ? <Crown className="h-3 w-3" /> : <Medal className="h-3 w-3" />}
                      Leader
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Submitted {new Date(entry.submittedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </p>
              </div>
            </div>

            <div className={cn("grid grid-cols-2 gap-2 sm:w-auto", compact && "gap-1.5")}>
              <div className="rounded-2xl bg-slate-950 px-4 py-3 text-center text-white">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65">
                  Score
                </p>
                <p className={cn("mt-1 text-lg font-display font-semibold", compact && "text-base")}>
                  {entry.score}
                </p>
              </div>
              <div className="rounded-2xl bg-sky-50 px-4 py-3 text-center text-slate-900 dark:bg-sky-500/10 dark:text-white">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700/70 dark:text-sky-200/70">
                  Distance
                </p>
                <p className={cn("mt-1 text-lg font-display font-semibold", compact && "text-base")}>
                  {entry.distance}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
