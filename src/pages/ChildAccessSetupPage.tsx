import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ChevronLeft,
  Clock3,
  KeyRound,
  Loader2,
  MessageSquareMore,
  Shield,
  Smartphone,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ChildModeInstallCard } from "@/components/pwa/ChildModeInstallCard";
import { ChildAccessSettingsCard } from "@/components/settings/ChildAccessSettingsCard";
import { ChildRestrictionsCard } from "@/components/settings/ChildRestrictionsCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useFamily } from "@/contexts/FamilyContext";
import { useChildPermissions } from "@/hooks/useChildPermissions";
import {
  CHILD_APP_INSTALL_INTENT_PATH,
  getChildAppLoginPath,
  getChildGameLabel,
} from "@/lib/childAccess";
import type { KidPortalMode } from "@/lib/kidsPortal";

const SetupStatusCard = ({
  description,
  title,
  tone = "muted",
}: {
  description: string;
  title: string;
  tone?: "muted" | "positive" | "warning";
}) => {
  const toneClasses =
    tone === "positive"
      ? "bg-emerald-50 text-emerald-800"
      : tone === "warning"
        ? "bg-amber-50 text-amber-800"
        : "bg-slate-100 text-slate-800";

  return (
    <div className={`rounded-[1.5rem] px-4 py-4 ${toneClasses}`}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-2 text-sm leading-6 opacity-80">{description}</p>
    </div>
  );
};

export default function ChildAccessSetupPage() {
  const { childId } = useParams<{ childId: string }>();
  const { activeFamily, activeFamilyId } = useFamily();
  const {
    childAccounts,
    loading,
    scopeError,
    toggleLoginEnabled,
    updateDeviceAccessSettings,
    updatePortalSettings,
  } = useChildPermissions();

  const account = useMemo(
    () => childAccounts.find((candidate) => candidate.child_id === childId) ?? null,
    [childAccounts, childId],
  );
  const [isSaving, setIsSaving] = useState(false);
  const [portalMode, setPortalMode] = useState<KidPortalMode>("age_6_to_12");
  const [childUsername, setChildUsername] = useState("");
  const [childEmail, setChildEmail] = useState("");
  const [resetViaChildEmail, setResetViaChildEmail] = useState(false);
  const [quickUnlockEnabled, setQuickUnlockEnabled] = useState(false);
  const [screenTimeEnabled, setScreenTimeEnabled] = useState(false);
  const [screenTimeDailyMinutes, setScreenTimeDailyMinutes] = useState("");
  const [communicationEnabled, setCommunicationEnabled] = useState(true);
  const [gamesEnabled, setGamesEnabled] = useState(true);
  const [multiplayerEnabled, setMultiplayerEnabled] = useState(true);
  const [allowedGameSlugs, setAllowedGameSlugs] = useState<string[]>([]);

  useEffect(() => {
    if (!account) {
      return;
    }

    setPortalMode(account.portal_mode);
    setChildUsername(account.child_username ?? "");
    setChildEmail(account.child_email ?? "");
    setResetViaChildEmail(account.reset_via_child_email);
    setQuickUnlockEnabled(account.device_access.quick_unlock_enabled);
    setScreenTimeEnabled(account.device_access.screen_time_enabled);
    setScreenTimeDailyMinutes(account.device_access.screen_time_daily_minutes?.toString() ?? "");
    setCommunicationEnabled(account.device_access.communication_enabled);
    setGamesEnabled(account.device_access.games_enabled);
    setMultiplayerEnabled(account.device_access.multiplayer_enabled);
    setAllowedGameSlugs(account.device_access.allowed_game_slugs);
  }, [account]);

  const updateBusyState = async (action: () => Promise<boolean>) => {
    setIsSaving(true);
    try {
      return await action();
    } finally {
      setIsSaving(false);
    }
  };

  const toggleAllowedGame = (gameSlug: string) =>
    setAllowedGameSlugs((current) =>
      current.includes(gameSlug)
        ? current.filter((value) => value !== gameSlug)
        : [...current, gameSlug],
    );

  if (loading) {
    return (
      <DashboardLayout>
        <LoadingSpinner message="Loading child device setup..." />
      </DashboardLayout>
    );
  }

  if (!activeFamilyId) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-xl rounded-[2rem] border border-rose-200 bg-white/90 p-8 shadow-sm">
          <h1 className="text-2xl font-display font-semibold">Family scope required</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Select an active family before opening the child device setup flow.
          </p>
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

  if (!childId || !account) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-xl rounded-[2rem] border border-amber-200 bg-white/90 p-8 shadow-sm">
          <div className="flex items-center gap-3 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
            <h1 className="text-2xl font-display font-semibold">Child setup unavailable</h1>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            That child record is not available in the active family.
          </p>
          <Button asChild className="mt-5 rounded-full">
            <Link to="/dashboard/settings">Back to settings</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const signInReady = account.has_account && account.login_enabled;
  const canSelfReset = resetViaChildEmail && childEmail.trim().length > 0;
  const allowedGamesSummary = allowedGameSlugs.length > 0
    ? allowedGameSlugs.map((slug) => getChildGameLabel(slug)).join(", ")
    : "No games allowed";

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="ghost" className="rounded-full px-0 text-sm text-muted-foreground hover:bg-transparent">
            <Link to="/dashboard/settings">
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back to settings
            </Link>
          </Button>
        </div>

        <section className="rounded-[2.5rem] border border-white/70 bg-white/90 p-7 shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
                Child device setup
              </p>
              <h1 className="mt-4 text-4xl font-display font-semibold text-slate-950 sm:text-5xl">
                Set up {account.child_name}&apos;s child-mode device.
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
                This guided flow keeps child access family-scoped, server-backed, and ready for the
                dedicated child install path. Family: {activeFamily?.display_name ?? "Active family"}.
              </p>
            </div>

            <div className="rounded-[2rem] bg-slate-100 px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Current readiness</p>
              <p className="mt-3 text-lg font-semibold text-slate-950">
                {signInReady ? "Child sign-in is ready" : "Child sign-in still needs setup"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {canSelfReset ? "Child email reset is enabled." : "Password reset stays parent-managed."}
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <section className="rounded-[2rem] border border-border/70 bg-card/90 p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Step 1
                  </p>
                  <h2 className="mt-1 text-2xl font-display font-semibold text-slate-950">
                    Account and sign-in
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Confirm that the child has credentials, the right portal mode, and the intended
                    password reset ownership before the device is handed over.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  {account.child_profile_id ? (
                    <Button
                      type="button"
                      variant={account.login_enabled ? "outline" : "default"}
                      className="rounded-full"
                      onClick={() =>
                        void updateBusyState(() =>
                          toggleLoginEnabled(account.child_profile_id!, !account.login_enabled),
                        )
                      }
                    >
                      {account.login_enabled ? "Disable child sign-in" : "Enable child sign-in"}
                    </Button>
                  ) : (
                    <div className="rounded-full bg-amber-50 px-4 py-2 text-sm text-amber-800">
                      Create a child account first
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label>Portal mode</Label>
                  <Select value={portalMode} onValueChange={(value: KidPortalMode) => setPortalMode(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="under_6">Under 6: request-only entry</SelectItem>
                      <SelectItem value="age_6_to_12">Ages 6-12: username and password</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Child username</Label>
                  <Input
                    value={childUsername}
                    onChange={(event) => setChildUsername(event.target.value)}
                    placeholder={account.has_account ? "kid-username" : "Create a child account first"}
                    disabled={!account.has_account}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Child reset email</Label>
                  <Input
                    type="email"
                    value={childEmail}
                    onChange={(event) => setChildEmail(event.target.value)}
                    placeholder="child@example.com"
                  />
                </div>

                <div className="rounded-[1.5rem] border border-border/70 bg-muted/30 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-slate-950">Child email reset</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Leave this off to keep password resets parent-mediated by default.
                      </p>
                    </div>
                    <Switch checked={resetViaChildEmail} onCheckedChange={setResetViaChildEmail} />
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  className="rounded-full"
                  onClick={() =>
                    void updateBusyState(() =>
                      updatePortalSettings(account.child_id, {
                        child_email: childEmail || null,
                        child_username: childUsername || null,
                        portal_mode: portalMode,
                        reset_via_child_email: resetViaChildEmail,
                      }),
                    )
                  }
                >
                  Save sign-in setup
                </Button>
                <p className="text-sm text-muted-foreground">
                  Current reset posture: {canSelfReset ? "child-owned email reset" : "parent-mediated reset"}.
                </p>
              </div>
            </section>

            <ChildAccessSettingsCard
              allowedSignInMode={account.device_access.allowed_sign_in_mode}
              childEmailResetEnabled={canSelfReset}
              childName={account.child_name}
              hasAccount={account.has_account}
              loginEnabled={account.login_enabled}
              onQuickUnlockEnabledChange={setQuickUnlockEnabled}
              onSave={() =>
                void updateBusyState(() =>
                  updateDeviceAccessSettings(account.child_id, {
                    allowed_sign_in_mode: account.device_access.allowed_sign_in_mode,
                    quick_unlock_enabled: quickUnlockEnabled,
                  }),
                )
              }
              quickUnlockEnabled={quickUnlockEnabled}
              showInstallOptions={false}
            />

            <ChildRestrictionsCard
              allowedGameSlugs={allowedGameSlugs}
              communicationEnabled={communicationEnabled}
              gamesEnabled={gamesEnabled}
              multiplayerEnabled={multiplayerEnabled}
              onAllowedGameToggle={toggleAllowedGame}
              onCommunicationEnabledChange={setCommunicationEnabled}
              onGamesEnabledChange={setGamesEnabled}
              onMultiplayerEnabledChange={setMultiplayerEnabled}
              onSave={() =>
                void updateBusyState(() =>
                  updateDeviceAccessSettings(account.child_id, {
                    allowed_game_slugs: allowedGameSlugs,
                    allowed_sign_in_mode: account.device_access.allowed_sign_in_mode,
                    communication_enabled: communicationEnabled,
                    games_enabled: gamesEnabled,
                    multiplayer_enabled: multiplayerEnabled,
                    quick_unlock_enabled: quickUnlockEnabled,
                    screen_time_daily_minutes:
                      screenTimeDailyMinutes.trim() === "" ? null : Number(screenTimeDailyMinutes),
                    screen_time_enabled: screenTimeEnabled,
                  }),
                )
              }
              onScreenTimeDailyMinutesChange={setScreenTimeDailyMinutes}
              onScreenTimeEnabledChange={setScreenTimeEnabled}
              screenTimeDailyMinutes={screenTimeDailyMinutes}
              screenTimeEnabled={screenTimeEnabled}
            />

            <section className="rounded-[2rem] border border-border/70 bg-card/90 p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-sky-100 p-3 text-sky-700">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Step 4
                  </p>
                  <h2 className="text-2xl font-display font-semibold text-slate-950">
                    Install and test launch
                  </h2>
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                Open the dedicated child-mode path on the device, install it if the browser allows
                it, then return through the child sign-in flow. This stays in the same app and does
                not create a second repo or trust boundary.
              </p>

              <div className="mt-5">
                <ChildModeInstallCard
                  allowSignIn={signInReady}
                  childName={account.child_name}
                  defaultInstructionsOpen
                  openPathHref={CHILD_APP_INSTALL_INTENT_PATH}
                  quickUnlockEnabled={quickUnlockEnabled}
                  signInHref={getChildAppLoginPath()}
                  title="Install or preview child mode"
                />
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <div className="rounded-[2rem] border border-border/70 bg-card/90 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Setup checklist
              </p>
              <h2 className="mt-1 text-2xl font-display font-semibold text-slate-950">
                What this device will allow
              </h2>

              <div className="mt-5 space-y-3">
                <SetupStatusCard
                  title={signInReady ? "Credentials ready" : "Credentials still blocked"}
                  description={
                    signInReady
                      ? `${account.child_name} can use direct child sign-in.`
                      : "Create the child account and enable child sign-in before handing over the device."
                  }
                  tone={signInReady ? "positive" : "warning"}
                />
                <SetupStatusCard
                  title={quickUnlockEnabled ? "Quick unlock on" : "Quick unlock off"}
                  description="Quick unlock stays device-side only and never replaces server authorization."
                  tone={quickUnlockEnabled ? "positive" : "muted"}
                />
                <SetupStatusCard
                  title={screenTimeEnabled ? "Screen time foundation on" : "Screen time still open"}
                  description={
                    screenTimeEnabled && screenTimeDailyMinutes
                      ? `${screenTimeDailyMinutes} minutes stored for later enforcement.`
                      : "Store a daily limit now if this device will be used independently."
                  }
                  tone={screenTimeEnabled ? "positive" : "muted"}
                />
                <SetupStatusCard
                  title={communicationEnabled ? "Communication allowed" : "Communication blocked"}
                  description="Detailed call and message permissions still apply under this master switch."
                  tone={communicationEnabled ? "positive" : "warning"}
                />
                <SetupStatusCard
                  title={gamesEnabled ? "Games available" : "Games blocked"}
                  description={gamesEnabled ? allowedGamesSummary : "No child-safe games will appear."}
                  tone={gamesEnabled ? "positive" : "warning"}
                />
                <SetupStatusCard
                  title={multiplayerEnabled ? "Family lobbies allowed" : "Family lobbies blocked"}
                  description="Shared family game sessions only appear when multiplayer is enabled for the child."
                  tone={multiplayerEnabled ? "positive" : "muted"}
                />
              </div>
            </div>

            <div className="rounded-[2rem] border border-border/70 bg-card/90 p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <KeyRound className="h-4 w-4" />
                Sign-in posture
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {portalMode === "under_6"
                  ? "This child still enters through the parent approval portal first."
                  : "This child uses credentials first, then can return through the dedicated child-mode path on later sessions."}
              </p>

              <Separator className="my-4" />

              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Clock3 className="h-4 w-4" />
                Restriction reminder
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                If quick unlock is enabled, pair it with screen-time expectations. Device-side speed
                should not become unrestricted child access.
              </p>

              <Separator className="my-4" />

              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <MessageSquareMore className="h-4 w-4" />
                Communication lane
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Turning communication off here removes child-facing message and call entry points,
                while the more detailed permission tables stay ready underneath.
              </p>

              <Separator className="my-4" />

              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Shield className="h-4 w-4" />
                Server truth
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Family scope is required for every save. Missing or ambiguous family scope still
                fails closed instead of guessing across families.
              </p>
            </div>
          </aside>
        </div>

        {isSaving ? (
          <div className="fixed bottom-6 right-6 inline-flex items-center rounded-full bg-slate-950 px-4 py-3 text-sm font-medium text-white shadow-lg">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving child setup...
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
