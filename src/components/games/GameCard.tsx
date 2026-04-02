import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface GameCardProps {
  accentClass: string;
  actionLabel: string;
  description: string;
  eyebrow: string;
  icon: LucideIcon;
  title: string;
  to: string;
  artAlt?: string;
  artClassName?: string;
  artSrc?: string;
  className?: string;
}

export const GameCard = ({
  accentClass,
  actionLabel,
  artAlt = "",
  artClassName,
  artSrc,
  className,
  description,
  eyebrow,
  icon: Icon,
  title,
  to,
}: GameCardProps) => (
  <article
    className={cn(
      "relative min-w-0 overflow-hidden rounded-[2rem] border border-border/70 bg-card/90 p-5 shadow-[0_24px_50px_-36px_rgba(15,23,42,0.75)]",
      className,
    )}
  >
    <div className={cn("absolute inset-0 bg-gradient-to-br opacity-95", accentClass)} />
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.22),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.18),transparent_32%)]" />

    <div className="relative flex h-full flex-col gap-5 text-white">
      <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/80">{eyebrow}</p>
          <h3 className="mt-3 text-3xl font-display font-semibold tracking-tight">{title}</h3>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/82">{description}</p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/16 backdrop-blur">
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-auto flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <Link
          to={to}
          className="inline-flex h-12 w-fit max-w-full items-center rounded-full bg-white px-5 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-slate-100"
        >
          {actionLabel}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>

        {artSrc ? (
          <img
            alt={artAlt}
            src={artSrc}
            className={cn("pointer-events-none max-w-full self-end select-none drop-shadow-[0_18px_20px_rgba(15,23,42,0.18)]", artClassName)}
          />
        ) : null}
      </div>
    </div>
  </article>
);
