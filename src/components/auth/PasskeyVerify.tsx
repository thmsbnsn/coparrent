import { useState } from "react";
import { Fingerprint, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getPasskeySupportState } from "@/lib/authCapabilities";
import { sanitizeErrorForUser } from "@/lib/errorMessages";

interface PasskeyVerifyProps {
  factorId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export const PasskeyVerify = ({
  factorId,
  onSuccess,
  onCancel,
}: PasskeyVerifyProps) => {
  const { toast } = useToast();
  const [authenticating, setAuthenticating] = useState(false);
  const passkeySupportState = getPasskeySupportState();
  const passkeysAvailable = passkeySupportState.canUsePasskeys;

  const handleAuthenticate = async () => {
    if (!passkeysAvailable) {
      toast({
        title: "Passkeys unavailable",
        description: passkeySupportState.projectEnrollmentEnabled
          ? "This browser or page does not support passkeys."
          : "Passkeys are not enabled for this project right now.",
        variant: "destructive",
      });
      return;
    }

    setAuthenticating(true);

    try {
      const { error } = await supabase.auth.mfa.webauthn.authenticate({
        factorId,
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Passkey verified",
        description: "Your sign-in has been confirmed.",
      });
      onSuccess();
    } catch (error: unknown) {
      const errorCode =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: string }).code)
          : null;

      toast({
        title: "Passkey verification failed",
        description:
          errorCode === "mfa_webauthn_verify_not_enabled"
            ? "Passkeys are not enabled in Supabase Auth for this project yet."
            : sanitizeErrorForUser(error),
        variant: "destructive",
      });
    } finally {
      setAuthenticating(false);
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
        <div className="space-y-1">
          <h2 className="font-semibold">Finish sign-in with your passkey</h2>
          <p className="text-sm text-muted-foreground">
            Use Face ID, Touch ID, Windows Hello, or your saved device credential to continue.
          </p>
        </div>
      </div>

      {!passkeysAvailable && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {passkeySupportState.projectEnrollmentEnabled
            ? "Passkeys are only available on supported secure browsers and devices."
            : "Passkeys are not enabled for this project right now."}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          onClick={handleAuthenticate}
          disabled={authenticating || !passkeysAvailable}
        >
          {authenticating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Fingerprint className="mr-2 h-4 w-4" />
          )}
          {authenticating ? "Waiting for passkey..." : "Use passkey"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={authenticating}>
          Cancel
        </Button>
      </div>
    </div>
  );
};
