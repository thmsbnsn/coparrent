import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface UnreadBadgeProps {
  count: number;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const UnreadBadge = ({ count, className, size = "sm" }: UnreadBadgeProps) => {
  if (count <= 0) return null;

  const sizeClasses = {
    sm: "min-w-[18px] h-[18px] text-[10px] px-1",
    md: "min-w-[22px] h-[22px] text-xs px-1.5",
    lg: "min-w-[26px] h-[26px] text-sm px-2",
  };

  const displayCount = count > 99 ? "99+" : count.toString();

  return (
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      exit={{ scale: 0 }}
      className={cn(
        "inline-flex items-center justify-center font-semibold rounded-full",
        "bg-destructive text-destructive-foreground",
        sizeClasses[size],
        className
      )}
    >
      {displayCount}
    </motion.span>
  );
};
