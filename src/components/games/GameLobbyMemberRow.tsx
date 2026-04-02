import { Crown, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { FamilyGameLobbyMember } from "@/lib/gameSessions";
import {
  formatFamilyPresenceRoleLabel,
  getFamilyPresenceInitials,
} from "@/lib/familyPresence";
import { cn } from "@/lib/utils";

interface GameLobbyMemberRowProps {
  isCurrentUser?: boolean;
  member: FamilyGameLobbyMember;
}

export const GameLobbyMemberRow = ({
  isCurrentUser = false,
  member,
}: GameLobbyMemberRowProps) => {
  const roleLabel = formatFamilyPresenceRoleLabel(member.role, member.relationshipLabel);
  const isReady = member.status === "ready" && Boolean(member.readyAt);

  return (
    <div className="flex items-center gap-4 rounded-[1.6rem] border border-border/70 bg-card/85 p-4 shadow-sm">
      <div className="relative">
        <Avatar className="h-14 w-14 ring-1 ring-border/60">
          <AvatarImage src={member.avatarUrl ?? undefined} alt={member.displayName} />
          <AvatarFallback className="bg-sky-100 text-sm font-semibold text-sky-700">
            {getFamilyPresenceInitials(member.displayName)}
          </AvatarFallback>
        </Avatar>
        <span
          aria-label={isReady ? "ready" : "not-ready"}
          className={cn(
            "absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-white",
            isReady
              ? "bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.16)]"
              : "bg-amber-400 shadow-[0_0_0_4px_rgba(251,191,36,0.16)]",
          )}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-slate-950">
            {member.displayName}
          </p>
          {isCurrentUser ? (
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-700">
              You
            </span>
          ) : null}
          {member.isCreator ? (
            <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700">
              <Crown className="mr-1 h-3 w-3" />
              Host
            </span>
          ) : null}
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
            {roleLabel}
          </span>
        </div>

        <p className="mt-1 text-xs text-muted-foreground">
          {isReady ? (
            <span className="inline-flex items-center text-emerald-700">
              <Sparkles className="mr-1 h-3 w-3" />
              Ready to launch
            </span>
          ) : (
            "Still getting ready"
          )}
        </p>
      </div>

      <div
        className={cn(
          "rounded-full px-3 py-1 text-[11px] font-semibold",
          isReady
            ? "bg-emerald-100 text-emerald-700"
            : "bg-amber-100 text-amber-700",
        )}
      >
        {isReady ? "Ready" : "Not ready"}
      </div>
    </div>
  );
};
