import { useCallback, useEffect, useMemo, useState } from "react";
import { Fingerprint, KeyRound, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeErrorForUser } from "@/lib/errorMessages";
import { getPasskeySupportState } from "@/lib/authCapabilities";

type WebauthnFactor = {
  id: string;
  friendly_name: string | null;
  factor_type: "webauthn";
  status: "verified" | "unverified";
  created_at?: string;
};

const getBrowserPasskeyLabel = () => {
  if (typeof window === "undefined") {
    return "This device";
  }

  const ua = navigator.userAgent;

  if (/iPhone|iPad|iPod/i.test(ua)) {
    return "Apple device";
  }

  if (/Android/i.test(ua)) {
    return "Android device";
  }

  if (/Windows/i.test(ua)) {
    return "Windows device";
  }

  if (/Mac OS/i.test(ua)) {
    return "Mac device";
  }

  return "This device";
};

export const PasskeySetup = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [removingFactorId, setRemovingFactorId] = useState<string | null>(null);
  const [factors, setFactors] = useState<WebauthnFactor[]>([]);
  const [projectEnrollmentEnabled, setProjectEnrollmentEnabled] = useState(
    () => getPasskeySupportState().projectEnrollmentEnabled,
  );

  const browserSupportsPasskeys = useMemo(
    () => getPasskeySupportState().browserSupported,
    [],
  );

  const loadFactors = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) {
        throw error;
      }

      setFactors((data.webauthn || []) as WebauthnFactor[]);
    } catch (error) {
      console.error("Error loading passkeys:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFactors();
  }, [loadFactors]);

  const handleAddPasskey = async () => {
    setRegistering(true);

    try {
      const friendlyName = `CoParrent ${getBrowserPasskeyLabel()}`;
      const { error } = await supabase.auth.mfa.webauthn.register({
        friendlyName,
      });

      if (error) {
        throw error;
      }

      await loadFactors();
      toast({
        title: "Passkey added",
        description: "You can now use this device to verify sign-in.",
      });
    } catch (error: unknown) {
      const errorCode =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: string }).code)
          : null;

      toast({
        title: "Could not add passkey",
        description:
          errorCode === "mfa_webauthn_enroll_not_enabled"
            ? "Passkeys are not enabled in Supabase Auth for this project yet."
            : sanitizeErrorForUser(error),
        variant: "destructive",
      });
      if (errorCode === "mfa_webauthn_enroll_not_enabled") {
        setProjectEnrollmentEnabled(false);
      }
    } finally {
      setRegistering(false);
    }
  };

  const handleRemovePasskey = async (factorId: string) => {
    setRemovingFactorId(factorId);

    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) {
        throw error;
      }

      await loadFactors();
      toast({
        title: "Passkey removed",
        description: "That device will no longer be able to verify sign-in.",
      });
    } catch (error: unknown) {
      toast({
        title: "Could not remove passkey",
        description: sanitizeErrorForUser(error),
        variant: "destructive",
      });
    } finally {
      setRemovingFactorId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Checking passkeys...</span>
      </div>
    );
  }

  // Hide the passkey management block until the project has WebAuthn enabled.
  // If a user already has passkeys enrolled, keep the block visible so they can
  // review or remove them even if the feature is temporarily disabled later.
  if (!projectEnrollmentEnabled && factors.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">Passkeys</p>
            <p className="text-sm text-muted-foreground">
              Add Face ID, Touch ID, Windows Hello, or device biometrics to verify sign-in.
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddPasskey}
          disabled={registering || !browserSupportsPasskeys || !projectEnrollmentEnabled}
        >
          {registering ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Fingerprint className="mr-2 h-4 w-4" />
          )}
          {projectEnrollmentEnabled ? "Add passkey" : "Unavailable"}
        </Button>
      </div>

      {!browserSupportsPasskeys && (
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Passkeys require a secure supported browser. Open the deployed app over HTTPS to add one.
        </div>
      )}

      {!projectEnrollmentEnabled && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          Passkeys are wired into the app, but WebAuthn enrollment is not enabled for this Supabase
          project yet. Use the authenticator-app 2FA option for now.
        </div>
      )}

      {factors.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          {projectEnrollmentEnabled
            ? "No passkeys connected yet."
            : "No passkeys connected on this account yet."}
        </div>
      ) : (
        <div className="space-y-3">
          {factors.map((factor) => (
            <div
              key={factor.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
            >
              <div>
                <p className="font-medium">
                  {factor.friendly_name || "Saved passkey"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {factor.status === "verified" ? "Ready to use" : "Verification incomplete"}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemovePasskey(factor.id)}
                disabled={removingFactorId === factor.id}
              >
                {removingFactorId === factor.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                <span className="sr-only">Remove passkey</span>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
