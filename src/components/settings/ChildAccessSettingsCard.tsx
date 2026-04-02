import { KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ChildPwaInstallOptions } from "@/components/settings/ChildPwaInstallOptions";
import type { ChildAllowedSignInMode } from "@/lib/childAccess";

interface ChildAccessSettingsCardProps {
  allowedSignInMode: ChildAllowedSignInMode;
  childEmailResetEnabled: boolean;
  childName: string;
  hasAccount: boolean;
  loginEnabled: boolean;
  onQuickUnlockEnabledChange: (value: boolean) => void;
  onSave: () => void;
  quickUnlockEnabled: boolean;
  showInstallOptions?: boolean;
}

export const ChildAccessSettingsCard = ({
  allowedSignInMode,
  childEmailResetEnabled,
  childName,
  hasAccount,
  loginEnabled,
  onQuickUnlockEnabledChange,
  onSave,
  quickUnlockEnabled,
  showInstallOptions = true,
}: ChildAccessSettingsCardProps) => (
  <section className="space-y-4 rounded-[1.75rem] border bg-muted/20 p-5">
    <div className="flex items-center gap-2">
      <LockKeyhole className="h-4 w-4 text-muted-foreground" />
      <h4 className="text-sm font-medium text-muted-foreground">Child device access</h4>
    </div>

    <div className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-2xl border bg-background p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <KeyRound className="h-4 w-4" />
          Sign-in mode
        </div>
        <p className="mt-3 text-base font-semibold text-slate-950">
          {allowedSignInMode === "standard_sign_in" ? "Standard sign-in" : "Standard sign-in"}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Child devices still require normal credentials first. Quick unlock never replaces
          server-side authorization.
        </p>
      </div>

      <div className="rounded-2xl border bg-background p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <ShieldCheck className="h-4 w-4" />
          Password reset
        </div>
        <p className="mt-3 text-base font-semibold text-slate-950">
          {childEmailResetEnabled ? "Child email reset enabled" : "Parent-mediated reset"}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Change reset ownership in the portal settings above when the child has a real email path.
        </p>
      </div>

      <div className="rounded-2xl border bg-background p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-700">Quick unlock</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Parent-controlled repeat access for the child device using the device PIN or
              biometrics later.
            </p>
          </div>
          <Switch checked={quickUnlockEnabled} onCheckedChange={onQuickUnlockEnabledChange} />
        </div>
        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          Enabling quick unlock can make repeat entry faster on that device. It should be paired
          with screen-time limits when the child has regular independent access.
        </p>
      </div>
    </div>

    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" className="rounded-full" onClick={onSave}>
        Save device access
      </Button>
      <p className="text-sm text-muted-foreground">
        Current child login: {hasAccount && loginEnabled ? `${childName} can sign in directly.` : "Not ready yet."}
      </p>
    </div>

    {showInstallOptions ? (
      <ChildPwaInstallOptions childName={childName} hasAccount={hasAccount} loginEnabled={loginEnabled} />
    ) : null}
  </section>
);
