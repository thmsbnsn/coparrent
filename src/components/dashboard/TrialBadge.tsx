import { differenceInDays } from "date-fns";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useSubscription } from "@/hooks/useSubscription";

interface TrialBadgeProps {
  collapsed?: boolean;
}

export const TrialBadge = ({ collapsed = false }: TrialBadgeProps) => {
  const { trial, trialEndsAt, subscribed, freeAccess, loading } = useSubscription();

  // Don't show for subscribers, free access users, or while loading
  if (loading || subscribed || freeAccess || !trial || !trialEndsAt) {
    return null;
  }

  const now = new Date();
  const endDate = new Date(trialEndsAt);
  const daysRemaining = Math.max(0, differenceInDays(endDate, now));
  const isExpired = now > endDate;

  if (isExpired) {
    return (
      <Badge 
        variant="destructive" 
        className="text-[10px] px-1.5 py-0.5 h-auto shrink-0"
      >
        {collapsed ? "!" : "Upgrade"}
      </Badge>
    );
  }

  return (
    <Badge 
      variant="secondary" 
      className="text-[10px] px-1.5 py-0.5 h-auto shrink-0 bg-primary/10 text-primary border-0"
    >
      {collapsed ? (
        <span className="flex items-center">
          <Clock className="w-3 h-3" />
        </span>
      ) : (
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {daysRemaining}d left
        </span>
      )}
    </Badge>
  );
};
