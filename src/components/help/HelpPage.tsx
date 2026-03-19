import { ReactNode } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, ExternalLink, HelpCircle } from "lucide-react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RelatedLink {
  title: string;
  href: string;
  external?: boolean;
}

interface PrimaryAction {
  label: string;
  href: string;
}

interface HelpPageLayoutProps {
  category: string;
  title: string;
  description: string;
  children: ReactNode;
  relatedLinks?: RelatedLink[];
  primaryAction?: PrimaryAction;
  backHref?: string;
  headerIcon?: ReactNode;
}

export const HelpPageLayout = ({
  category,
  title,
  description,
  children,
  relatedLinks,
  primaryAction,
  backHref = "/help",
  headerIcon,
}: HelpPageLayoutProps) => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <main className="pt-20 lg:pt-24 pb-20">
      <div className="bg-gradient-to-b from-muted/50 to-background border-b border-border/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto py-8 lg:py-12">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
              <Link
                to={backHref}
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                Back to Help Center
              </Link>
            </motion.div>
            <motion.header initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <div className="flex items-start gap-4">
                {headerIcon ? (
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    {headerIcon}
                  </div>
                ) : null}
                <div className="flex-1">
                  <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-3">
                    {category}
                  </span>
                  <h1 className="text-2xl lg:text-3xl font-display font-bold mb-3 text-foreground">{title}</h1>
                  <p className="text-base lg:text-lg text-muted-foreground">{description}</p>
                </div>
              </div>
            </motion.header>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <motion.article
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="py-8 lg:py-10"
          >
            <div className="space-y-8">{children}</div>
          </motion.article>

          {primaryAction ? (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mb-10"
            >
              <Link to={primaryAction.href}>
                <Button size="lg" className="gap-2 shadow-lg hover:shadow-xl transition-shadow">
                  {primaryAction.label}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </motion.div>
          ) : null}

          {relatedLinks?.length ? (
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="border-t border-border pt-8 mb-10"
            >
              <h2 className="text-lg font-display font-semibold mb-4 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-primary" />
                Related articles
              </h2>
              <div className="grid gap-3">
                {relatedLinks.map((link) =>
                  link.external ? (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:border-primary/30 hover:bg-muted/30 transition-all group"
                    >
                      <span className="font-medium text-sm group-hover:text-primary transition-colors">{link.title}</span>
                      <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                    </a>
                  ) : (
                    <Link
                      key={link.href}
                      to={link.href}
                      className="flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:border-primary/30 hover:bg-muted/30 transition-all group"
                    >
                      <span className="font-medium text-sm group-hover:text-primary transition-colors">{link.title}</span>
                      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </Link>
                  )
                )}
              </div>
            </motion.section>
          ) : null}

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="p-6 lg:p-8 bg-gradient-to-br from-muted/50 to-muted/30 border border-border rounded-2xl text-center mb-10"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <HelpCircle className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-display font-semibold mb-2">Need more help?</h3>
            <p className="text-muted-foreground text-sm mb-4 max-w-sm mx-auto">
              Our support team typically responds within one business day.
            </p>
            <Link to="/help/contact">
              <Button variant="outline" size="sm" className="gap-2">
                Contact Support
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    </main>
    <Footer />
  </div>
);

type HelpCardVariant = "default" | "primary" | "warning" | "tip";

const cardVariants: Record<HelpCardVariant, string> = {
  default: "bg-card border-border",
  primary: "bg-primary/5 border-primary/20",
  warning: "bg-amber-500/5 border-amber-500/20",
  tip: "bg-emerald-500/5 border-emerald-500/20",
};

export const HelpCard = ({
  icon: Icon,
  title,
  children,
  variant = "default",
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  children: ReactNode;
  variant?: HelpCardVariant;
  className?: string;
}) => (
  <div className={cn("rounded-xl border p-5 transition-colors", cardVariants[variant], className)}>
    <div className="flex items-start gap-4">
      {Icon ? (
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
      ) : null}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-foreground mb-2">{title}</h3>
        <div className="text-sm text-muted-foreground">{children}</div>
      </div>
    </div>
  </div>
);

export const HelpGrid = ({
  columns = 2,
  className,
  children,
}: {
  columns?: 1 | 2 | 3;
  className?: string;
  children: ReactNode;
}) => {
  const columnsClass = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  };

  return <div className={cn("grid gap-4", columnsClass[columns], className)}>{children}</div>;
};

export const HelpStep = ({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) => (
  <div className="flex items-start gap-4">
    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
      <span className="text-sm font-bold text-primary">{number}</span>
    </div>
    <div className="flex-1 pt-0.5">
      <h4 className="font-semibold mb-1">{title}</h4>
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  </div>
);

export const HelpBanner = ({
  variant = "primary",
  className,
  children,
}: {
  variant?: "primary" | "success" | "warning";
  className?: string;
  children: ReactNode;
}) => {
  const variants = {
    primary: "bg-primary/5 border-primary/20 text-primary",
    success: "bg-emerald-500/5 border-emerald-500/20 text-emerald-700 dark:text-emerald-400",
    warning: "bg-amber-500/5 border-amber-500/20 text-amber-700 dark:text-amber-400",
  };

  return <div className={cn("rounded-xl border p-5 text-sm font-medium", variants[variant], className)}>{children}</div>;
};

export const HelpNotice = ({
  type,
  children,
  className,
}: {
  type: "safety" | "legal" | "info" | "important";
  children: ReactNode;
  className?: string;
}) => {
  const config = {
    safety: { bg: "bg-rose-500/5 border-rose-500/20", icon: "⚠️", title: "Safety Notice" },
    legal: { bg: "bg-slate-500/5 border-slate-500/20", icon: "⚖️", title: "Legal Disclaimer" },
    info: { bg: "bg-blue-500/5 border-blue-500/20", icon: "ℹ️", title: "Important Information" },
    important: { bg: "bg-amber-500/5 border-amber-500/20", icon: "📌", title: "Please Note" },
  }[type];

  return (
    <div className={cn("rounded-xl border p-5", config.bg, className)}>
      <div className="flex items-start gap-3">
        <span className="text-xl flex-shrink-0">{config.icon}</span>
        <div>
          <h4 className="font-semibold text-sm mb-1">{config.title}</h4>
          <div className="text-sm text-muted-foreground">{children}</div>
        </div>
      </div>
    </div>
  );
};
