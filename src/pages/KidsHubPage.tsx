import type { ElementType } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Library,
  Palette,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  WandSparkles,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PremiumFeatureGate } from "@/components/premium/PremiumFeatureGate";
import { RoleGate } from "@/components/gates/RoleGate";
import { cn } from "@/lib/utils";

interface HubCardProps {
  title: string;
  description: string;
  eyebrow: string;
  footerLabel: string;
  highlights: string[];
  icon: ElementType;
  href: string;
  ctaLabel: string;
  toneClass: string;
  iconClass: string;
  imageSrc: string;
  imageClassName?: string;
  badge?: string;
  comingSoon?: boolean;
  featured?: boolean;
  prefersReducedMotion?: boolean;
}

const HubCard = ({
  badge,
  comingSoon,
  ctaLabel,
  description,
  eyebrow,
  featured = false,
  footerLabel,
  highlights,
  href,
  icon: Icon,
  iconClass,
  imageClassName,
  imageSrc,
  prefersReducedMotion = false,
  title,
  toneClass,
}: HubCardProps) => {
  const navigate = useNavigate();

  const handleOpen = () => {
    if (!comingSoon) {
      navigate(href);
    }
  };

  return (
    <motion.div
      whileHover={
        comingSoon || prefersReducedMotion
          ? undefined
          : { scale: 1.012, y: -6 }
      }
      whileTap={
        comingSoon || prefersReducedMotion ? undefined : { scale: 0.992 }
      }
      className="h-full"
    >
      <Card
        role={comingSoon ? undefined : "link"}
        tabIndex={comingSoon ? -1 : 0}
        className={cn(
          "group relative isolate h-full overflow-hidden rounded-[30px] border p-0 transition-all duration-300",
          "shadow-[0_26px_52px_-34px_rgba(15,23,42,0.9)]",
          featured ? "min-h-[300px] sm:min-h-[318px]" : "min-h-[270px] sm:min-h-[286px]",
          comingSoon
            ? "cursor-not-allowed border-border/70 opacity-70"
            : "cursor-pointer border-border/70 hover:border-white/[0.15] hover:shadow-[0_34px_68px_-34px_rgba(15,23,42,0.98)]",
        )}
        onClick={handleOpen}
        onKeyDown={(event) => {
          if (comingSoon) {
            return;
          }

          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleOpen();
          }
        }}
      >
        <div className={cn("absolute inset-0", toneClass)} aria-hidden="true" />
        <div
          className={cn(
            "absolute inset-y-0 right-0 w-[74%] bg-cover bg-right-center opacity-60 transition-transform duration-500 ease-out will-change-transform group-hover:scale-[1.03] motion-reduce:transform-none",
            imageClassName,
          )}
          style={{ backgroundImage: `url(${imageSrc})` }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-[linear-gradient(112deg,rgba(2,6,23,0.96)_0%,rgba(2,6,23,0.9)_42%,rgba(2,6,23,0.58)_74%,rgba(2,6,23,0.84)_100%)]"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent_18%)]"
          aria-hidden="true"
        />
        <div className="absolute inset-x-0 top-0 h-px bg-white/10" aria-hidden="true" />
        <div
          className="absolute -right-3 top-3 h-32 w-32 rounded-full bg-white/[0.12] blur-3xl transition-opacity duration-500 group-hover:opacity-90"
          aria-hidden="true"
        />
        <div
          className="absolute bottom-4 left-4 h-16 w-16 rounded-full bg-primary/[0.12] blur-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          aria-hidden="true"
        />

        <div className="relative flex h-full flex-col">
          <CardHeader className={cn("pb-4", featured ? "p-5 sm:p-6" : "p-5")}>
            <div className="flex items-start justify-between gap-3">
              <div
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-[22px] border shadow-[0_18px_34px_-22px_rgba(45,212,191,0.75),inset_0_1px_0_rgba(255,255,255,0.08)] transition-transform duration-300 group-hover:scale-[1.03]",
                  iconClass,
                )}
              >
                <Icon className="h-6 w-6" />
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {comingSoon && (
                  <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-slate-200/75">
                    In preparation
                  </span>
                )}
                {badge && !comingSoon && (
                  <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-slate-100">
                    {badge}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300/70">
                {eyebrow}
              </p>
              <div className="max-w-[17rem] space-y-2 sm:max-w-[18rem]">
                <h2 className="text-xl font-display font-semibold tracking-tight text-white sm:text-[1.35rem]">
                  {title}
                </h2>
                <p className="text-sm leading-6 text-slate-200/80">
                  {description}
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className={cn("mt-auto p-5 pt-0", featured && "sm:px-6 sm:pb-6")}>
            <div className="rounded-[24px] border border-white/10 bg-black/25 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-[2px]">
              <div className="flex flex-wrap gap-2">
                {highlights.map((highlight) => (
                  <span
                    key={highlight}
                    className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-slate-200/80"
                  >
                    {highlight}
                  </span>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-slate-300/70">{footerLabel}</p>
                {!comingSoon && (
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-sm font-medium text-white transition-all duration-300 group-hover:border-white/20 group-hover:bg-white/[0.15]">
                    <span>{ctaLabel}</span>
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </div>
      </Card>
    </motion.div>
  );
};

const heroPanels = [
  {
    title: "Answers without the scramble",
    description: "Open one place for fast health guidance, quick activities, and calm backup plans when the day pivots.",
    icon: ShieldCheck,
    panelClass: "border-primary/[0.15] bg-primary/10",
    iconClass: "border-primary/20 bg-slate-950/45 text-primary",
  },
  {
    title: "Create something useful fast",
    description: "Turn a favorite theme or a bored moment into a printable page, activity, or saved resource in minutes.",
    icon: WandSparkles,
    panelClass: "border-emerald-300/[0.15] bg-emerald-400/10",
    iconClass: "border-emerald-300/20 bg-slate-950/45 text-emerald-200",
  },
  {
    title: "Keep the good ones ready",
    description: "Save favorites to CoParrent Creations so you can revisit, export, or share them without starting over.",
    icon: Library,
    panelClass: "border-slate-200/[0.12] bg-white/5",
    iconClass: "border-white/10 bg-slate-950/45 text-slate-100",
  },
] as const;

const featuredTools: Omit<HubCardProps, "prefersReducedMotion">[] = [
  {
    title: "Nurse Nancy",
    description: "Walk through symptoms, home-care questions, and age-aware guidance before deciding what the next step should be.",
    eyebrow: "Health support",
    footerLabel: "Best when you need calm direction fast.",
    highlights: ["Age-aware prompts", "Symptom guidance"],
    icon: Stethoscope,
    href: "/dashboard/kids-hub/nurse-nancy",
    ctaLabel: "Open check-in",
    toneClass: "bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.24),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.16),transparent_38%),linear-gradient(160deg,rgba(15,23,42,0.78),rgba(8,47,73,0.88))]",
    iconClass: "border-primary/20 bg-primary/10 text-primary",
    imageSrc: "/kids-hub/NurseNancyToolCard.webp",
    imageClassName: "bg-[position:88%_center]",
    badge: "Fastest help",
    featured: true,
  },
  {
    title: "Coloring Page Creator",
    description: "Turn a favorite topic into a polished printable page when you need a calm reset, a wait-time activity, or a quick win.",
    eyebrow: "Creative reset",
    footerLabel: "Made for quick phone-to-printer moments.",
    highlights: ["Printable pages", "Custom themes"],
    icon: Palette,
    href: "/dashboard/kids-hub/coloring-pages",
    ctaLabel: "Create page",
    toneClass: "bg-[radial-gradient(circle_at_top_right,rgba(132,204,22,0.22),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(45,212,191,0.14),transparent_35%),linear-gradient(160deg,rgba(15,23,42,0.8),rgba(22,101,52,0.78))]",
    iconClass: "border-emerald-300/20 bg-emerald-400/10 text-emerald-200",
    imageSrc: "/kids-hub/ColoringPagesToolCard.webp",
    imageClassName: "bg-[position:86%_center]",
    badge: "Printable",
    featured: true,
  },
];

const supportTools: Omit<HubCardProps, "prefersReducedMotion">[] = [
  {
    title: "Activity Generator",
    description: "Generate age-fit activities, snacks, crafts, and boredom fixes that feel useful for the moment instead of generic.",
    eyebrow: "Planning and routines",
    footerLabel: "Use it when you need a quick, realistic plan.",
    highlights: ["Age-fit ideas", "Low-prep options"],
    icon: BookOpen,
    href: "/dashboard/kids-hub/activities",
    ctaLabel: "Plan activity",
    toneClass: "bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.18),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(45,212,191,0.18),transparent_35%),linear-gradient(160deg,rgba(15,23,42,0.82),rgba(30,41,59,0.9))]",
    iconClass: "border-sky-300/20 bg-sky-400/10 text-sky-200",
    imageSrc: "/kids-hub/ActivityToolCard.webp",
    imageClassName: "bg-[position:88%_center]",
    badge: "Quick ideas",
  },
  {
    title: "Creations Library",
    description: "Keep every saved coloring page and activity together so favorites stay easy to reopen, share deliberately, and export later.",
    eyebrow: "Saved and shareable",
    footerLabel: "Your private-by-default Kids Hub library.",
    highlights: ["Saved privately", "Export-ready"],
    icon: Library,
    href: "/dashboard/kids-hub/creations",
    ctaLabel: "Browse library",
    toneClass: "bg-[radial-gradient(circle_at_top_right,rgba(148,163,184,0.2),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(45,212,191,0.12),transparent_38%),linear-gradient(160deg,rgba(15,23,42,0.9),rgba(30,41,59,0.88))]",
    iconClass: "border-slate-300/20 bg-slate-200/10 text-slate-100",
    imageSrc: "/kids-hub/CreationLibraryToolCard.webp",
    imageClassName: "bg-[position:90%_center]",
    badge: "Saved hub",
  },
];

const KidsHubContent = () => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="space-y-8 pb-3 sm:space-y-10 sm:pb-6 lg:pb-8">
      <motion.section
        initial={prefersReducedMotion ? undefined : { opacity: 0, y: 12 }}
        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
        className="relative isolate overflow-hidden rounded-[34px] border border-primary/[0.15] bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.14),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(10,16,27,0.92))] p-5 shadow-[0_28px_70px_-38px_rgba(15,23,42,0.92)] sm:p-6"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-white/10" />
        <div
          className="absolute inset-y-0 right-0 w-full bg-cover bg-[position:76%_center] opacity-30 sm:w-[58%] sm:opacity-55"
          style={{ backgroundImage: "url(/kids-hub/KidsHubHero1.webp)" }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-[linear-gradient(108deg,rgba(2,6,23,0.96)_0%,rgba(2,6,23,0.9)_36%,rgba(2,6,23,0.72)_62%,rgba(2,6,23,0.88)_100%)]" />
        <div className="absolute left-4 top-5 h-28 w-28 rounded-full bg-primary/20 blur-3xl sm:left-6 sm:h-36 sm:w-36" />
        <div className="absolute bottom-0 right-0 h-32 w-32 rounded-full bg-accent/[0.15] blur-3xl sm:h-44 sm:w-44" />
        {!prefersReducedMotion && (
          <motion.div
            aria-hidden="true"
            animate={{ opacity: [0.24, 0.38, 0.24], x: [0, 10, 0], y: [0, -6, 0] }}
            className="absolute right-[12%] top-[14%] h-24 w-24 rounded-full bg-white/[0.15] blur-3xl"
            transition={{ duration: 14, ease: "easeInOut", repeat: Infinity }}
          />
        )}

        <div className="relative grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)] xl:gap-6">
          <div className="space-y-4 sm:space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground/80">
                Power plan family toolkit
              </div>
              <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-primary-foreground/70">
                Phone-ready support
              </div>
            </div>

            <div className="space-y-3">
              <h1 className="max-w-3xl text-[2rem] font-display font-bold tracking-tight text-white sm:text-4xl lg:text-[2.95rem]">
                Kids Hub keeps the next helpful thing close at hand.
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-200/80 sm:text-base">
                Reach for health guidance, printable calm, and saved family-ready ideas in one place designed to feel steady under pressure and easy to reopen later.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                asChild
                className="h-10 rounded-full bg-white px-4 text-slate-950 shadow-[0_18px_40px_-24px_rgba(255,255,255,0.9)] hover:bg-white/90"
                size="sm"
              >
                <Link to="/dashboard/kids-hub/nurse-nancy">
                  Start a health check-in
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                className="h-10 rounded-full border-white/[0.15] bg-white/[0.08] px-4 text-white hover:bg-white/[0.12]"
                size="sm"
                variant="outline"
              >
                <Link to="/dashboard/kids-hub/creations">Open saved creations</Link>
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {heroPanels.map(({ description, icon: Icon, iconClass, panelClass, title }) => (
                <div
                  key={title}
                  className={cn(
                    "rounded-[24px] border p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-sm sm:p-4",
                    panelClass,
                  )}
                >
                  <div
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-2xl border shadow-[0_16px_30px_-24px_rgba(45,212,191,0.6),inset_0_1px_0_rgba(255,255,255,0.05)]",
                      iconClass,
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="mt-3 text-base font-semibold text-white">{title}</h2>
                  <p className="mt-1.5 text-sm leading-6 text-slate-300/75">{description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-[28px] border border-white/10 bg-white/[0.06] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-sm sm:p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300/70">
                What it replaces
              </p>
              <p className="mt-3 text-lg font-semibold text-white">Less tab-hopping, less starting over</p>
              <p className="mt-2 text-sm leading-6 text-slate-300/70">
                Instead of jumping between searches, print dialogs, and saved files, Kids Hub keeps guidance, generation, and saved creations in one calm flow.
              </p>
            </div>
            <div className="rounded-[28px] border border-white/10 bg-slate-950/35 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm sm:p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300/70">
                Best moments to open it
              </p>
              <ul className="mt-3 space-y-3 text-sm leading-6 text-slate-300/70">
                <li>When you need a quick activity that feels thoughtful, not random.</li>
                <li>When you want a cleaner first step before calling or messaging about a health concern.</li>
                <li>When you already made something good and want it easy to find again.</li>
              </ul>
            </div>
          </div>
        </div>
      </motion.section>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Start with something useful
            </p>
            <h2 className="mt-2 text-2xl font-display font-semibold tracking-tight text-foreground">
              Fast wins for the moments that need help now
            </h2>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            These tools are built for quick clarity on a phone, with enough polish that the result still feels intentional.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {featuredTools.map((tool) => (
            <HubCard key={tool.title} prefersReducedMotion={prefersReducedMotion} {...tool} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Keep the momentum
            </p>
            <h2 className="mt-2 text-2xl font-display font-semibold tracking-tight text-foreground">
              Build routines, then keep the best outputs close
            </h2>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Activity planning and saved creations work best together when you want the page to feel like a toolkit instead of a menu.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          {supportTools.map((tool) => (
            <HubCard key={tool.title} prefersReducedMotion={prefersReducedMotion} {...tool} />
          ))}
        </div>
      </section>

      <motion.section
        initial={prefersReducedMotion ? undefined : { opacity: 0, y: 12 }}
        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
        transition={prefersReducedMotion ? undefined : { delay: 0.05 }}
      >
        <Card className="relative overflow-hidden rounded-[30px] border border-primary/[0.15] bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.14),transparent_30%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(17,24,39,0.92))] p-0 shadow-[0_24px_50px_-34px_rgba(15,23,42,0.95)]">
          <div
            className="absolute inset-y-0 right-0 hidden w-[36%] bg-cover bg-[position:88%_center] opacity-35 lg:block"
            style={{ backgroundImage: "url(/kids-hub/CreationLibraryToolCard.webp)" }}
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(2,6,23,0.96)_0%,rgba(2,6,23,0.9)_56%,rgba(2,6,23,0.68)_100%)]" />
          <CardContent className="relative grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.2fr)_auto] lg:items-center">
            <div className="absolute inset-x-0 top-0 h-px bg-white/10" aria-hidden="true" />
            <div className="relative flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300/70">
                  CoParrent Creations
                </p>
                <h3 className="mt-2 text-xl font-display font-semibold text-white">
                  Save the good ones once, then keep them ready.
                </h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200/80">
                  Activities and coloring pages do more for you when they stay organized. Creations Library keeps the strongest outputs private by default, easy to reopen, simple to export, and ready to share when you choose.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-slate-200/75">
                    Saved privately by default
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-slate-200/75">
                    Export polished PDFs
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-slate-200/75">
                    Reopen favorites fast
                  </span>
                </div>
              </div>
            </div>

            <div className="relative">
              <Button asChild className="h-11 rounded-full bg-white text-slate-950 hover:bg-white/90">
                <Link to="/dashboard/kids-hub/creations">
                  Open Creations Library
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.section>
    </div>
  );
};

const KidsHubPage = () => {
  return (
    <DashboardLayout>
      {/* Role gate: block third-party and child accounts */}
      <RoleGate requireParent restrictedMessage="Kids Hub is only available to parents and guardians.">
        {/* Premium gate: require Power plan */}
        <PremiumFeatureGate featureName="Kids Hub">
          <KidsHubContent />
        </PremiumFeatureGate>
      </RoleGate>
    </DashboardLayout>
  );
};

export default KidsHubPage;
