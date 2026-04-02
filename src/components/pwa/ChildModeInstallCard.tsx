import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  KeyRound,
  Shield,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppInstallState } from "@/hooks/useAppInstallState";
import {
  CHILD_APP_INSTALL_PATH,
  CHILD_APP_MODE_FOUNDATION,
} from "@/lib/childAccess";
import { cn } from "@/lib/utils";

interface ChildModeInstallCardProps {
  allowSignIn: boolean;
  childName?: string | null;
  className?: string;
  defaultInstructionsOpen?: boolean;
  openPathHref?: string | null;
  quickUnlockEnabled?: boolean;
  signInHref?: string | null;
  title?: string;
}

export const ChildModeInstallCard = ({
  allowSignIn,
  childName,
  className,
  defaultInstructionsOpen = false,
  openPathHref = CHILD_APP_INSTALL_PATH,
  quickUnlockEnabled = false,
  signInHref,
  title = "Install child mode on this device",
}: ChildModeInstallCardProps) => {
  const { canPromptInstall, installState, promptInstall } = useAppInstallState();
  const [showInstructions, setShowInstructions] = useState(defaultInstructionsOpen);

  useEffect(() => {
    setShowInstructions(defaultInstructionsOpen || installState === "ios_manual");
  }, [defaultInstructionsOpen, installState]);

  const statusLabel =
    installState === "installed"
      ? "Installed"
      : installState === "promptable"
        ? "Ready to install"
        : installState === "ios_manual"
          ? "Manual iPhone install"
          : "Manual browser install";

  const statusTone =
    installState === "installed"
      ? "bg-emerald-100 text-emerald-700"
      : installState === "promptable"
        ? "bg-sky-100 text-sky-700"
        : "bg-amber-100 text-amber-700";

  return (
    <section className={cn("rounded-[2rem] border border-border bg-white/90 p-5 shadow-sm", className)}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-sky-100 p-3 text-sky-700">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {CHILD_APP_MODE_FOUNDATION.displayName}
              </p>
              <h3 className="text-2xl font-display font-semibold text-slate-950">{title}</h3>
            </div>
          </div>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground">
            This device can use the dedicated child start path at{" "}
            <span className="font-mono">{CHILD_APP_MODE_FOUNDATION.startUrl}</span>. It stays in
            the same CoParrent repo, but it gives parents a cleaner install and launch flow for
            future child PWA polish.
          </p>
        </div>

        <div className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold", statusTone)}>
          {statusLabel}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {installState === "installed" ? (
          <Button type="button" className="rounded-full bg-emerald-600 text-white hover:bg-emerald-500" disabled>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Installed on this device
          </Button>
        ) : canPromptInstall ? (
          <Button
            type="button"
            className="rounded-full bg-sky-600 text-white hover:bg-sky-500"
            onClick={() => {
              void promptInstall();
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            Install child mode
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="rounded-full bg-white"
            onClick={() => setShowInstructions((current) => !current)}
          >
            <Shield className="mr-2 h-4 w-4" />
            {installState === "ios_manual" ? "Show iPhone / iPad steps" : "Show browser install steps"}
          </Button>
        )}

        {openPathHref ? (
          <Button asChild type="button" variant="outline" className="rounded-full bg-white">
            <Link to={openPathHref}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Open child mode path
            </Link>
          </Button>
        ) : null}

        {signInHref && allowSignIn ? (
          <Button asChild type="button" variant="outline" className="rounded-full bg-white">
            <Link to={signInHref}>
              <KeyRound className="mr-2 h-4 w-4" />
              Continue to child sign-in
            </Link>
          </Button>
        ) : null}
      </div>

      {!allowSignIn ? (
        <div className="mt-4 rounded-[1.5rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Finish the child account setup first. The dedicated install path is ready, but a child
          still needs enabled credentials before this device can sign in directly.
        </div>
      ) : null}

      {showInstructions && installState !== "installed" ? (
        <div className="mt-5 grid gap-4 rounded-[1.75rem] border border-border/70 bg-slate-50 p-4 lg:grid-cols-3">
          {installState === "ios_manual" ? (
            <>
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Step 1</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Open <span className="font-mono">{CHILD_APP_INSTALL_PATH}</span> in Safari on the
                  child device.
                </p>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Step 2</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Use Safari&apos;s Share menu, then choose <span className="font-medium">Add to Home Screen</span>.
                </p>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Step 3</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Launch the installed icon and sign in with the child account once the parent setup
                  is complete.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Step 1</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Open the child mode path on the device the child will use.
                </p>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Step 2</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Use the browser&apos;s install or app menu to add it to the home screen if no install
                  prompt appears automatically.
                </p>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Step 3</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Sign in as {childName ?? "the child"} and keep quick unlock subject to the family
                  restrictions already configured.
                </p>
              </div>
            </>
          )}
        </div>
      ) : null}

      <div className="mt-4 rounded-[1.5rem] bg-slate-100 px-4 py-4 text-sm leading-6 text-slate-700">
        {quickUnlockEnabled ? (
          <>
            Quick unlock is enabled for {childName ?? "this child"} on the device profile. It still
            speeds up repeat entry only after a normal sign-in and never overrides server-side
            family restrictions.
          </>
        ) : (
          <>
            Quick unlock stays parent-controlled and off by default. Turn it on only when the child
            has a predictable device and matching screen-time expectations.
          </>
        )}
      </div>
    </section>
  );
};
