import { Link, useSearchParams } from "react-router-dom";
import { MessageSquareMore, ShieldAlert, Sparkles } from "lucide-react";
import { ChildModeInstallCard } from "@/components/pwa/ChildModeInstallCard";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useAuth } from "@/contexts/AuthContext";
import { useChildAccount } from "@/hooks/useChildAccount";
import { usePresenceHeartbeat } from "@/hooks/usePresenceHeartbeat";
import {
  CHILD_APP_INSTALL_PATH,
  CHILD_APP_MODE_FOUNDATION,
  getChildGameLabel,
  getChildAppLoginPath,
  isChildGameAllowed,
} from "@/lib/childAccess";

const ChildLaunchCard = ({
  description,
  disabled = false,
  href,
  title,
}: {
  description: string;
  disabled?: boolean;
  href?: string;
  title: string;
}) => (
  <div className="rounded-[2rem] border border-border bg-white/90 p-5 shadow-sm">
    <h3 className="text-xl font-display font-semibold text-slate-950">{title}</h3>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    {href && !disabled ? (
      <Button asChild className="mt-5 rounded-full bg-slate-950 text-white hover:bg-slate-800">
        <Link to={href}>Open</Link>
      </Button>
    ) : (
      <div className="mt-5 inline-flex rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-500">
        Parent setup needed
      </div>
    )}
  </div>
);

export default function ChildAppPage() {
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const {
    child_name,
    communication_enabled,
    games_enabled,
    isChildAccount,
    loading: childLoading,
    multiplayer_enabled,
    quick_unlock_enabled,
    scopeError,
    allowed_game_slugs,
  } = useChildAccount();
  const installIntent = searchParams.get("install") === "1";

  usePresenceHeartbeat({
    enabled: Boolean(user && isChildAccount && !scopeError),
    locationType: "dashboard",
  });

  if (authLoading || (user && childLoading)) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#fdf1e7_0%,#fde2d2_48%,#f5f4ef_100%)]">
        <LoadingSpinner fullScreen message="Loading child mode..." />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#fdf1e7_0%,#fde2d2_48%,#f5f4ef_100%)] px-4 py-8 sm:px-6">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col justify-center gap-8">
          <div className="flex items-center justify-between gap-4">
            <Logo size="sm" />
            <div className="rounded-full bg-white/85 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 shadow-sm">
              Child Mode
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <section className="rounded-[2.5rem] border border-white/70 bg-white/85 p-7 shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
              <div className="inline-flex rounded-full bg-sky-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
                {installIntent ? "Child install flow" : "Dedicated launch path"}
              </div>
              <h1 className="mt-5 text-4xl font-display font-semibold text-slate-950 sm:text-5xl">
                {installIntent
                  ? "Install a child-safe start point on this device."
                  : "A child-safe start point from the same app."}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                This route at <span className="font-mono">{CHILD_APP_INSTALL_PATH}</span> is the
                foundation for the future child PWA. Parents still control child credentials,
                quick unlock, communication, games, and screen-time rules from the family settings.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild className="rounded-full bg-sky-600 text-white hover:bg-sky-500">
                  <Link to={getChildAppLoginPath()}>
                    Open child sign-in
                  </Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full bg-white">
                  <Link to="/dashboard/settings">Parent setup</Link>
                </Button>
              </div>
            </section>

            <section className="grid gap-4">
              <ChildModeInstallCard
                allowSignIn
                defaultInstructionsOpen={installIntent}
                openPathHref={null}
                signInHref={getChildAppLoginPath()}
              />
            </section>
          </div>
        </div>
      </div>
    );
  }

  if (!isChildAccount) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#fdf1e7_0%,#fde2d2_48%,#f5f4ef_100%)] px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-3xl rounded-[2.5rem] border border-white/70 bg-white/90 p-8 shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
          <Logo size="sm" />
          <h1 className="mt-6 text-3xl font-display font-semibold text-slate-950">Child mode is ready for child accounts.</h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Parents and guardians can configure direct child access, restrictions, and install
            guidance from Settings before handing a device to a child.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild className="rounded-full bg-slate-950 text-white hover:bg-slate-800">
              <Link to="/dashboard/settings">Open child access settings</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full bg-white">
              <Link to="/dashboard/settings#child-access-section">Choose a child in settings</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (scopeError) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#fdf1e7_0%,#fde2d2_48%,#f5f4ef_100%)] px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-xl rounded-[2rem] border border-rose-200 bg-white/90 p-8 shadow-sm">
          <div className="flex items-center gap-3 text-rose-700">
            <ShieldAlert className="h-5 w-5" />
            <h1 className="text-2xl font-display font-semibold">Family scope required</h1>
          </div>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">{scopeError}</p>
        </div>
      </div>
    );
  }

  const flappyAllowed = isChildGameAllowed(
    {
      allowed_game_slugs: allowed_game_slugs,
      games_enabled,
    },
    "flappy-plane",
  );

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fdf1e7_0%,#fde2d2_48%,#f5f4ef_100%)] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Logo size="sm" />
          <div className="rounded-full bg-white/85 px-4 py-2 text-right shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Child mode</p>
            <p className="text-base font-display font-semibold text-slate-900">{child_name ?? "Friend"}</p>
          </div>
        </div>

        <section className="rounded-[2.5rem] border border-white/70 bg-white/90 p-7 shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex rounded-full bg-sky-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
                {installIntent ? "Installed child mode" : "Dedicated child start"}
              </div>
              <h1 className="mt-5 text-4xl font-display font-semibold text-slate-950 sm:text-5xl">
                Start from a safe, simple child launch shell.
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
                Parents control sign-in, quick unlock, communication, and games for this route.
                The child account only sees surfaces that stay inside that allowed set.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.5rem] bg-slate-100 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Quick unlock</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{quick_unlock_enabled ? "Enabled" : "Off"}</p>
              </div>
              <div className="rounded-[1.5rem] bg-slate-100 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Communication</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{communication_enabled ? "Allowed" : "Off"}</p>
              </div>
              <div className="rounded-[1.5rem] bg-slate-100 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Games</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{games_enabled ? "Allowed" : "Off"}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-3">
          <ChildLaunchCard
            title="Kids Home"
            description="Open the child dashboard with the simple daily view, mood tools, and parent-approved family features."
            href="/kids"
          />
          <ChildLaunchCard
            title={getChildGameLabel("flappy-plane")}
            description="Launch the current toy-plane game directly from child mode when games are enabled for this account."
            href={flappyAllowed ? "/dashboard/games/flappy-plane" : undefined}
            disabled={!flappyAllowed}
          />
          <ChildLaunchCard
            title="Family Game Room"
            description={
              multiplayer_enabled
                ? "Open the shared family game dashboard and join family lobbies when multiplayer is allowed."
                : "Multiplayer family lobbies are turned off for this child account right now."
            }
            href={games_enabled && multiplayer_enabled ? "/dashboard/games" : undefined}
            disabled={!games_enabled || !multiplayer_enabled}
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-border bg-white/90 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-pink-100 p-3 text-pink-700">
                <MessageSquareMore className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Communication</p>
                <h2 className="text-xl font-display font-semibold">Child-safe only</h2>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              {communication_enabled
                ? "Message and calling entry points can still appear inside child-safe surfaces when the more detailed family permissions also allow them."
                : "Communication is disabled for this child account, so child-mode surfaces should stay focused on non-communication flows."}
            </p>
          </div>

          <div className="rounded-[2rem] border border-border bg-white/90 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
              <p className="text-sm font-medium text-muted-foreground">Install foundation</p>
                <h2 className="text-xl font-display font-semibold">{CHILD_APP_MODE_FOUNDATION.shortName}</h2>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              This route stays inside the main CoParrent codebase while giving a dedicated child
              launch path for future install-specific polish, manifests, and device unlock wiring.
            </p>
          </div>
        </div>

        <ChildModeInstallCard
          allowSignIn
          childName={child_name}
          defaultInstructionsOpen={installIntent}
          openPathHref={null}
          quickUnlockEnabled={quick_unlock_enabled}
          title="Keep this child mode ready on the device"
        />
      </div>
    </div>
  );
}
