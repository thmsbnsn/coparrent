import { useState, useEffect } from "react";
import { X, FlaskConical, Bug, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BetaBannerProps {
  className?: string;
}

export const BetaBanner = ({ className }: BetaBannerProps) => {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if user has dismissed the banner this session
    const wasDismissed = sessionStorage.getItem("beta-banner-dismissed");
    if (wasDismissed === "true") {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("beta-banner-dismissed", "true");
  };

  if (dismissed) return null;

  return (
    <div
      className={cn(
        "relative bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-amber-500/10",
        "border-b border-amber-500/20",
        "px-4 py-2",
        className
      )}
    >
      <div className="container mx-auto flex items-center justify-between gap-4 text-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-medium text-xs">
            <FlaskConical className="w-3 h-3" />
            BETA
          </div>
          <span className="text-muted-foreground hidden sm:inline">
            You're using an early version of CoParrent. Some features may be incomplete.
          </span>
          <span className="text-muted-foreground sm:hidden">
            Early access version
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground hover:text-foreground hidden sm:flex"
            onClick={() => window.open("mailto:feedback@coparrent.com?subject=Beta Feedback", "_blank")}
          >
            <MessageSquare className="w-3 h-3 mr-1" />
            Feedback
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground hover:text-foreground hidden sm:flex"
            onClick={() => window.open("mailto:support@coparrent.com?subject=Bug Report", "_blank")}
          >
            <Bug className="w-3 h-3 mr-1" />
            Report Bug
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={handleDismiss}
            aria-label="Dismiss beta banner"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
