import { useRef, useState, useCallback, ReactNode } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { cn } from "@/lib/utils";

interface SwipeableTabsProps {
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  children: ReactNode;
  className?: string;
}

export const SwipeableTabs = ({
  tabs,
  activeTab,
  onTabChange,
  children,
  className,
}: SwipeableTabsProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const activeIndex = tabs.indexOf(activeTab);

  const handleDragEnd = useCallback((
    event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    setIsDragging(false);
    
    const threshold = 50;
    const velocity = info.velocity.x;
    const offset = info.offset.x;

    // Determine swipe direction based on offset and velocity
    if (Math.abs(offset) > threshold || Math.abs(velocity) > 500) {
      if (offset > 0 || velocity > 500) {
        // Swiped right - go to previous tab
        const prevIndex = Math.max(0, activeIndex - 1);
        onTabChange(tabs[prevIndex]);
      } else {
        // Swiped left - go to next tab
        const nextIndex = Math.min(tabs.length - 1, activeIndex + 1);
        onTabChange(tabs[nextIndex]);
      }
    }
  }, [activeIndex, tabs, onTabChange]);

  return (
    <div ref={containerRef} className={cn("overflow-hidden", className)}>
      <motion.div
        drag="x"
        dragConstraints={containerRef}
        dragElastic={0.1}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}
        className={cn(
          "touch-pan-y",
          isDragging && "cursor-grabbing"
        )}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.15 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
