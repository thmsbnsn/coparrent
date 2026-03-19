import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  threshold?: number;
}

export const PullToRefreshIndicator = ({ 
  pullDistance, 
  isRefreshing,
  threshold = 80 
}: PullToRefreshIndicatorProps) => {
  const progress = Math.min(pullDistance / threshold, 1);
  const shouldShow = pullDistance > 10 || isRefreshing;

  if (!shouldShow) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ 
        opacity: progress > 0.1 ? 1 : 0,
        y: pullDistance > 0 ? 0 : -20,
      }}
      className="absolute top-0 left-0 right-0 flex items-center justify-center z-10"
      style={{ 
        height: Math.min(pullDistance, threshold * 1.5),
        pointerEvents: "none",
      }}
    >
      <div className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-full",
        "bg-background/95 border border-border shadow-lg",
        isRefreshing && "bg-primary/10 border-primary/30"
      )}>
        <motion.div
          animate={{
            rotate: isRefreshing ? 360 : progress * 360,
          }}
          transition={{
            rotate: isRefreshing 
              ? { duration: 1, repeat: Infinity, ease: "linear" }
              : { duration: 0 }
          }}
        >
          <RefreshCw className={cn(
            "w-4 h-4",
            isRefreshing ? "text-primary" : "text-muted-foreground"
          )} />
        </motion.div>
        <span className={cn(
          "text-xs font-medium",
          isRefreshing ? "text-primary" : "text-muted-foreground"
        )}>
          {isRefreshing 
            ? "Refreshing..." 
            : progress >= 1 
              ? "Release to refresh" 
              : "Pull to refresh"}
        </span>
      </div>
    </motion.div>
  );
};
