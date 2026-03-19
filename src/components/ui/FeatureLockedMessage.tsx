/**
 * FeatureLockedMessage - Clear denial messaging for gated features
 * 
 * Displays when a user cannot access a feature with:
 * - Clear title explaining the restriction
 * - Description of why access is denied
 * - Whether it's temporary or permanent
 * - Clear call-to-action for what to do next
 * 
 * Used by PremiumFeatureGate, RoleGate, ChildAccountGate
 */

import { Link, useNavigate } from "react-router-dom";
import { 
  Lock, 
  Crown, 
  Users, 
  UserX, 
  Clock, 
  ArrowRight,
  Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getDenialContext, DenialReason } from "@/lib/denialTelemetry";

interface FeatureLockedMessageProps {
  /** The denial reason */
  reason: DenialReason;
  /** Feature name for context */
  featureName?: string;
  /** Show as inline text or card */
  variant?: "inline" | "card";
  /** Additional className */
  className?: string;
}

const REASON_ICONS: Record<DenialReason, React.ElementType> = {
  premium_required: Crown,
  trial_expired: Lock,
  role_restricted: Users,
  child_restricted: UserX,
  rate_limited: Clock,
  plan_limit_reached: Crown,
  feature_disabled: Shield,
};

export function FeatureLockedMessage({
  reason,
  featureName = "This feature",
  variant = "card",
  className,
}: FeatureLockedMessageProps) {
  const navigate = useNavigate();
  const context = getDenialContext(reason, featureName);
  const Icon = REASON_ICONS[reason] || Lock;

  if (variant === "inline") {
    return (
      <div className={cn("flex items-center gap-2 text-muted-foreground text-sm", className)}>
        <Icon className="h-4 w-4 shrink-0" />
        <span>{context.title}</span>
        {context.action.type === "link" && context.action.href && (
          <Button variant="link" size="sm" className="h-auto p-0 text-primary" asChild>
            <Link to={context.action.href}>{context.action.label}</Link>
          </Button>
        )}
      </div>
    );
  }

  // Determine card styling based on temporary/permanent
  const cardColors = context.isTemporary
    ? "border-amber-200 bg-amber-50/50 dark:bg-amber-950/10 dark:border-amber-800"
    : "border-primary/20 bg-primary/5";

  const iconColors = context.isTemporary
    ? "bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-300"
    : "bg-primary/10 text-primary";

  return (
    <Card className={cn(cardColors, "border-dashed border-2", className)}>
      <CardContent className="p-6 flex flex-col items-center text-center gap-4">
        <div className={cn("h-12 w-12 rounded-full flex items-center justify-center", iconColors)}>
          <Icon className="h-6 w-6" />
        </div>

        <div className="space-y-2">
          <h3 className="font-semibold text-lg">{context.title}</h3>
          <p className="text-muted-foreground text-sm max-w-sm">
            {context.description}
          </p>
          
          {context.isTemporary && (
            <p className="text-xs text-muted-foreground/70 flex items-center justify-center gap-1">
              <Clock className="h-3 w-3" />
              This is temporary
            </p>
          )}
        </div>

        {context.action.type === "link" && context.action.href && (
          <Button asChild>
            <Link to={context.action.href}>
              {context.action.label}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        )}

        {context.action.type === "button" && (
          <Button variant="outline" onClick={() => navigate(-1)}>
            {context.action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Simple locked indicator for use in buttons/headers
 */
export function LockedBadge({ 
  reason,
  className 
}: { 
  reason: DenialReason;
  className?: string;
}) {
  const context = getDenialContext(reason);
  const Icon = REASON_ICONS[reason] || Lock;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
        context.isTemporary
          ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
          : "bg-muted text-muted-foreground",
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {context.title}
    </span>
  );
}
