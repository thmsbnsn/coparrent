import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowRight, Briefcase, Scale } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";

const LawOfficeSignup = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    firmName: "",
  });

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard");
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
          account_type: "lawoffice",
          firm_name: formData.firmName,
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
      description: "Welcome to the Law Office Portal.",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Form */}
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-8 py-12 bg-background">
        <div className="mx-auto w-full max-w-sm">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Link to="/" className="inline-block mb-8">
              <Logo size="lg" />
            </Link>

            <div className="flex items-center gap-2 mb-6">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Scale className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                Law Office Portal
              </span>
            </div>

            <h1 className="text-2xl font-display font-bold mb-2">Create Law Office Account</h1>
            <p className="text-muted-foreground mb-8">
              Access client family data and court-ready documentation
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="fullName">Your Name</Label>
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
                <Label htmlFor="firmName">Firm Name</Label>
                <Input
                  id="firmName"
                  type="text"
                  placeholder="Your law firm's name"
                  value={formData.firmName}
                  onChange={(e) => setFormData({ ...formData, firmName: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@lawfirm.com"
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
                    minLength={8}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <PasswordStrengthIndicator password={formData.password} className="mt-3" />
              </div>

              <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700" disabled={isLoading}>
                {isLoading ? "Creating account..." : "Create Law Office Account"}
                {!isLoading && <ArrowRight className="ml-2 w-4 h-4" />}
              </Button>
            </form>

            <p className="mt-6 text-xs text-center text-muted-foreground">
              By creating an account, you agree to our{" "}
              <Link to="/terms" className="text-amber-600 hover:underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link to="/privacy" className="text-amber-600 hover:underline">
                Privacy Policy
              </Link>
            </p>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/law-office/login" className="text-amber-600 hover:underline font-medium">
                Sign in
              </Link>
            </p>

            <p className="mt-4 text-center text-sm text-muted-foreground">
              Looking for the family portal?{" "}
              <Link to="/signup" className="text-primary hover:underline font-medium">
                Parent signup
              </Link>
            </p>
          </motion.div>
        </div>
      </div>

      {/* Right Panel - Decorative (Law Office themed) */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-amber-600 via-amber-700 to-amber-800 items-center justify-center p-12">
        <div className="max-w-md text-center text-white">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-6"
          >
            <Briefcase className="w-16 h-16 mx-auto mb-4 opacity-90" />
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-3xl font-display font-bold mb-4"
          >
            Professional Family Law Tools
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-white/80"
          >
            Access court-ready documentation, client family data, and custody 
            arrangement tracking designed for legal professionals.
          </motion.p>
        </div>
      </div>
    </div>
  );
};

export default LawOfficeSignup;
