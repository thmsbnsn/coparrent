import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AuthCaptcha } from "@/components/auth/AuthCaptcha";
import { SocialLoginButtons } from "@/components/auth/SocialLoginButtons";
import {
  AuthMfaChallenge,
  type VerifiedMfaFactor,
} from "@/components/auth/AuthMfaChallenge";
import { getAuthCaptchaState } from "@/lib/authCapabilities";
import { logger } from "@/lib/logger";
import { safeErrorMessage } from "@/lib/safeText";
import { resolvePostAuthPath, stashPostAuthPathOverride } from "@/lib/postAuthPath";

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { user, loading } = useAuth();
  const passwordRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaRenderKey, setCaptchaRenderKey] = useState(0);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaPrimaryFactor, setMfaPrimaryFactor] = useState<VerifiedMfaFactor | null>(null);
  const [mfaSecondaryFactor, setMfaSecondaryFactor] = useState<VerifiedMfaFactor | null>(null);
  const captchaRequired = getAuthCaptchaState().required;
  const [rememberMe, setRememberMe] = useState(() => {
    return localStorage.getItem("rememberMe") === "true";
  });
  const [formData, setFormData] = useState(() => {
    const savedIdentifier = localStorage.getItem("rememberedLoginIdentifier");
    return {
      identifier: savedIdentifier || "",
      password: "",
    };
  });

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user && !mfaRequired) {
      let active = true;

      void (async () => {
        const path = await resolvePostAuthPath(user);
        if (active) {
          navigate(path);
        }
      })();

      return () => {
        active = false;
      };
    }
  }, [user, loading, navigate, mfaRequired]);

  useEffect(() => {
    stashPostAuthPathOverride(searchParams.get("next"));
  }, [searchParams]);

  const prepareMfaChallenge = (factorsData: {
    totp: Array<{ id: string; status: string; friendly_name?: string | null }>;
    webauthn: Array<{ id: string; status: string; friendly_name?: string | null }>;
  }) => {
    const verifiedPasskey = factorsData.webauthn.find((factor) => factor.status === "verified");
    const verifiedTotp = factorsData.totp.find((factor) => factor.status === "verified");

    if (!verifiedPasskey && !verifiedTotp) {
      return false;
    }

    const primaryFactor: VerifiedMfaFactor = verifiedPasskey
      ? {
          id: verifiedPasskey.id,
          type: "webauthn",
          friendlyName: verifiedPasskey.friendly_name ?? null,
        }
      : {
          id: verifiedTotp!.id,
          type: "totp",
          friendlyName: verifiedTotp!.friendly_name ?? null,
        };

    const secondaryFactor: VerifiedMfaFactor | null =
      verifiedPasskey && verifiedTotp
        ? {
            id: verifiedTotp.id,
            type: "totp",
            friendlyName: verifiedTotp.friendly_name ?? null,
          }
        : null;

    setMfaPrimaryFactor(primaryFactor);
    setMfaSecondaryFactor(secondaryFactor);
    setMfaRequired(true);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (captchaRequired && !captchaToken) {
      toast({
        title: "Captcha required",
        description: "Complete the captcha before signing in.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    let resolvedEmail = formData.identifier.trim();

    if (resolvedEmail && !resolvedEmail.includes("@")) {
      const { data: identifierData, error: identifierError } = await supabase.rpc(
        "resolve_child_login_identifier",
        {
          p_child_username: resolvedEmail,
        },
      );

      if (identifierError) {
        setIsLoading(false);
        toast({
          title: "Sign in failed",
          description: safeErrorMessage(identifierError, "That child username is not ready for sign in."),
          variant: "destructive",
        });
        return;
      }

      resolvedEmail = ((identifierData as { email?: string } | null)?.email ?? "").trim();

      if (!resolvedEmail) {
        setIsLoading(false);
        toast({
          title: "Sign in failed",
          description: "That child username is missing a login email.",
          variant: "destructive",
        });
        return;
      }
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: resolvedEmail,
      password: formData.password,
      options: captchaRequired ? { captchaToken } : undefined,
    });

    setIsLoading(false);

    if (error) {
      logger.warn("Login failed", { identifier: formData.identifier });
      // Clear password on error
      setFormData(prev => ({ ...prev, password: "" }));
      if (passwordRef.current) passwordRef.current.value = "";
      
      toast({
        title: "Sign in failed",
        description: safeErrorMessage(error, "Invalid email or password. Please try again."),
        variant: "destructive",
      });
      if (captchaRequired) {
        setCaptchaToken(null);
        setCaptchaRenderKey((current) => current + 1);
      }
      return;
    }

    // Check if MFA is required
    if (data.session) {
      const { data: factorsData } = await supabase.auth.mfa.listFactors();

      if (
        factorsData &&
        prepareMfaChallenge({
          totp: factorsData.totp || [],
          webauthn: factorsData.webauthn || [],
        })
      ) {
        return;
      }
    }

    // No MFA required, proceed with login
    completeLogin();
  };

  const completeLogin = () => {
    // Save "Remember me" preference
    if (rememberMe) {
      localStorage.setItem("rememberMe", "true");
      localStorage.setItem("rememberedLoginIdentifier", formData.identifier);
    } else {
      localStorage.removeItem("rememberMe");
      localStorage.removeItem("rememberedLoginIdentifier");
    }

    toast({
      title: "Welcome back!",
      description: "You've successfully signed in.",
    });
  };

  const handleMfaSuccess = () => {
    setMfaRequired(false);
    setMfaPrimaryFactor(null);
    setMfaSecondaryFactor(null);
    completeLogin();
  };

  const handleMfaCancel = async () => {
    await supabase.auth.signOut();
    setMfaRequired(false);
    setMfaPrimaryFactor(null);
    setMfaSecondaryFactor(null);
    setFormData({ ...formData, password: "" });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Panel - Form */}
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-8 py-12">
        <div className="mx-auto w-full max-w-sm">
          <Link to="/" className="inline-block mb-8">
            <Logo size="lg" />
          </Link>

          {mfaRequired && mfaPrimaryFactor ? (
            <AuthMfaChallenge
              primaryFactor={mfaPrimaryFactor}
              secondaryFactor={mfaSecondaryFactor}
              onSuccess={handleMfaSuccess}
              onCancel={handleMfaCancel}
            />
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h1 className="text-2xl font-display font-bold mb-2">Welcome back</h1>
              <p className="text-muted-foreground mb-8">
                Sign in to continue to your dashboard
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="identifier">Email or child username</Label>
                  <Input
                    id="identifier"
                    type="text"
                    placeholder="you@example.com or kid-username"
                    value={formData.identifier}
                    onChange={(e) => setFormData({ ...formData, identifier: e.target.value })}
                    autoComplete="username"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link
                      to="/forgot-password"
                      className="text-sm text-primary hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <PasswordInput
                    id="password"
                    ref={passwordRef}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    autoComplete="current-password"
                    required
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked === true)}
                  />
                  <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
                    Remember me
                  </Label>
                </div>

                {captchaRequired ? (
                  <AuthCaptcha
                    key={captchaRenderKey}
                    onTokenChange={setCaptchaToken}
                  />
                ) : null}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || (captchaRequired && !captchaToken)}
                >
                  {isLoading ? "Signing in..." : "Sign in"}
                  {!isLoading && <ArrowRight className="ml-2 w-4 h-4" />}
                </Button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>

              <SocialLoginButtons />

              <p className="mt-8 text-center text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link to="/signup" className="text-primary hover:underline font-medium">
                  Create one
                </Link>
              </p>
            </motion.div>
          )}
        </div>
      </div>

      {/* Right Panel - Decorative */}
      <div className="hidden lg:flex flex-1 bg-gradient-hero items-center justify-center p-12">
        <div className="max-w-md text-center text-primary-foreground">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-3xl font-display font-bold mb-4"
          >
            Your children deserve the best
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-primary-foreground/80"
          >
            CoParrent helps you focus on what matters most—giving your children 
            stability, love, and the support they need to thrive.
          </motion.p>
        </div>
      </div>
    </div>
  );
};

export default Login;
