import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Crown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePremiumAccess } from "@/hooks/usePremiumAccess";
import { Skeleton } from "@/components/ui/skeleton";
import { recordPremiumDenial, getDenialContext } from "@/lib/denialTelemetry";
import { useSubscription } from "@/hooks/useSubscription";

interface PremiumFeatureGateProps {
  children: ReactNode;
  featureName?: string;
  /** Show inline message instead of full card overlay */
  inline?: boolean;
  /** Show nothing instead of upgrade prompt when locked */
  hideWhenLocked?: boolean;
  /** Custom fallback component */
  fallback?: ReactNode;
}

export const PremiumFeatureGate = ({
  children,
  featureName = "This feature",
  inline = false,
  hideWhenLocked = false,
  fallback,
}: PremiumFeatureGateProps) => {
  const navigate = useNavigate();
  const { hasAccess, loading, reason } = usePremiumAccess();
  const { tier } = useSubscription();

  const isExpired = reason === "trial_expired";
  const denialReason = isExpired ? "trial_expired" : "premium_required";

  // Record telemetry when access is denied
  useEffect(() => {
    if (!loading && !hasAccess) {
      recordPremiumDenial(
        featureName,
        tier || "free",
        denialReason
      );
    }
  }, [loading, hasAccess, featureName, tier, denialReason]);

  if (loading) {
    return inline ? (
      <Skeleton className="h-8 w-full" />
    ) : (
      <Card className="border-dashed">
        <CardContent className="p-6">
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  if (hideWhenLocked) {
    return null;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  // Get user-friendly context
  const context = getDenialContext(denialReason, featureName);

  if (inline) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Lock className="h-4 w-4" />
        <span>{context.title}</span>
        <Button 
          variant="link" 
          size="sm" 
          className="h-auto p-0 text-primary"
          onClick={() => navigate("/pricing")}
        >
          {context.action.label}
        </Button>
      </div>
    );
  }

  return (
    <Card className="border-dashed border-2 border-primary/20 bg-primary/5">
      <CardContent className="p-6 flex flex-col items-center text-center gap-4">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          {isExpired ? (
            <Lock className="h-6 w-6 text-primary" />
          ) : (
            <Crown className="h-6 w-6 text-primary" />
          )}
        </div>
        
        <div className="space-y-2">
          <h3 className="font-semibold text-lg">{context.title}</h3>
          <p className="text-muted-foreground text-sm max-w-sm">
            {context.description}
          </p>
        </div>

        <Button onClick={() => navigate("/pricing")} className="gap-2">
          <Sparkles className="h-4 w-4" />
          {context.action.label}
        </Button>
      </CardContent>
    </Card>
  );
};
