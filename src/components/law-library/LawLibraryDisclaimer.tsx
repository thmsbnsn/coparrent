import { useState, useEffect } from 'react';
import { AlertTriangle, Scale } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface LawLibraryDisclaimerProps {
  onAccept: () => void;
}

const DISCLAIMER_STORAGE_KEY = 'law-library-disclaimer-accepted';

export const LawLibraryDisclaimer = ({ onAccept }: LawLibraryDisclaimerProps) => {
  const [open, setOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem(DISCLAIMER_STORAGE_KEY);
    if (!accepted) {
      setOpen(true);
    } else {
      onAccept();
    }
  }, [onAccept]);

  const handleAccept = () => {
    if (dontShowAgain) {
      localStorage.setItem(DISCLAIMER_STORAGE_KEY, 'true');
    }
    setOpen(false);
    onAccept();
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Scale className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <AlertDialogTitle className="text-xl">
              Legal Information Disclaimer
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-4 text-left">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    This is for informational purposes only — not legal advice.
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    The documents in this library are provided as reference materials only. 
                    They do not constitute legal advice and should not be relied upon as such.
                  </p>
                </div>
              </div>
              
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  Laws vary by state and change frequently
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  Your situation may have unique circumstances
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  Always consult a licensed attorney for legal advice
                </li>
              </ul>

              <p className="text-sm font-medium text-foreground">
                Last verified: December 2024
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="flex items-center space-x-2 py-2">
          <Checkbox
            id="dontShowAgain"
            checked={dontShowAgain}
            onCheckedChange={(checked) => setDontShowAgain(checked === true)}
          />
          <Label
            htmlFor="dontShowAgain"
            className="text-sm text-muted-foreground cursor-pointer"
          >
            Don't show this again
          </Label>
        </div>

        <AlertDialogFooter>
          <AlertDialogAction onClick={handleAccept} className="w-full sm:w-auto">
            I Understand
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
