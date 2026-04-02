import { Gamepad2, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  getFamilyPresenceInitials,
  type FamilyPresenceMember,
} from "@/lib/familyPresence";

interface GameDashboardHeroProps {
  featuredActionLabel?: string;
  activeCount: number;
  familyName: string | null;
  featuredGameHref: string;
  featuredGameName: string;
  members: FamilyPresenceMember[];
  viewerName: string | null;
}

export const GameDashboardHero = ({
  activeCount,
  familyName,
  featuredActionLabel,
  featuredGameHref,
  featuredGameName,
  members,
  viewerName,
}: GameDashboardHeroProps) => {
  const avatarMembers = members.slice(0, 4);
  const heading = viewerName
    ? `${viewerName.split(" ")[0]}'s family arcade`
    : familyName
      ? `${familyName} arcade`
      : "Family arcade";

  return (
    <section className="relative isolate min-w-0 overflow-hidden rounded-[2.4rem] border border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(15,79,216,0.2),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(15,159,152,0.18),transparent_34%),linear-gradient(135deg,rgba(8,21,47,0.98),rgba(16,36,70,0.95))] p-5 shadow-[0_32px_80px_-42px_rgba(8,21,47,0.95)] sm:p-6 lg:p-8">
      <div className="absolute inset-y-0 right-6 w-40 rounded-full bg-primary/18 blur-3xl" />
      <div className="absolute left-8 top-8 h-28 w-28 rounded-full bg-accent/18 blur-3xl" />

      <div className="relative flex min-w-0 flex-col gap-7 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-white/80 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" />
            Shared game space
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-display font-semibold tracking-tight text-white sm:text-4xl">
              {heading}
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-200/82 sm:text-base">
              Play a quick round, see who is active, and keep family game time in one clean place
              without opening the child-only dashboard.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Button asChild className="h-12 rounded-full px-6">
              <Link to={featuredGameHref}>
                <Gamepad2 className="mr-2 h-4 w-4" />
                {featuredActionLabel ?? `Open ${featuredGameName} lobby`}
              </Link>
            </Button>

            <div className="rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm text-white/88 backdrop-blur">
              {activeCount > 0 ? `${activeCount} family member${activeCount === 1 ? "" : "s"} active right now` : "No one is active yet"}
            </div>
          </div>
        </div>

        <div className="max-w-full rounded-[2rem] border border-white/12 bg-white/10 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-sm xl:max-w-[360px]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-200/75">
            Family players
          </p>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex -space-x-3">
              {avatarMembers.length > 0 ? (
                avatarMembers.map((member) => (
                  <Avatar
                    key={member.membershipId}
                    className="h-12 w-12 border-2 border-slate-900/70 ring-1 ring-white/10"
                  >
                    <AvatarImage src={member.avatarUrl ?? undefined} alt={member.displayName} />
                    <AvatarFallback className="bg-white/12 text-sm font-semibold text-white">
                      {getFamilyPresenceInitials(member.displayName)}
                    </AvatarFallback>
                  </Avatar>
                ))
              ) : (
                <Avatar className="h-12 w-12 border-2 border-slate-900/70 ring-1 ring-white/10">
                  <AvatarFallback className="bg-white/12 text-sm font-semibold text-white">FA</AvatarFallback>
                </Avatar>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                {familyName ?? "Active family"}
              </p>
              <p className="text-xs text-slate-200/72">
                Presence, shared entry, and future multiplayer live here.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
