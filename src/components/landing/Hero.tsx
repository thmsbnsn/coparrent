import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CalendarDays, FileCheck, LayoutDashboard, Scale, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/ui/PageHero";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatusPill } from "@/components/ui/StatusPill";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Hero Section - Authority-Driven Design
 * 
 * Design Intent:
 * - Communicate calm authority, not "friendly app" vibes
 * - Value proposition legible in 3 seconds
 * - Professional credibility suitable for court scrutiny
 * - "Reassuringly serious" rather than "pleasant"
 * 
 * CORRECTIONS (Post-Review):
 * - Fixed: Text contrast was too low (white/70 → white/90)
 * - Fixed: Secondary CTA was invisible (ghost → outline with visible border)
 * - Fixed: Trust signals were washed out (white/60 → white/80)
 * - Fixed: Eyebrow pill had poor contrast (white/80 → white/90)
 */

const trustSignals = [
  { icon: Shield, label: "Private family data" },
  { icon: FileCheck, label: "Documented communication" },
  { icon: Scale, label: "Court-aware exports" },
];

const heroPanels = [
  {
    icon: CalendarDays,
    title: "Clear operational view",
    copy: "Schedules, exchanges, and shared context stay visible before anyone needs to search for them.",
  },
  {
    icon: FileCheck,
    title: "Records that hold up",
    copy: "Messages, notes, and exports keep the chronology intact without turning daily coordination into extra work.",
  },
];

export const Hero = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const heroActions = !loading && user ? (
    <Button
      size="lg"
      onClick={() => navigate("/dashboard")}
      className="h-12 rounded-2xl bg-white text-slate-950 shadow-[0_24px_50px_-28px_rgba(15,23,42,0.95)] hover:bg-white/95"
    >
      <LayoutDashboard className="mr-2 h-5 w-5" />
      Go to Dashboard
    </Button>
  ) : (
    <>
      <Button
        size="lg"
        onClick={() => navigate("/signup")}
        className="h-12 rounded-2xl bg-white text-slate-950 shadow-[0_24px_50px_-28px_rgba(15,23,42,0.95)] hover:bg-white/95"
      >
        Start Free
        <ArrowRight className="ml-2 h-5 w-5" />
      </Button>
      <Button
        variant="outline"
        size="lg"
        onClick={() => navigate("/features")}
        className="h-12 rounded-2xl border-white/20 bg-white/6 text-white hover:border-white/30 hover:bg-white/12"
      >
        See How It Works
      </Button>
    </>
  );

  return (
    <section className="relative overflow-hidden px-4 pb-20 pt-24 sm:px-6 lg:px-8 lg:pb-28 lg:pt-32">
      <div className="absolute inset-x-0 top-0 -z-10 h-[32rem] bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.16),transparent_56%),radial-gradient(circle_at_top_right,rgba(45,212,191,0.14),transparent_42%)]" />
      <div className="page-shell-public">
        <PageHero
          variant="dark"
          className="px-6 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12"
          bodyClassName="gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(18rem,0.95fr)]"
          eyebrow={
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              Built for shared custody and clearer records
            </>
          }
          title={
            <>
              One operating system for
              <br />
              <span className="text-white/92">calmer co-parenting</span>
            </>
          }
          description={
            <p className="max-w-2xl text-base leading-7 text-white/78 sm:text-lg">
              CoParrent keeps schedules, messages, child information, documents, and expenses
              inside one modern family workspace so decisions stay grounded in the same record.
            </p>
          }
          actions={
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center"
            >
              {heroActions}
            </motion.div>
          }
          metadata={
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex flex-wrap items-center gap-3"
            >
              {trustSignals.map((signal, index) => (
                <motion.div
                  key={signal.label}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.45 + index * 0.1 }}
                >
                  <StatusPill variant="dark" icon={<signal.icon className="h-4 w-4" />}>
                    {signal.label}
                  </StatusPill>
                </motion.div>
              ))}
            </motion.div>
          }
        >
          <motion.div
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55, delay: 0.22 }}
            className="space-y-4"
          >
            <SectionCard variant="glass" className="text-white">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/68">
                Why families switch
              </p>
              <div className="mt-4 space-y-3">
                {heroPanels.map((panel) => (
                  <div
                    key={panel.title}
                    className="rounded-[1.35rem] border border-white/10 bg-slate-950/28 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white">
                        <panel.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{panel.title}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-200/72">{panel.copy}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <div className="grid gap-3 sm:grid-cols-2">
              <SectionCard variant="glass" className="text-white">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/68">
                  Shared family system
                </p>
                <p className="mt-3 text-2xl font-display font-semibold text-white">Calendar first</p>
                <p className="mt-2 text-sm leading-6 text-slate-200/72">
                  Schedules, messages, records, and follow-through all align to the same family context.
                </p>
              </SectionCard>
              <SectionCard variant="glass" className="text-white">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/68">
                  Professional tone
                </p>
                <p className="mt-3 text-2xl font-display font-semibold text-white">Calm authority</p>
                <p className="mt-2 text-sm leading-6 text-slate-200/72">
                  Modern product polish without feeling casual, childish, or legally vague.
                </p>
              </SectionCard>
            </div>
          </motion.div>
        </PageHero>
      </div>
    </section>
  );
};
