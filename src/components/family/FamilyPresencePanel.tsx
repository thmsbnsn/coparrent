import { Loader2, Users } from "lucide-react";
import { FamilyPresenceRow } from "@/components/family/FamilyPresenceRow";
import type { FamilyPresenceMember } from "@/lib/familyPresence";

interface FamilyPresencePanelProps {
  activeCount: number;
  loading?: boolean;
  members: FamilyPresenceMember[];
  scopeError?: string | null;
}

export const FamilyPresencePanel = ({
  activeCount,
  loading = false,
  members,
  scopeError = null,
}: FamilyPresencePanelProps) => (
  <div className="w-[min(24rem,calc(100vw-2rem))] space-y-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
          Family presence
        </p>
        <h3 className="mt-1 text-lg font-display font-semibold text-slate-950">Who is here right now?</h3>
      </div>
      <div className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
        {activeCount} active
      </div>
    </div>

    {scopeError ? (
      <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        {scopeError}
      </div>
    ) : loading ? (
      <div className="flex items-center justify-center rounded-[1.5rem] border border-dashed border-border bg-muted/30 px-4 py-10 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading family members...
      </div>
    ) : members.length === 0 ? (
      <div className="rounded-[1.5rem] border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
        <Users className="mx-auto h-5 w-5 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium">No active family members to show</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Presence appears here once the current family has active memberships.
        </p>
      </div>
    ) : (
      <div className="max-h-[24rem] space-y-3 overflow-y-auto pr-1">
        {members.map((member) => (
          <FamilyPresenceRow key={member.membershipId} member={member} />
        ))}
      </div>
    )}
  </div>
);
