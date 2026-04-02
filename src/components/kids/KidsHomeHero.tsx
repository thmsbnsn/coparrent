import { Sparkles, SunMedium } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface KidsHomeHeroProps {
  childName: string;
}

export const KidsHomeHero = ({ childName }: KidsHomeHeroProps) => (
  <section className="relative overflow-hidden rounded-[2.25rem] bg-[linear-gradient(135deg,#ff8a7a_0%,#ffb27a_42%,#ffd981_100%)] p-6 text-white shadow-[0_28px_70px_rgba(249,115,22,0.28)] sm:p-8">
    <div className="absolute inset-y-0 right-0 w-[42%] bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.4),transparent_58%)]" />
    <div className="absolute -right-10 -top-8 h-36 w-36 rounded-full bg-white/15 blur-2xl" />
    <div className="absolute bottom-0 left-[48%] h-24 w-24 rounded-full bg-fuchsia-400/20 blur-2xl" />

    <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-end">
      <div className="max-w-xl">
        <Badge className="rounded-full border-0 bg-white/20 px-4 py-1 text-white backdrop-blur">
          <Sparkles className="mr-2 h-4 w-4" />
          Today&apos;s play space
        </Badge>
        <p className="mt-6 text-sm font-medium uppercase tracking-[0.32em] text-white/80">
          Hello, {childName}
        </p>
        <h1 className="mt-3 text-4xl font-display font-bold leading-tight sm:text-5xl">
          Pick a game, check today, and tap the people you know.
        </h1>
        <p className="mt-4 max-w-lg text-sm text-white/90 sm:text-base">
          This home screen keeps the day simple, bright, and safe. Big buttons only. No crowded grown-up tools.
        </p>
      </div>

      <div className="justify-self-end rounded-[2rem] bg-white/15 p-5 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-white/90">
          <SunMedium className="h-5 w-5" />
          <span className="text-sm font-medium">Ready for today</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-slate-950">
          <div className="rounded-2xl bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Play</p>
            <p className="mt-2 text-lg font-display font-semibold">Games</p>
          </div>
          <div className="rounded-2xl bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Talk</p>
            <p className="mt-2 text-lg font-display font-semibold">Calls</p>
          </div>
        </div>
      </div>
    </div>
  </section>
);
