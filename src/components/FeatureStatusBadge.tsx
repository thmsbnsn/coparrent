import { cn } from "@/lib/utils";
import { Sparkles, CheckCircle, Clock } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type FeatureStatus = "stable" | "coming_soon" | "new";

interface FeatureStatusBadgeProps {
  status: FeatureStatus;
  className?: string;
  showTooltip?: boolean;
}

const statusConfig: Record<
  FeatureStatus,
  {
    label: string;
    icon: typeof CheckCircle;
    className: string;
    tooltip: string;
  }
> = {
  stable: {
    label: "Stable",
    icon: CheckCircle,
    className: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
    tooltip: "This feature is fully tested and production-ready.",
  },
  coming_soon: {
    label: "Coming Soon",
    icon: Clock,
    className: "bg-muted text-muted-foreground border-border",
    tooltip: "This feature is planned but not yet available.",
  },
  new: {
    label: "New",
    icon: Sparkles,
    className: "bg-primary/10 text-primary border-primary/20",
    tooltip: "This feature was recently added.",
  },
};

export const FeatureStatusBadge = ({
  status,
  className,
  showTooltip = true,
}: FeatureStatusBadgeProps) => {
  const config = statusConfig[status];
  const Icon = config.icon;

  const badge = (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border",
        config.className,
        className
      )}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent>
        <p className="text-sm">{config.tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
};

// Feature status registry - centralized source of truth
export const FEATURE_STATUS: Record<string, FeatureStatus> = {
  // Core features - stable
  calendar: "stable",
  messaging: "stable",
  children: "stable",
  documents: "stable",
  expenses: "stable",
  
  // Recent additions
  sports: "new",
  gifts: "new",
  kid_center: "new",
  ai_message_assist: "new",
  ai_schedule_suggest: "new",
  journal: "stable",
  
  // Coming soon
  court_export: "stable",
  
  // New features
  messaging_hub: "new",
  law_library: "stable",
};
