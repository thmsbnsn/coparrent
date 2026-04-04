import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const sectionCardVariants = cva("border transition-all duration-200", {
  variants: {
    variant: {
      hero: "surface-primary rounded-[2rem] p-6 sm:p-7 lg:p-8",
      primary: "surface-primary p-6 sm:p-7",
      standard: "surface-standard p-5 sm:p-6",
      secondary: "surface-secondary p-4 sm:p-5",
      legal: "surface-legal p-5 sm:p-6",
      legalMuted: "surface-legal-muted p-4 sm:p-5",
      glass: "surface-hero-panel p-4 sm:p-5",
      tint:
        "rounded-[1.5rem] border-primary/10 bg-[radial-gradient(circle_at_top_right,hsl(var(--accent)/0.22),transparent_34%),linear-gradient(180deg,hsl(var(--background)/0.92),hsl(var(--muted)/0.48))] p-5 shadow-[0_22px_40px_-32px_rgba(8,21,47,0.45)]",
    },
  },
  defaultVariants: {
    variant: "standard",
  },
});

interface SectionCardProps extends VariantProps<typeof sectionCardVariants> {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
}

export function SectionCard({
  children,
  className,
  interactive = false,
  variant,
}: SectionCardProps) {
  return (
    <div
      className={cn(
        sectionCardVariants({ variant }),
        interactive &&
          "cursor-pointer hover:-translate-y-1 hover:border-primary/20 hover:shadow-[0_28px_55px_-36px_rgba(8,21,47,0.42)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
