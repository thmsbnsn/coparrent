import { useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeErrorForUser } from "@/lib/errorMessages";

interface TwoFactorVerifyProps {
  factorId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export const TwoFactorVerify = ({ factorId, onSuccess, onCancel }: TwoFactorVerifyProps) => {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    if (code.length !== 6) {
      toast({
        title: "Invalid code",
        description: "Please enter a 6-digit verification code.",
        variant: "destructive",
      });
      return;
    }

    setVerifying(true);
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      });

      if (verifyError) throw verifyError;

      toast({
        title: "Verification successful",
        description: "You've been signed in securely.",
      });

      onSuccess();
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : "";
      toast({
        title: "Verification failed",
        description: errMsg.includes("Invalid")
          ? "The code you entered is incorrect. Please try again."
          : sanitizeErrorForUser(error),
        variant: "destructive",
      });
      setCode("");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <ShieldCheck className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-display font-bold">Two-Factor Authentication</h2>
          <p className="text-muted-foreground mt-1">
            Enter the 6-digit code from your authenticator app
          </p>
        </div>
      </div>

      <form onSubmit={handleVerify} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="mfaCode" className="sr-only">Verification Code</Label>
          <Input
            id="mfaCode"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="text-center text-3xl tracking-[0.5em] font-mono h-14"
            autoFocus
            autoComplete="one-time-code"
          />
        </div>

        <div className="space-y-3">
          <Button 
            type="submit" 
            className="w-full" 
            disabled={verifying || code.length !== 6}
          >
            {verifying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {verifying ? "Verifying..." : "Verify"}
          </Button>
          
          <Button 
            type="button" 
            variant="ghost" 
            className="w-full" 
            onClick={onCancel}
          >
            Use a different account
          </Button>
        </div>
      </form>

      <p className="text-xs text-center text-muted-foreground">
        Open your authenticator app to view your verification code.
        If you've lost access, contact support for account recovery.
      </p>
    </motion.div>
  );
};
