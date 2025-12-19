import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, ArrowRight, Users, Briefcase } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

type AccountType = "parent" | "lawoffice";

const Signup = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { user, loading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [accountType, setAccountType] = useState<AccountType>(
    searchParams.get("type") === "lawoffice" ? "lawoffice" : "parent"
  );
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    firmName: "",
  });

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      // Check for pending invite token
      const pendingToken = localStorage.getItem("pendingInviteToken");
      if (pendingToken) {
        navigate(`/accept-invite?token=${pendingToken}`);
      } else {
        navigate("/dashboard");
      }
    }
  }, [user, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters.",
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
          account_type: accountType,
          firm_name: accountType === "lawoffice" ? formData.firmName : null,
        },
      },
    });

    setIsLoading(false);

    if (error) {
      let errorMessage = error.message;
      if (error.message.includes("already registered")) {
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
    
    // Check for pending invite token
    const pendingToken = localStorage.getItem("pendingInviteToken");
    if (pendingToken) {
      navigate(`/accept-invite?token=${pendingToken}`);
    } else {
      navigate("/onboarding");
    }
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

            {/* Account Type Selector */}
            <div className="grid grid-cols-2 gap-3 mb-8">
              <button
                type="button"
                onClick={() => setAccountType("parent")}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                  accountType === "parent"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                <Users className={cn("w-6 h-6", accountType === "parent" ? "text-primary" : "text-muted-foreground")} />
                <span className={cn("text-sm font-medium", accountType === "parent" ? "text-primary" : "text-muted-foreground")}>
                  I'm a Parent
                </span>
              </button>
              <button
                type="button"
                onClick={() => setAccountType("lawoffice")}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                  accountType === "lawoffice"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                <Briefcase className={cn("w-6 h-6", accountType === "lawoffice" ? "text-primary" : "text-muted-foreground")} />
                <span className={cn("text-sm font-medium", accountType === "lawoffice" ? "text-primary" : "text-muted-foreground")}>
                  Law Office
                </span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="fullName">
                  {accountType === "parent" ? "Full name" : "Your name"}
                </Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Enter your full name"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  required
                />
              </div>

              {accountType === "lawoffice" && (
                <div className="space-y-2">
                  <Label htmlFor="firmName">Firm name</Label>
                  <Input
                    id="firmName"
                    type="text"
                    placeholder="Your law firm's name"
                    value={formData.firmName}
                    onChange={(e) => setFormData({ ...formData, firmName: e.target.value })}
                    required
                  />
                </div>
              )}

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
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  At least 6 characters
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Creating account..." : "Create account"}
                {!isLoading && <ArrowRight className="ml-2 w-4 h-4" />}
              </Button>
            </form>

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
            ClearNest is trusted by co-parents and family law professionals 
            who believe in putting children first.
          </motion.p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
