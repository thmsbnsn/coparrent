import { ArrowLeft, CheckCircle2, Rocket, ShieldCheck, Users } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ParentHeaderCallAction } from "@/components/calls/ParentHeaderCallAction";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useFamily } from "@/contexts/FamilyContext";
import { useChildAccount } from "@/hooks/useChildAccount";
import { useFamilyRole } from "@/hooks/useFamilyRole";
import { getFamilyGameBySlug } from "@/lib/gameRegistry";

const DETAIL_ICONS = [Users, ShieldCheck, Rocket] as const;

export default function GameOverviewPage() {
  const { gameSlug } = useParams<{ gameSlug?: string }>();
  const game = getFamilyGameBySlug(gameSlug ?? null);
  const { activeFamilyId, loading: familyLoading } = useFamily();
  const { activeFamilyId: roleFamilyId, isLawOffice, isParent, isThirdParty } = useFamilyRole();
  const {
    games_enabled,
    isChildAccount,
    loading: childLoading,
    scopeError,
  } = useChildAccount();

  const showCallLauncher =
    Boolean(roleFamilyId) && isParent && !isThirdParty && !isLawOffice && !isChildAccount;

  if (game?.slug === "flappy-plane") {
    return <Navigate to={game.playPath} replace />;
  }

  if (familyLoading || childLoading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="rounded-full bg-card px-5 py-3 text-sm font-medium text-muted-foreground shadow-sm">
            Loading game overview...
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (scopeError) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-xl rounded-[2rem] border border-rose-200 bg-white/90 p-8 shadow-sm">
          <h1 className="text-2xl font-display font-semibold">Family scope required</h1>
          <p className="mt-3 text-sm text-muted-foreground">{scopeError}</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!activeFamilyId) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-xl rounded-[2rem] border border-rose-200 bg-white/90 p-8 shadow-sm">
          <h1 className="text-2xl font-display font-semibold">Family scope required</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Select an active family before opening a shared game overview.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  if (!game) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-xl rounded-[2rem] border border-border/70 bg-card/90 p-8 shadow-sm">
          <h1 className="text-2xl font-display font-semibold text-slate-950">Game unavailable</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            That shared game route is not registered in the family game platform yet.
          </p>
          <Button asChild className="mt-5 rounded-full">
            <Link to="/dashboard/games">Back to Games</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  if (isChildAccount && !games_enabled) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-xl rounded-[2rem] border border-amber-200 bg-white/90 p-8 shadow-sm">
          <h1 className="text-2xl font-display font-semibold">Games unavailable</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            A parent or guardian needs to turn games back on before this child account can browse
            shared family game plans.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout headerActions={showCallLauncher ? <ParentHeaderCallAction /> : null}>
      <div className="mx-auto max-w-[1200px] space-y-6">
        <section className="relative overflow-hidden rounded-[2.3rem] border border-border/70 bg-card/95 p-6 shadow-[0_30px_70px_-40px_rgba(8,21,47,0.5)] sm:p-7">
          <div className={`absolute inset-0 bg-gradient-to-br ${game.accentClass} opacity-[0.16]`} />
          <div className="absolute inset-y-0 right-8 w-36 rounded-full bg-primary/12 blur-3xl" />

          <div className="relative space-y-5">
            <Button asChild variant="outline" className="rounded-full bg-background/90">
              <Link to="/dashboard/games">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Games
              </Link>
            </Button>

            <div className="space-y-3">
              <div className="inline-flex rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                {game.dashboardEyebrow}
              </div>
              <div>
                <h1 className="text-3xl font-display font-semibold tracking-tight text-foreground sm:text-4xl">
                  {game.displayName}
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                  {game.detailDescription}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="rounded-full border border-border/70 bg-background/85 px-4 py-2 text-sm font-medium text-foreground">
                {game.detailStatusLabel}
              </div>
              <div className="rounded-full border border-border/70 bg-background/85 px-4 py-2 text-sm font-medium text-muted-foreground">
                {game.supportsMultiplayer ? "Shared family multiplayer planned" : "Solo family game"}
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="rounded-[2rem] border border-border/70 bg-card/90 p-5 shadow-sm sm:p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Platform path
              </p>
              <h2 className="mt-2 text-2xl font-display font-semibold text-foreground">
                Ready to plug into the shared session foundation
              </h2>
            </div>

            <div className="mt-5 grid gap-4">
              {game.detailHighlights.map((highlight, index) => {
                const Icon = DETAIL_ICONS[index % DETAIL_ICONS.length];

                return (
                  <div
                    key={highlight}
                    className="flex gap-4 rounded-[1.5rem] border border-border/70 bg-muted/20 p-4"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="text-sm leading-6 text-foreground/88">{highlight}</p>
                  </div>
                );
              })}
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-[2rem] border border-border/70 bg-card/90 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                What works now
              </p>
              <div className="mt-4 space-y-3">
                <div className="flex gap-3 rounded-[1.3rem] border border-border/70 bg-background/80 p-4">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <p className="text-sm leading-6 text-muted-foreground">
                    The registry, shared route space, and family-scoped lobby architecture are live.
                  </p>
                </div>
                <div className="flex gap-3 rounded-[1.3rem] border border-border/70 bg-background/80 p-4">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <p className="text-sm leading-6 text-muted-foreground">
                    Toy Plane Dash is the first real consumer, so future titles can stay additive.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-border/70 bg-card/90 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Next move
              </p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Keep the next implementation on the shared platform: registry metadata, family
                sessions, presence, child-safe restrictions, and result handling.
              </p>
              <Button asChild className="mt-5 w-full rounded-full">
                <Link to="/dashboard/games">Back to the shared arcade</Link>
              </Button>
            </section>
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
}
