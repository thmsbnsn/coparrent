import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const statusPillVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium leading-none whitespace-nowrap transition-colors",
  {
    variants: {
      variant: {
        neutral: "border-border/80 bg-background/82 text-muted-foreground",
        scope: "border-primary/15 bg-primary/10 text-primary",
        highlight: "border-primary/18 bg-gradient-to-r from-primary/12 to-accent/20 text-primary",
        info: "border-info/20 bg-info/10 text-info",
        success: "border-success/20 bg-success/10 text-success",
        warning: "border-warning/20 bg-warning/10 text-warning",
        legal: "border-border/85 bg-background/92 uppercase tracking-[0.14em] text-muted-foreground",
        "read-only":
          "border-border/80 bg-muted/75 font-mono uppercase tracking-[0.14em] text-[11px] text-muted-foreground",
        dark: "border-white/10 bg-white/8 text-white/82 backdrop-blur-sm",
      },
      size: {
        sm: "px-2.5 py-1 text-[11px]",
        md: "px-3 py-1 text-xs",
      },
    },
    defaultVariants: {
      variant: "neutral",
      size: "md",
    },
  },
);

interface StatusPillProps extends VariantProps<typeof statusPillVariants> {
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}

export function StatusPill({
  children,
  className,
  icon,
  size,
  variant,
}: StatusPillProps) {
  return (
    <span className={cn(statusPillVariants({ variant, size }), className)}>
      {icon}
      {children}
    </span>
  );
}
