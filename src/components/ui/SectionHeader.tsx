import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  actions?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
  description?: React.ReactNode;
  descriptionClassName?: string;
  eyebrow?: React.ReactNode;
  eyebrowTone?: "pill" | "text";
  title: React.ReactNode;
  titleClassName?: string;
}

export function SectionHeader({
  actions,
  align = "left",
  className,
  description,
  descriptionClassName,
  eyebrow,
  eyebrowTone = "text",
  title,
  titleClassName,
}: SectionHeaderProps) {
  const isCentered = align === "center";

  return (
    <div className={cn("space-y-3", isCentered && "text-center", className)}>
      {eyebrow ? (
        eyebrowTone === "pill" ? (
          <span className="eyebrow-pill">{eyebrow}</span>
        ) : (
          <p className="section-kicker">{eyebrow}</p>
        )
      ) : null}

      <h2 className={cn("section-title", titleClassName)}>{title}</h2>

      {description ? (
        <p
          className={cn(
            "section-copy max-w-2xl",
            isCentered && "mx-auto",
            descriptionClassName,
          )}
        >
          {description}
        </p>
      ) : null}

      {actions ? (
        <div className={cn("flex flex-wrap gap-3", isCentered && "justify-center")}>{actions}</div>
      ) : null}
    </div>
  );
}
