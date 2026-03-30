import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { PasskeyVerify } from "@/components/auth/PasskeyVerify";
import { TwoFactorVerify } from "@/components/auth/TwoFactorVerify";
import { getPasskeySupportState } from "@/lib/authCapabilities";

export type SupportedMfaMethod = "totp" | "webauthn";

export interface VerifiedMfaFactor {
  id: string;
  type: SupportedMfaMethod;
  friendlyName?: string | null;
}

interface AuthMfaChallengeProps {
  primaryFactor: VerifiedMfaFactor;
  secondaryFactor?: VerifiedMfaFactor | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export const AuthMfaChallenge = ({
  primaryFactor,
  secondaryFactor,
  onSuccess,
  onCancel,
}: AuthMfaChallengeProps) => {
  const [selectedFactorId, setSelectedFactorId] = useState(primaryFactor.id);
  const passkeySupportState = getPasskeySupportState();
  const passkeysAvailable = passkeySupportState.canUsePasskeys;

  const selectedFactor = useMemo(() => {
    if (secondaryFactor?.id === selectedFactorId) {
      return secondaryFactor;
    }

    return primaryFactor;
  }, [primaryFactor, secondaryFactor, selectedFactorId]);

  const alternateFactor = useMemo(() => {
    if (!secondaryFactor) {
      return null;
    }

    const candidate = secondaryFactor.id === selectedFactor.id ? primaryFactor : secondaryFactor;
    if (candidate.type === "webauthn" && !passkeysAvailable) {
      return null;
    }

    return candidate;
  }, [passkeysAvailable, primaryFactor, secondaryFactor, selectedFactor]);

  useEffect(() => {
    if (
      selectedFactor.type === "webauthn" &&
      !passkeysAvailable &&
      alternateFactor?.type === "totp"
    ) {
      setSelectedFactorId(alternateFactor.id);
    }
  }, [alternateFactor, passkeysAvailable, selectedFactor]);

  if (selectedFactor.type === "webauthn" && !passkeysAvailable) {
    return (
      <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <div className="space-y-1">
          <h2 className="font-semibold">Passkey verification unavailable</h2>
          <p className="text-sm text-muted-foreground">
            Passkey sign-in is not enabled for this project right now. Use a supported
            authenticator method instead or return to login.
          </p>
        </div>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Return to login
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {selectedFactor.type === "webauthn" ? (
        <PasskeyVerify factorId={selectedFactor.id} onSuccess={onSuccess} onCancel={onCancel} />
      ) : (
        <TwoFactorVerify factorId={selectedFactor.id} onSuccess={onSuccess} onCancel={onCancel} />
      )}

      {alternateFactor ? (
        <div className="text-center">
          <Button
            type="button"
            variant="link"
            onClick={() => setSelectedFactorId(alternateFactor.id)}
          >
            Use {alternateFactor.type === "webauthn" ? "a passkey" : "an authenticator code"} instead
          </Button>
        </div>
      ) : null}
    </div>
  );
};
