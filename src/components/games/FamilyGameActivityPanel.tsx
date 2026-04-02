import { Loader2 } from "lucide-react";
import { FamilyPresenceRow } from "@/components/family/FamilyPresenceRow";
import type { FamilyPresenceMember } from "@/lib/familyPresence";

interface FamilyGameActivityPanelProps {
  activeCount: number;
  loading?: boolean;
  members: FamilyPresenceMember[];
  scopeError?: string | null;
}

export const FamilyGameActivityPanel = ({
  activeCount,
  loading = false,
  members,
  scopeError = null,
}: FamilyGameActivityPanelProps) => (
  <section className="rounded-[2rem] border border-border/70 bg-card/85 p-5 shadow-sm">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
          Family activity
        </p>
        <h2 className="mt-1 text-2xl font-display font-semibold text-slate-950">Who is playing now?</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Live presence stays scoped to the active family and shows whether someone is on the
          dashboard, in a game lobby, or already inside a game.
        </p>
      </div>
      <div className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
        {activeCount} active
      </div>
    </div>

    {scopeError ? (
      <div className="mt-5 rounded-[1.5rem] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        {scopeError}
      </div>
    ) : loading ? (
      <div className="mt-5 flex items-center justify-center rounded-[1.5rem] border border-dashed border-border bg-muted/30 px-4 py-10 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading family activity...
      </div>
    ) : (
      <div className="mt-5 space-y-3">
        {members.slice(0, 6).map((member) => (
          <FamilyPresenceRow key={member.membershipId} member={member} />
        ))}
      </div>
    )}
  </section>
);
