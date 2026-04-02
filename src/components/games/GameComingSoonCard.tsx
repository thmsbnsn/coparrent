import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

interface GameComingSoonCardProps {
  accentClass: string;
  description: string;
  icon: LucideIcon;
  label: string;
  title: string;
  to?: string;
}

export const GameComingSoonCard = ({
  accentClass,
  description,
  icon: Icon,
  label,
  title,
  to,
}: GameComingSoonCardProps) => (
  <article className="overflow-hidden rounded-[1.8rem] border border-border/70 bg-card/85 shadow-sm">
    <div className={`h-28 bg-gradient-to-br ${accentClass} px-5 py-4 text-white`}>
      <div className="flex items-start justify-between gap-4">
        <div className="rounded-full bg-white/18 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/85 backdrop-blur">
          {label}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/16">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <h3 className="mt-5 text-2xl font-display font-semibold">{title}</h3>
    </div>

    <div className="p-5">
      <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          Coming soon
        </div>
        {to ? (
          <Link
            to={to}
            className="inline-flex items-center rounded-full border border-border/70 bg-background px-3 py-1 text-xs font-semibold text-foreground transition hover:bg-muted"
          >
            See game plan
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>
    </div>
  </article>
);
