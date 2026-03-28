import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { PasskeyVerify } from "@/components/auth/PasskeyVerify";
import { TwoFactorVerify } from "@/components/auth/TwoFactorVerify";
import { isBrowserPasskeySupported } from "@/lib/authCapabilities";

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
  const browserSupportsPasskeys = isBrowserPasskeySupported();

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

    return secondaryFactor.id === selectedFactor.id ? primaryFactor : secondaryFactor;
  }, [primaryFactor, secondaryFactor, selectedFactor]);

  useEffect(() => {
    if (
      selectedFactor.type === "webauthn" &&
      !browserSupportsPasskeys &&
      alternateFactor?.type === "totp"
    ) {
      setSelectedFactorId(alternateFactor.id);
    }
  }, [alternateFactor, browserSupportsPasskeys, selectedFactor]);

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
