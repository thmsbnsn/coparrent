import { ShieldAlert, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MotionPermissionState } from "@/lib/problem-report/deviceMotion";
import { cn } from "@/lib/utils";

interface MotionPermissionPromptProps {
  className?: string;
  enabled: boolean;
  likelyMobile: boolean;
  motionPermissionState: MotionPermissionState;
  onDisable: () => void;
  onDismiss?: () => void;
  onEnable: () => void | Promise<void>;
  permissionRequired: boolean;
  secure: boolean;
  supported: boolean;
}

export const MotionPermissionPrompt = ({
  className,
  enabled,
  likelyMobile,
  motionPermissionState,
  onDisable,
  onDismiss,
  onEnable,
  permissionRequired,
  secure,
  supported,
}: MotionPermissionPromptProps) => {
  if (!likelyMobile) {
    return null;
  }

  let title = "Enable shake to report issues";
  let description =
    "On supported mobile devices, you can shake your phone to open the report form faster.";
  let actionLabel = "Enable shake to report issues";
  let actionDisabled = false;
  let showDismiss = true;

  if (!secure) {
    title = "Shake reporting needs HTTPS";
    description =
      "Motion access only works in a secure context. Use the report button below until you are on the secure app URL or installed PWA.";
    actionLabel = "Unavailable here";
    actionDisabled = true;
    showDismiss = false;
  } else if (!supported) {
    title = "Shake reporting is unavailable on this device";
    description =
      "This browser does not expose motion events, so reporting stays available through the manual button instead.";
    actionLabel = "Unavailable here";
    actionDisabled = true;
    showDismiss = false;
  } else if (enabled) {
    title = "Shake reporting is on";
    description =
      "A firm shake will open the report form. You can turn it off here at any time.";
    actionLabel = "Turn off shake reporting";
    showDismiss = false;
  } else if (motionPermissionState === "denied") {
    title = "Motion access is blocked";
    description = permissionRequired
      ? "This device denied motion access. You can try again, or continue using the manual report button."
      : "This browser is blocking motion access right now. You can try again, or continue using the manual report button.";
    actionLabel = "Try again";
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-muted/40 p-4",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {motionPermissionState === "denied" ? (
            <ShieldAlert className="h-5 w-5" />
          ) : (
            <Smartphone className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-sm font-semibold">{title}</h3>
            {enabled && <Badge variant="secondary">Enabled</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {enabled ? (
              <Button type="button" variant="outline" size="sm" onClick={onDisable}>
                {actionLabel}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={() => void onEnable()}
                disabled={actionDisabled}
              >
                {actionLabel}
              </Button>
            )}
            {showDismiss && onDismiss && (
              <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
                Not now
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
