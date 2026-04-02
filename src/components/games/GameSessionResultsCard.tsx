import { Trophy } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { FamilyGameSessionResult, FamilyGameSessionStatus } from "@/lib/gameSessions";
import { getFamilyPresenceInitials } from "@/lib/familyPresence";
import { cn } from "@/lib/utils";

interface GameSessionResultsCardProps {
  currentProfileId: string | null;
  headline: string;
  results: FamilyGameSessionResult[];
  sessionStatus: FamilyGameSessionStatus;
  subcopy: string;
}

export const GameSessionResultsCard = ({
  currentProfileId,
  headline,
  results,
  sessionStatus,
  subcopy,
}: GameSessionResultsCardProps) => (
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

    <div className="mt-5 space-y-3">
      {results.length > 0 ? (
        results.map((result, index) => {
          const isCurrentProfile = result.profileId === currentProfileId;

          return (
            <div
              key={result.profileId}
              className={cn(
                "flex items-center gap-4 rounded-[1.5rem] border border-border/70 bg-muted/25 p-4",
                result.isWinner && "border-amber-200 bg-amber-50/70",
              )}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white">
                {index + 1}
              </div>

              <Avatar className="h-12 w-12 ring-1 ring-border/60">
                <AvatarImage src={result.avatarUrl ?? undefined} alt={result.displayName} />
                <AvatarFallback className="bg-sky-100 text-sm font-semibold text-sky-700">
                  {getFamilyPresenceInitials(result.displayName)}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-slate-950">{result.displayName}</p>
                  {isCurrentProfile ? (
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                      You
                    </span>
                  ) : null}
                  {result.isWinner ? (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                      <Trophy className="mr-1 h-3 w-3" />
                      Winner
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs italic text-muted-foreground">
                  Score {result.score} • Distance {result.distance}
                </p>
              </div>
            </div>
          );
        })
      ) : (
        <div className="rounded-[1.5rem] border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          Results will appear here as each family member finishes the race.
        </div>
      )}
    </div>
  </section>
);
