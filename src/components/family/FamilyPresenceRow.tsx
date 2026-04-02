import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  formatFamilyPresenceRoleLabel,
  getFamilyPresenceInitials,
  getFamilyPresenceSecondaryLabel,
  type FamilyPresenceMember,
} from "@/lib/familyPresence";
import { cn } from "@/lib/utils";

interface FamilyPresenceRowProps {
  member: FamilyPresenceMember;
}

export const FamilyPresenceRow = ({ member }: FamilyPresenceRowProps) => {
  const secondaryLabel = getFamilyPresenceSecondaryLabel(member);
  const isActive = member.presenceStatus === "active";
  const roleLabel = formatFamilyPresenceRoleLabel(member.role, member.relationshipLabel);

  return (
    <div className="flex items-center gap-3 rounded-[1.5rem] border border-border/70 bg-card/80 p-3 shadow-sm">
      <div className="relative">
        <Avatar className="h-12 w-12 ring-1 ring-border/60">
          <AvatarImage src={member.avatarUrl ?? undefined} alt={member.displayName} />
          <AvatarFallback className="bg-sky-100 text-sm font-semibold text-sky-700">
            {getFamilyPresenceInitials(member.displayName)}
          </AvatarFallback>
        </Avatar>
        <span
          aria-label={isActive ? "active" : "inactive"}
          className={cn(
            "absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-white",
            isActive
              ? "bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.16)]"
              : "bg-slate-300",
          )}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-slate-950">{member.displayName}</p>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
            {roleLabel}
          </span>
        </div>
        <p
          className={cn(
            "mt-1 text-xs",
            secondaryLabel
              ? member.locationType === "game"
                ? "italic text-sky-700"
                : "text-muted-foreground"
              : "text-slate-400",
          )}
        >
          {secondaryLabel ?? "Inactive"}
        </p>
      </div>

      <div
        className={cn(
          "rounded-full px-2.5 py-1 text-[11px] font-semibold",
          isActive
            ? "bg-emerald-100 text-emerald-700"
            : "bg-slate-100 text-slate-500",
        )}
      >
        {isActive ? "Active" : "Inactive"}
      </div>
    </div>
  );
};
