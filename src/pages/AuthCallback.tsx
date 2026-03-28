import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { resolvePostAuthPath } from "@/lib/postAuthPath";
import {
  AuthMfaChallenge,
  type VerifiedMfaFactor,
} from "@/components/auth/AuthMfaChallenge";

const getCallbackError = () => {
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));

  return (
    search.get("error_description") ||
    search.get("error") ||
    hash.get("error_description") ||
    hash.get("error")
  );
};

const pickVerifiedFactors = (data: {
  totp: Array<{ id: string; status: string; friendly_name?: string | null }>;
  webauthn: Array<{ id: string; status: string; friendly_name?: string | null }>;
}) => {
  const verifiedPasskey = data.webauthn.find((factor) => factor.status === "verified");
  const verifiedTotp = data.totp.find((factor) => factor.status === "verified");

  const primaryFactor: VerifiedMfaFactor | null = verifiedPasskey
    ? {
        id: verifiedPasskey.id,
        type: "webauthn",
        friendlyName: verifiedPasskey.friendly_name ?? null,
      }
    : verifiedTotp
      ? {
          id: verifiedTotp.id,
          type: "totp",
          friendlyName: verifiedTotp.friendly_name ?? null,
        }
      : null;

  const secondaryFactor: VerifiedMfaFactor | null =
    verifiedPasskey && verifiedTotp
      ? {
          id: verifiedTotp.id,
          type: "totp",
          friendlyName: verifiedTotp.friendly_name ?? null,
        }
      : null;

  return { primaryFactor, secondaryFactor };
};

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const callbackError = useMemo(
    () => (typeof window !== "undefined" ? getCallbackError() : null),
    [],
  );
  const [exchangeAttempted, setExchangeAttempted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(callbackError);
  const [mfaPrimaryFactor, setMfaPrimaryFactor] = useState<VerifiedMfaFactor | null>(null);
  const [mfaSecondaryFactor, setMfaSecondaryFactor] = useState<VerifiedMfaFactor | null>(null);

  useEffect(() => {
    if (loading || callbackError || user || exchangeAttempted) {
      return;
    }

    const code = searchParams.get("code");
    if (!code) {
      return;
    }

    setExchangeAttempted(true);

    void supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setErrorMessage(error.message);
      }
    });
  }, [callbackError, exchangeAttempted, loading, searchParams, user]);

  useEffect(() => {
    if (loading || errorMessage || !user) {
      return;
    }

    let active = true;

    void (async () => {
      const { data: aalData, error: aalError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalError) {
        throw aalError;
      }

      const { data: factorsData, error: factorsError } =
        await supabase.auth.mfa.listFactors();
      if (factorsError) {
        throw factorsError;
      }

      const { primaryFactor, secondaryFactor } = pickVerifiedFactors({
        totp: factorsData.totp || [],
        webauthn: factorsData.webauthn || [],
      });

      if (primaryFactor && aalData.currentLevel !== "aal2") {
        if (!active) {
          return;
        }

        setMfaPrimaryFactor(primaryFactor);
        setMfaSecondaryFactor(secondaryFactor);
        return;
      }

      const path = await resolvePostAuthPath(user);
      if (active) {
        navigate(path, { replace: true });
      }
    })().catch((error: unknown) => {
      if (!active) {
        return;
      }

      setErrorMessage(error instanceof Error ? error.message : "Sign-in could not be completed.");
    });

    return () => {
      active = false;
    };
  }, [errorMessage, loading, navigate, user]);

  const handleMfaSuccess = () => {
    setMfaPrimaryFactor(null);
    setMfaSecondaryFactor(null);
    toast({
      title: "Sign-in verified",
      description: "Taking you to your account.",
    });
  };

  const handleMfaCancel = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  if (errorMessage) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center">
          <Link to="/" className="inline-block mb-6">
            <Logo size="lg" />
          </Link>
          <h1 className="text-2xl font-display font-bold mb-2">Sign-in could not be completed</h1>
          <p className="text-muted-foreground mb-6">{errorMessage}</p>
          <div className="space-y-3">
            <Link to="/login">
              <Button className="w-full">Back to login</Button>
            </Link>
            <Link to="/">
              <Button variant="outline" className="w-full">
                Return home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (mfaPrimaryFactor) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <Link to="/" className="inline-block mb-6">
              <Logo size="lg" />
            </Link>
          </div>
          <AuthMfaChallenge
            primaryFactor={mfaPrimaryFactor}
            secondaryFactor={mfaSecondaryFactor}
            onSuccess={handleMfaSuccess}
            onCancel={handleMfaCancel}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <Link to="/" className="inline-block mb-8">
          <Logo size="lg" />
        </Link>

        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
          {user ? (
            <CheckCircle2 className="w-8 h-8 text-primary" />
          ) : (
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          )}
        </div>

        <h1 className="text-2xl font-display font-bold mb-2">Finishing sign-in</h1>
        <p className="text-muted-foreground">
          We&apos;re preparing your account and sending you to the right place.
        </p>
      </div>
    </div>
  );
};

export default AuthCallback;
