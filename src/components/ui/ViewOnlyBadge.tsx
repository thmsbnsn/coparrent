import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ViewOnlyBadgeProps {
  /** Reason shown in tooltip */
  reason?: string;
  /** Size variant */
  size?: "sm" | "default";
  /** Additional class names */
  className?: string;
}

/**
 * ViewOnlyBadge - Clear indicator for read-only access
 * 
 * Displays a "View Only" badge with an optional tooltip explaining why.
 * Used when permissions prevent editing/mutation.
 */
export const ViewOnlyBadge = ({
  reason = "You have view-only access",
  size = "default",
  className,
}: ViewOnlyBadgeProps) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="secondary"
            className={cn(
              "gap-1 cursor-help",
              size === "sm" && "text-xs px-1.5 py-0.5",
              className
            )}
          >
            <Eye className={cn("shrink-0", size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} />
            View Only
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm">{reason}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
