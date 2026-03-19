import { useEffect, useState } from "react";
import { Lock, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const STORAGE_KEY = "coparrent-creations-privacy-tooltip-dismissed";

export const CreationsPrivacyTooltip = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissed = window.localStorage.getItem(STORAGE_KEY);
    if (!dismissed) {
      setOpen(true);
    }
  }, []);

  const dismiss = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, "true");
    }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[min(360px,calc(100vw-2rem))]">
      <Card className="border-primary/20 shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                  <Lock className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Creations are private by default</p>
                  <p className="text-xs text-muted-foreground">Share only when you choose to.</p>
                </div>
              </div>

              <div className="space-y-2 text-sm text-muted-foreground">
                <p>New Kids Hub creations stay visible only to you until you explicitly share them.</p>
                <p className="flex items-center gap-2">
                  <Share2 className="h-4 w-4 text-primary" />
                  Shared family members can view and export the item you grant access to.
                </p>
              </div>

              <div className="flex gap-2">
                <Button size="sm" onClick={dismiss}>
                  Understood
                </Button>
                <Button size="sm" variant="outline" onClick={dismiss}>
                  Dismiss
                </Button>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={dismiss}
              aria-label="Dismiss privacy tooltip"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
