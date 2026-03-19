import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OnboardingTooltip as TooltipType } from "@/hooks/useOnboardingTooltips";

interface OnboardingTooltipProps {
  tooltip: TooltipType;
  totalCount: number;
  currentIndex: number;
  onDismiss: (id: string) => void;
  onSkipAll: () => void;
}

export function OnboardingTooltip({
  tooltip,
  totalCount,
  currentIndex,
  onDismiss,
  onSkipAll,
}: OnboardingTooltipProps) {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const calculatePosition = () => {
      const targetElement = document.getElementById(tooltip.targetId);
      if (!targetElement || !tooltipRef.current) {
        setIsVisible(false);
        return;
      }

      const targetRect = targetElement.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const padding = 12;

      let top = 0;
      let left = 0;

      switch (tooltip.position) {
        case "top":
          top = targetRect.top - tooltipRect.height - padding;
          left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
          break;
        case "bottom":
          top = targetRect.bottom + padding;
          left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
          break;
        case "left":
          top = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2;
          left = targetRect.left - tooltipRect.width - padding;
          break;
        case "right":
        default:
          top = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2;
          left = targetRect.right + padding;
          break;
      }

      // Keep within viewport
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (left < padding) left = padding;
      if (left + tooltipRect.width > viewportWidth - padding) {
        left = viewportWidth - tooltipRect.width - padding;
      }
      if (top < padding) top = padding;
      if (top + tooltipRect.height > viewportHeight - padding) {
        top = viewportHeight - tooltipRect.height - padding;
      }

      setPosition({ top, left });
      setIsVisible(true);
    };

    // Initial calculation with delay for DOM updates
    const timer = setTimeout(calculatePosition, 100);
    
    window.addEventListener("resize", calculatePosition);
    window.addEventListener("scroll", calculatePosition);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", calculatePosition);
      window.removeEventListener("scroll", calculatePosition);
    };
  }, [tooltip.targetId, tooltip.position]);

  const isLast = currentIndex === totalCount - 1;

  return (
    <AnimatePresence>
      <motion.div
        ref={tooltipRef}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: isVisible ? 1 : 0, scale: isVisible ? 1 : 0.9 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2 }}
        style={{
          position: "fixed",
          top: position.top,
          left: position.left,
          zIndex: 9999,
        }}
        className={cn(
          "w-72 rounded-xl border border-primary/20 bg-card shadow-xl",
          "overflow-hidden"
        )}
      >
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-4 py-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                {currentIndex + 1}
              </div>
              <span className="text-xs text-muted-foreground">
                of {totalCount}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onDismiss(tooltip.id)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <h4 className="font-display font-semibold text-foreground mb-2">
            {tooltip.title}
          </h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {tooltip.description}
          </p>
        </div>

        {/* Actions */}
        <div className="px-4 pb-4 flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onSkipAll}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            <SkipForward className="h-3 w-3 mr-1" />
            Skip tour
          </Button>
          <Button
            size="sm"
            onClick={() => onDismiss(tooltip.id)}
            className="gap-1"
          >
            {isLast ? "Finish" : "Next"}
            {!isLast && <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <motion.div
            className="h-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${((currentIndex + 1) / totalCount) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
