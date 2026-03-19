import { useState, useEffect } from "react";
import { Key, Download, RefreshCw, Copy, Check, Loader2, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useRecoveryCodes } from "@/hooks/useRecoveryCodes";
import { Badge } from "@/components/ui/badge";

interface RecoveryCodesProps {
  isEnabled: boolean;
  className?: string;
}

export const RecoveryCodes = ({ isEnabled, className }: RecoveryCodesProps) => {
  const { toast } = useToast();
  const { loading, status, fetchStatus, generateCodes } = useRecoveryCodes();
  const [showCodesDialog, setShowCodesDialog] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [codes, setCodes] = useState<string[]>([]);
  const [codesVisible, setCodesVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (isEnabled) {
      fetchStatus();
    }
  }, [isEnabled, fetchStatus]);

  const handleGenerateCodes = async () => {
    setGenerating(true);
    try {
      const newCodes = await generateCodes();
      if (newCodes) {
        setCodes(newCodes);
        setCodesVisible(true);
        setShowCodesDialog(true);
        toast({
          title: "Recovery codes generated",
          description: "Make sure to save these codes in a secure location.",
        });
      } else {
        toast({
          title: "Failed to generate codes",
          description: "Please try again later.",
          variant: "destructive",
        });
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerateCodes = async () => {
    setGenerating(true);
    try {
      const newCodes = await generateCodes();
      if (newCodes) {
        setCodes(newCodes);
        setCodesVisible(true);
        setShowRegenerateDialog(false);
        setShowCodesDialog(true);
        toast({
          title: "New recovery codes generated",
          description: "Your old recovery codes are no longer valid.",
        });
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyCodes = () => {
    const codesText = codes.join("\n");
    navigator.clipboard.writeText(codesText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Codes copied",
      description: "Recovery codes have been copied to your clipboard.",
    });
  };

  const handleDownloadCodes = () => {
    const codesText = `CoParrent Recovery Codes
========================
Generated: ${new Date().toLocaleDateString()}

Keep these codes in a safe place. Each code can only be used once.

${codes.join("\n")}

If you lose access to your authenticator app, you can use one of these
codes to sign in to your account.
`;
    
    const blob = new Blob([codesText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "coparrent-recovery-codes.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Codes downloaded",
      description: "Recovery codes have been saved to a file.",
    });
  };

  if (!isEnabled) {
    return null;
  }

  const hasGeneratedCodes = status?.hasGeneratedCodes || false;
  const remaining = status?.remaining || 0;
  const lowCodes = remaining > 0 && remaining <= 3;

  return (
    <div className={className}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <Key className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium">Recovery Codes</p>
              {hasGeneratedCodes && (
                <Badge 
                  variant={lowCodes ? "destructive" : "secondary"} 
                  className="text-xs"
                >
                  {remaining} remaining
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {hasGeneratedCodes 
                ? lowCodes
                  ? "Running low! Consider generating new codes."
                  : "Use these if you lose your authenticator device" 
                : "Generate backup codes for account recovery"}
            </p>
          </div>
        </div>
        
        {hasGeneratedCodes ? (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowRegenerateDialog(true)}
            disabled={loading || generating}
          >
            {(loading || generating) ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Regenerate
          </Button>
        ) : (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleGenerateCodes}
            disabled={loading || generating}
          >
            {(loading || generating) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Generate Codes
          </Button>
        )}
      </div>

      {/* Low codes warning */}
      {lowCodes && (
        <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
          <p className="text-sm text-destructive">
            You only have {remaining} recovery code{remaining !== 1 ? 's' : ''} left. 
            We recommend generating new codes to ensure you can recover your account.
          </p>
        </div>
      )}

      {/* View/Download Codes Dialog */}
      <Dialog open={showCodesDialog} onOpenChange={setShowCodesDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Your Recovery Codes</DialogTitle>
            <DialogDescription>
              Save these codes in a secure location. Each code can only be used once to sign in if you lose access to your authenticator.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Recovery Codes</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCodesVisible(!codesVisible)}
              >
                {codesVisible ? (
                  <>
                    <EyeOff className="w-4 h-4 mr-2" />
                    Hide
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 mr-2" />
                    Show
                  </>
                )}
              </Button>
            </div>
            
            <div className="bg-muted rounded-lg p-4 font-mono text-sm">
              {codesVisible ? (
                <div className="grid grid-cols-2 gap-2">
                  {codes.map((code, index) => (
                    <div key={index} className="text-center py-1">
                      {code}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  Click "Show" to reveal your recovery codes
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1" 
                onClick={handleCopyCodes}
                disabled={!codesVisible}
              >
                {copied ? (
                  <Check className="w-4 h-4 mr-2 text-success" />
                ) : (
                  <Copy className="w-4 h-4 mr-2" />
                )}
                Copy All
              </Button>
              <Button 
                variant="outline" 
                className="flex-1" 
                onClick={handleDownloadCodes}
                disabled={!codesVisible}
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              ⚠️ These codes won't be shown again after you close this dialog.
            </p>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowCodesDialog(false)}>
              I've saved my codes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regenerate Confirmation Dialog */}
      <AlertDialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate Recovery Codes?</AlertDialogTitle>
            <AlertDialogDescription>
              This will invalidate all your existing recovery codes. Make sure to save the new codes in a secure location.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRegenerateCodes}
              disabled={generating}
            >
              {generating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Regenerate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
