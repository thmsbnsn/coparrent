/**
 * RateLimitedMessage - Calm, human-readable rate limit messaging
 * 
 * Displays when a user hits a rate limit with:
 * - Clear explanation of why
 * - Whether it's temporary
 * - What they can do next
 * 
 * Never exposes internal counters or IDs.
 */

import { Clock, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RateLimitedMessageProps {
  /** Feature that was rate limited */
  feature?: string;
  /** Custom title override */
  title?: string;
  /** Custom description override */
  description?: string;
  /** Whether to show inline (smaller) or as a card */
  variant?: "inline" | "card";
  /** Optional callback when user acknowledges */
  onDismiss?: () => void;
  /** Additional className */
  className?: string;
}

export function RateLimitedMessage({
  feature,
  title = "Daily Limit Reached",
  description,
  variant = "card",
  onDismiss,
  className,
}: RateLimitedMessageProps) {
  const defaultDescription = feature
    ? `You've reached your daily limit for ${feature.toLowerCase()}. This resets at midnight.`
    : "You've reached your daily limit. Please try again tomorrow.";

  if (variant === "inline") {
    return (
      <div className={cn("flex items-center gap-2 text-muted-foreground text-sm", className)}>
        <Clock className="h-4 w-4 shrink-0" />
        <span>{description || defaultDescription}</span>
      </div>
    );
  }

  return (
    <Alert className={cn("border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800", className)}>
      <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertTitle className="text-amber-800 dark:text-amber-200">
        {title}
      </AlertTitle>
      <AlertDescription className="text-amber-700 dark:text-amber-300">
        <p className="mb-3">{description || defaultDescription}</p>
        <div className="flex items-center gap-2 text-sm">
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Limits reset at midnight (your timezone)</span>
        </div>
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="mt-3 text-amber-800 hover:text-amber-900 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900"
          >
            Got It
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Compact rate limit indicator for use in buttons/cards
 */
export function RateLimitBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
        "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
        className
      )}
    >
      <Clock className="h-3 w-3" />
      Limit reached
    </span>
  );
}
