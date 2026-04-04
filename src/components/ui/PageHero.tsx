import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const pageHeroVariants = cva("relative overflow-hidden", {
  variants: {
    variant: {
      dark: "surface-hero text-white",
      light: "surface-primary",
      legal: "surface-legal",
    },
  },
  defaultVariants: {
    variant: "light",
  },
});

interface PageHeroProps extends VariantProps<typeof pageHeroVariants> {
  actions?: React.ReactNode;
  bodyClassName?: string;
  children?: React.ReactNode;
  className?: string;
  description?: React.ReactNode;
  descriptionClassName?: string;
  eyebrow?: React.ReactNode;
  eyebrowTone?: "pill" | "text";
  metadata?: React.ReactNode;
  title: React.ReactNode;
  titleClassName?: string;
}

export function PageHero({
  actions,
  bodyClassName,
  children,
  className,
  description,
  descriptionClassName,
  eyebrow,
  eyebrowTone = "pill",
  metadata,
  title,
  titleClassName,
  variant,
}: PageHeroProps) {
  const isDark = variant === "dark";
  const isLegal = variant === "legal";

  return (
    <section className={cn(pageHeroVariants({ variant }), className)}>
      {isDark ? (
        <>
          <div className="absolute left-8 top-8 h-28 w-28 rounded-full bg-accent/18 blur-3xl" />
          <div className="absolute inset-y-0 right-8 w-44 rounded-full bg-primary/18 blur-3xl" />
        </>
      ) : null}

      <div
        className={cn(
          "relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.9fr)] lg:items-end",
          !children && "lg:grid-cols-1",
          bodyClassName,
        )}
      >
        <div className="space-y-4">
          {eyebrow ? (
            eyebrowTone === "pill" ? (
              <span className={isDark ? "eyebrow-pill-dark" : "eyebrow-pill"}>{eyebrow}</span>
            ) : (
              <p className={cn("section-kicker", isDark && "text-slate-200/82", isLegal && "text-foreground")}>
                {eyebrow}
              </p>
            )
          ) : null}

          <div className="space-y-3">
            <h1
              className={cn(
                "max-w-4xl",
                isDark ? "text-white" : "text-foreground",
                titleClassName,
              )}
            >
              {title}
            </h1>

            {description ? (
              <div
                className={cn(
                  "max-w-2xl text-sm leading-6 sm:text-base",
                  isDark ? "text-slate-200/80" : "text-muted-foreground",
                  descriptionClassName,
                )}
              >
                {description}
              </div>
            ) : null}
          </div>

          {metadata ? <div className="flex flex-wrap items-center gap-2">{metadata}</div> : null}
          {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
        </div>

        {children ? <div className="space-y-4">{children}</div> : null}
      </div>
    </section>
  );
}
