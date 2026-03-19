import { useState, useEffect, useCallback } from "react";
import { Shield, ShieldCheck, ShieldX, Loader2, Copy, Check, AlertTriangle } from "lucide-react";
import { ERROR_MESSAGES, sanitizeErrorForUser } from "@/lib/errorMessages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface TwoFactorSetupProps {
  className?: string;
  onStatusChange?: (isEnabled: boolean) => void;
}

export const TwoFactorSetup = ({ className, onStatusChange }: TwoFactorSetupProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [unenrolling, setUnenrolling] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [qrCode, setQrCode] = useState<string>("");
  const [secret, setSecret] = useState<string>("");
  const [verificationCode, setVerificationCode] = useState("");
  const [copied, setCopied] = useState(false);

  const checkMFAStatus = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;

      const totpFactor = data.totp.find((f) => f.status === "verified");
      if (totpFactor) {
        setIsEnabled(true);
        setFactorId(totpFactor.id);
        onStatusChange?.(true);
      } else {
        setIsEnabled(false);
        setFactorId(null);
        onStatusChange?.(false);
      }
    } catch (error: unknown) {
      console.error("Error checking MFA status:", error);
    } finally {
      setLoading(false);
    }
  }, [onStatusChange]);

  useEffect(() => {
    void checkMFAStatus();
  }, [checkMFAStatus]);

  const handleEnroll = async () => {
    setEnrolling(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        issuer: "CoParrent",
        friendlyName: "CoParrent Authenticator",
      });

      if (error) throw error;

      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setFactorId(data.id);
      setShowEnrollDialog(true);
    } catch (error: unknown) {
      toast({
        title: "Failed to start 2FA setup",
        description: sanitizeErrorForUser(error),
        variant: "destructive",
      });
    } finally {
      setEnrolling(false);
    }
  };

  const handleVerifyEnrollment = async () => {
    if (verificationCode.length !== 6) {
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
        factorId: factorId!,
      });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: factorId!,
        challengeId: challengeData.id,
        code: verificationCode,
      });

      if (verifyError) throw verifyError;

      setIsEnabled(true);
      setShowEnrollDialog(false);
      setVerificationCode("");
      onStatusChange?.(true);
      
      toast({
        title: "2FA enabled!",
        description: "Your account is now protected with two-factor authentication.",
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : "";
      toast({
        title: "Verification failed",
        description: errMsg.includes("Invalid") 
          ? "The code you entered is incorrect. Please try again."
          : sanitizeErrorForUser(error),
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleDisable = async () => {
    if (!factorId) return;

    setUnenrolling(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;

      setIsEnabled(false);
      setFactorId(null);
      setShowDisableDialog(false);
      onStatusChange?.(false);
      
      toast({
        title: "2FA disabled",
        description: "Two-factor authentication has been removed from your account.",
      });
    } catch (error: unknown) {
      toast({
        title: "Failed to disable 2FA",
        description: sanitizeErrorForUser(error),
        variant: "destructive",
      });
    } finally {
      setUnenrolling(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className={`flex items-center gap-2 text-muted-foreground ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Checking 2FA status...</span>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isEnabled ? (
            <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-success" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <Shield className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
          <div>
            <p className="font-medium">Two-Factor Authentication</p>
            <p className="text-sm text-muted-foreground">
              {isEnabled 
                ? "Your account is protected with 2FA" 
                : "Add an extra layer of security to your account"}
            </p>
          </div>
        </div>
        
        {isEnabled ? (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowDisableDialog(true)}
          >
            Disable
          </Button>
        ) : (
          <Button 
            variant="default" 
            size="sm" 
            onClick={handleEnroll}
            disabled={enrolling}
          >
            {enrolling && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Enable 2FA
          </Button>
        )}
      </div>

      {/* Enrollment Dialog */}
      <Dialog open={showEnrollDialog} onOpenChange={setShowEnrollDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set up Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Scan the QR code with your authenticator app (like Google Authenticator, Authy, or 1Password)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* QR Code */}
            <div className="flex justify-center">
              <div className="bg-white p-4 rounded-lg">
                <img src={qrCode} alt="2FA QR Code" className="w-48 h-48" />
              </div>
            </div>

            {/* Manual Entry */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground text-center">
                Can't scan? Enter this code manually:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono break-all">
                  {secret}
                </code>
                <Button variant="outline" size="icon" onClick={copySecret}>
                  {copied ? (
                    <Check className="w-4 h-4 text-success" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Verification Input */}
            <div className="space-y-2">
              <Label htmlFor="verificationCode">Enter the 6-digit code from your app</Label>
              <Input
                id="verificationCode"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                className="text-center text-2xl tracking-widest font-mono"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEnrollDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleVerifyEnrollment} 
              disabled={verifying || verificationCode.length !== 6}
            >
              {verifying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Verify & Enable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable Confirmation Dialog */}
      <AlertDialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Disable Two-Factor Authentication?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the extra layer of security from your account. 
              You can re-enable it at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDisable}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={unenrolling}
            >
              {unenrolling && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Disable 2FA
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
