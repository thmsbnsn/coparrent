import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SocialLoginButtons } from "@/components/auth/SocialLoginButtons";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";
import { logger } from "@/lib/logger";
import { safeErrorMessage } from "@/lib/safeText";
import { ensureCurrentUserFamilyMembership } from "@/lib/familyMembership";

const Signup = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading } = useAuth();
  const passwordRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
  });

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      // Check for pending invite token (check both session and local storage)
      const pendingToken = sessionStorage.getItem("pendingInviteToken") || localStorage.getItem("pendingInviteToken");
      if (pendingToken) {
        navigate(`/accept-invite?token=${pendingToken}`);
      } else {
        // Check if user has completed onboarding by checking if they have children
        const checkOnboarding = async () => {
          await ensureCurrentUserFamilyMembership(user.user_metadata?.full_name || user.email || null);

          const { data: profile } = await supabase
            .from("profiles")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();
          
          if (profile) {
            const { count } = await supabase
              .from("parent_children")
              .select("*", { count: "exact", head: true })
              .eq("parent_id", profile.id);
            
            if (count && count > 0) {
              navigate("/dashboard");
            } else {
              navigate("/onboarding");
            }
          } else {
            navigate("/onboarding");
          }
        };
        checkOnboarding();
      }
    }
  }, [user, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: formData.fullName,
          account_type: "parent",
        },
      },
    });

    setIsLoading(false);

    if (error) {
      logger.warn("Signup failed", { email: formData.email });
      // Clear password on error
      setFormData(prev => ({ ...prev, password: "" }));
      if (passwordRef.current) passwordRef.current.value = "";
      
      let errorMessage = safeErrorMessage(error, "Account creation failed. Please try again.");
      if (error.message?.includes("already registered")) {
        errorMessage = "An account with this email already exists. Please sign in instead.";
      }
      toast({
        title: "Sign up failed",
        description: errorMessage,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Account created!",
      description: "Let's set up your profile.",
    });
    
    // Navigation will be handled by the useEffect that watches the user state
    // This ensures the user is fully authenticated before redirecting
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
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Link to="/" className="inline-block mb-8">
              <Logo size="lg" />
            </Link>

            <h1 className="text-2xl font-display font-bold mb-2">Create your account</h1>
            <p className="text-muted-foreground mb-8">
              Start organizing your co-parenting journey
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Enter your full name"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <PasswordInput
                  id="password"
                  ref={passwordRef}
                  placeholder="Create a password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
                <PasswordStrengthIndicator password={formData.password} className="mt-3" />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Creating account..." : "Create account"}
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

            <p className="mt-6 text-xs text-center text-muted-foreground">
              By creating an account, you agree to our{" "}
              <Link to="/terms" className="text-primary hover:underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link to="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
            </p>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="text-primary hover:underline font-medium">
                Sign in
              </Link>
            </p>

          </motion.div>
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
            Join thousands of families
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-primary-foreground/80"
          >
            CoParrent is built for families who want clear records,
            less friction, and tools that keep children first.
          </motion.p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
