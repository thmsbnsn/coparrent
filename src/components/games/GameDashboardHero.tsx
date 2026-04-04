import { Gamepad2, Sparkles, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatusPill } from "@/components/ui/StatusPill";
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
  const activeLabel =
    activeCount > 0
      ? `${activeCount} family member${activeCount === 1 ? "" : "s"} active right now`
      : "No one is active yet";

  return (
    <section className="surface-hero min-w-0 p-5 sm:p-6 lg:p-8">
      <div className="absolute inset-y-0 right-6 w-40 rounded-full bg-primary/18 blur-3xl" />
      <div className="absolute left-8 top-8 h-28 w-28 rounded-full bg-accent/18 blur-3xl" />
      <div className="absolute right-12 top-10 h-24 w-24 rounded-full border border-white/10 bg-white/5 blur-2xl" />

      <div className="relative grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(20rem,0.92fr)] xl:items-end">
        <div className="max-w-3xl space-y-6">
          <StatusPill variant="dark" icon={<Sparkles className="h-3.5 w-3.5" />}>
            Shared game space
          </StatusPill>
          <div className="space-y-3">
            <h1 className="text-3xl font-display font-semibold tracking-tight text-white sm:text-4xl">
              {heading}
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-200/82 sm:text-base">
              Play a quick round, see who is active, and keep family game time in one clean place
              without opening the child-only dashboard.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button asChild className="h-12 rounded-2xl px-6 shadow-[0_24px_45px_-26px_rgba(8,21,47,0.95)]">
              <Link to={featuredGameHref}>
                <Gamepad2 className="mr-2 h-4 w-4" />
                {featuredActionLabel ?? `Open ${featuredGameName} lobby`}
              </Link>
            </Button>

            <StatusPill variant="dark">{activeLabel}</StatusPill>
            <StatusPill variant="dark" icon={<Trophy className="h-4 w-4" />}>
              Family challenges ready
            </StatusPill>
          </div>
        </div>

        <div className="space-y-4 xl:max-w-[380px]">
          <SectionCard variant="glass" className="text-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-200/75">
                  Family players
                </p>
                <p className="mt-2 text-lg font-display font-semibold text-white">
                  {familyName ?? "Active family"}
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-200/72">
                  Presence, shared entry, and future multiplayer all stay in one family-scoped place.
                </p>
              </div>
              <StatusPill variant="dark">Live lobby</StatusPill>
            </div>

            <div className="mt-5 flex items-center gap-3">
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
                <p className="text-sm font-semibold text-white">{activeLabel}</p>
                <p className="text-xs text-slate-200/72">
                  Queue a round, start a lobby, or open the featured game immediately.
                </p>
              </div>
            </div>
          </SectionCard>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
            <SectionCard variant="glass" className="text-white">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-200/68">
                Featured game
              </p>
              <p className="mt-3 text-xl font-display font-semibold text-white">{featuredGameName}</p>
              <p className="mt-2 text-sm leading-6 text-slate-200/72">
                Family-first launch point with lobby and solo preview support.
              </p>
            </SectionCard>
            <SectionCard variant="glass" className="text-white">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-200/68">
                Next layer
              </p>
              <p className="mt-3 text-xl font-display font-semibold text-white">Challenges</p>
              <p className="mt-2 text-sm leading-6 text-slate-200/72">
                Async family competition without losing the calm product tone.
              </p>
            </SectionCard>
          </div>
        </div>
      </div>
    </section>
  );
};
