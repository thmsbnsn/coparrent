import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GameShellProps {
  backLabel?: string;
  children: ReactNode;
  description: string;
  onBack: () => void;
  title: string;
}

export const GameShell = ({
  backLabel = "Back",
  children,
  description,
  onBack,
  title,
}: GameShellProps) => (
  <div className="space-y-5">
    <section className="rounded-[2rem] border border-border bg-white/90 p-5 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            className="rounded-full bg-white"
            onClick={onBack}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {backLabel}
          </Button>

          <div>
            <div className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700">
              First playable game
            </div>
            <h1 className="mt-3 text-3xl font-display font-semibold text-slate-950 sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
              {description}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[1.5rem] bg-slate-950 px-4 py-4 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/65">
              How to play
            </p>
            <p className="mt-2 text-sm font-medium">Tap, click, or press space to keep flying.</p>
          </div>
          <div className="rounded-[1.5rem] bg-sky-50 px-4 py-4 text-slate-900">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700/70">
              MVP score
            </p>
            <p className="mt-2 text-sm font-medium">Best score stays only on this device for now.</p>
          </div>
        </div>
      </div>
    </section>

    {children}
  </div>
);
