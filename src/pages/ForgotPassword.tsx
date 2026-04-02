import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail, Loader2, CheckCircle } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getPasswordResetRedirectUrl, resolveAuthBaseUrl } from "@/lib/authRedirects";

const ForgotPassword = () => {
  const { toast } = useToast();
  const [identifier, setIdentifier] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [parentManagedMessage, setParentManagedMessage] = useState<string | null>(null);
  const resetHost = new URL(resolveAuthBaseUrl()).host;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!identifier.trim()) {
      toast({
        title: "Identifier required",
        description: "Enter an email address or child username.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setParentManagedMessage(null);

    try {
      let resetEmail = identifier.trim();

      if (!resetEmail.includes("@")) {
        const { data, error } = await supabase.rpc("resolve_child_password_reset_target", {
          p_identifier: resetEmail,
        });

        if (error) {
          throw error;
        }

        const resetTarget = data as {
          email?: string;
          message?: string;
          mode?: "parent_managed" | "self_service_email";
        } | null;

        if (resetTarget?.mode === "parent_managed") {
          setParentManagedMessage(
            resetTarget.message ??
              "A parent or guardian needs to reset this child password from the family settings screen.",
          );
          setIsLoading(false);
          return;
        }

        resetEmail = resetTarget?.email?.trim() || "";
      } else {
        const { data, error } = await supabase.rpc("resolve_child_password_reset_target", {
          p_identifier: resetEmail,
        });

        if (!error && (data as { mode?: string; email?: string; message?: string } | null)?.mode === "parent_managed") {
          setParentManagedMessage(
            (data as { message?: string } | null)?.message ??
              "A parent or guardian needs to reset this child password from the family settings screen.",
          );
          setIsLoading(false);
          return;
        }
      }

      if (!resetEmail) {
        throw new Error("Password reset email is unavailable.");
      }

      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: getPasswordResetRedirectUrl(),
      });

      if (error) {
        throw error;
      }

      setEmailSent(true);
      toast({
        title: "Check your email",
        description: "We've sent you a password reset link.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Unable to start password reset.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <Link to="/" className="inline-block mb-8">
          <Logo size="lg" />
        </Link>

        {emailSent ? (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold mb-2">Check your email</h1>
              <p className="text-muted-foreground">
                We've sent a password reset link to <strong>{identifier}</strong>
              </p>
            </div>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Didn't receive the email? Check your spam folder or try again.
              </p>
              <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-left text-sm text-muted-foreground">
                The reset button should bring you back to <strong>{resetHost}</strong>. Some
                inboxes scan or rewrite links before redirecting you there, so a security-check
                hostname can appear first even when the final destination is correct.
              </div>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setEmailSent(false)}
              >
                Try again
              </Button>
              <Link to="/login">
                <Button variant="ghost" className="w-full">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to login
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-display font-bold mb-2">Forgot password?</h1>
            <p className="text-muted-foreground mb-8">
              Enter an email or child username and we&apos;ll tell you the right reset path
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="identifier">Email or child username</Label>
                <Input
                  id="identifier"
                  type="text"
                  placeholder="you@example.com or kid-username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoComplete="email"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                />
              </div>

              {parentManagedMessage ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {parentManagedMessage}
                </div>
              ) : null}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Mail className="w-4 h-4 mr-2" />
                )}
                {isLoading ? "Sending..." : "Send reset link"}
              </Button>
            </form>

            <Link to="/login">
              <Button variant="ghost" className="w-full mt-4">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to login
              </Button>
            </Link>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default ForgotPassword;
