import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { 
  Search, 
  Rocket, 
  Calendar, 
  MessageSquare, 
  FileText, 
  DollarSign, 
  Scale, 
  User, 
  Shield,
  ChevronRight,
  Mail,
  ArrowRight,
  BookOpen,
  LifeBuoy,
  Sparkles,
} from "lucide-react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Help Center - Guided Clarity
 * 
 * Design Intent:
 * - "Guided clarity" not "support center"
 * - Reduce cognitive load
 * - Make escalation paths obvious and calm
 * - Professional, reassuring structure
 * 
 * CORRECTIONS (Post-Review):
 * - Fixed: "How can we help?" feels generic SaaS - kept but context is professional
 * - Note: Category cards are appropriately grounded
 * - Note: Contact section is calm, not overly "friendly"
 */

const helpCategories = [
  {
    icon: Rocket,
    title: "Getting Started",
    description: "Account setup and basics",
    href: "/help/getting-started",
    keywords: ["setup", "onboarding", "start", "invite"],
  },
  {
    icon: Calendar,
    title: "Scheduling",
    description: "Custody calendars and exchanges",
    href: "/help/scheduling",
    keywords: ["calendar", "exchange", "pattern", "schedule", "change request"],
  },
  {
    icon: MessageSquare,
    title: "Messaging",
    description: "Communication and records",
    href: "/help/messaging",
    keywords: ["chat", "messages", "communication", "records"],
  },
  {
    icon: FileText,
    title: "Documents",
    description: "Storage and exports",
    href: "/help/documents",
    keywords: ["files", "exports", "pdf", "storage"],
  },
  {
    icon: DollarSign,
    title: "Expenses",
    description: "Tracking and reimbursements",
    href: "/help/expenses",
    keywords: ["money", "reimbursements", "receipts", "payments"],
  },
  {
    icon: Scale,
    title: "Court Use",
    description: "Legal documentation",
    href: "/court-records",
    keywords: ["court", "legal", "records", "export"],
  },
  {
    icon: User,
    title: "Account",
    description: "Billing and settings",
    href: "/help/account",
    keywords: ["billing", "subscription", "profile", "settings"],
  },
  {
    icon: Shield,
    title: "Security",
    description: "Privacy and protection",
    href: "/help/privacy",
    keywords: ["privacy", "security", "data", "protection"],
  },
];

const popularArticles = [
  {
    title: "How records work for court proceedings",
    href: "/court-records",
    category: "Court Use",
  },
  {
    title: "What happens when a trial ends",
    href: "/help/account/trial-ending",
    category: "Account",
  },
  {
    title: "How schedule change requests work",
    href: "/help/scheduling/change-requests",
    category: "Scheduling",
  },
  {
    title: "Inviting a co-parent or step-parent",
    href: "/help/getting-started/invitations",
    category: "Getting Started",
  },
  {
    title: "Exporting messages and documents",
    href: "/help/documents/exports",
    category: "Documents",
  },
  {
    title: "Understanding custody schedule patterns",
    href: "/help/scheduling/patterns",
    category: "Scheduling",
  },
];

const quickPaths = [
  {
    icon: Rocket,
    title: "Set up a family",
    description: "Start with children, schedules, and invitations.",
    href: "/help/getting-started",
  },
  {
    icon: Sparkles,
    title: "Find record and export answers",
    description: "See how messaging, documents, and court-ready records work.",
    href: "/court-records",
  },
  {
    icon: LifeBuoy,
    title: "Get direct support",
    description: "Billing, account access, and high-priority help routes.",
    href: "/help/contact",
  },
];

const supportExpectations = [
  "Setup, navigation, billing, exports, and account access questions",
  "Guidance on where records, messages, and documents live in CoParrent",
  "Clear routing when you need product help instead of searching across the app",
];

const trustGuidance = [
  {
    title: "Product help, not legal advice",
    description: "We explain how CoParrent works and where records live, but we do not replace legal counsel or personal judgment.",
  },
  {
    title: "Records and exports stay explicit",
    description: "If you are looking for messages, documents, or court-ready exports, we point you to the exact product surface instead of vague summaries.",
  },
  {
    title: "Support should feel predictable",
    description: "This page is meant to reduce guesswork so setup, billing, privacy, and record questions have a clear first stop.",
  },
];

const HelpCenter = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const searchResults = useMemo(() => {
    if (!normalizedQuery) return [];

    const categoryResults = helpCategories
      .filter((category) => {
        const haystack = [
          category.title,
          category.description,
          ...category.keywords,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .map((category) => ({
        title: category.title,
        description: category.description,
        href: category.href,
        label: "Topic",
      }));

    const articleResults = popularArticles
      .filter((article) =>
        [article.title, article.category].join(" ").toLowerCase().includes(normalizedQuery)
      )
      .map((article) => ({
        title: article.title,
        description: article.category,
        href: article.href,
        label: "Article",
      }));

    const merged = [...categoryResults, ...articleResults];

    return merged.filter(
      (item, index) => merged.findIndex((candidate) => candidate.href === item.href) === index
    );
  }, [normalizedQuery]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="pt-24 lg:pt-32 pb-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          {/* Hero - Clear Purpose */}
          <div className="max-w-3xl mx-auto text-center mb-12 lg:mb-14">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-3"
            >
              <BookOpen className="w-4 h-4" />
              Help Center
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="mb-5"
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground">
                <Shield className="h-3.5 w-3.5 text-primary" />
                Updated April 2026
              </span>
            </motion.div>
            
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mb-4"
            >
              Find the right answer fast.
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="text-muted-foreground mb-8 text-lg"
            >
              Browse setup guides, scheduling help, record questions, billing answers,
              and direct support paths without guessing where to start.
            </motion.p>

            {/* Search */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="relative max-w-lg mx-auto"
            >
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search setup, messages, billing, records..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-4 h-12 text-base rounded-xl"
              />
            </motion.div>
          </div>

          {normalizedQuery ? (
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="max-w-3xl mx-auto mb-16 lg:mb-20"
            >
              <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-display font-semibold">Search results</h2>
                  <p className="text-sm text-muted-foreground">
                    {searchResults.length} result{searchResults.length === 1 ? "" : "s"} for "{searchQuery.trim()}"
                  </p>
                </div>
                <Button variant="ghost" onClick={() => setSearchQuery("")}>
                  Clear search
                </Button>
              </div>

              {searchResults.length > 0 ? (
                <div className="grid gap-3">
                  {searchResults.map((result) => (
                    <Link
                      key={result.href}
                      to={result.href}
                      className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 hover:border-primary/30 hover:bg-muted/30 transition-all group"
                    >
                      <div className="min-w-0">
                        <span className="text-xs font-semibold uppercase tracking-widest text-primary/80 block mb-2">
                          {result.label}
                        </span>
                        <h3 className="font-display font-semibold group-hover:text-primary transition-colors">
                          {result.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">{result.description}</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-border bg-card p-8 text-center">
                  <h3 className="text-lg font-display font-semibold mb-2">No direct matches</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">
                    Try a broader term like schedule, messaging, billing, records, or privacy.
                    If you still cannot find it, use the contact path below.
                  </p>
                  <Button asChild>
                    <Link to="/help/contact">Contact Support</Link>
                  </Button>
                </div>
              )}
            </motion.section>
          ) : (
            <>
              <motion.section
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28 }}
                className="max-w-5xl mx-auto mb-12 lg:mb-14"
              >
                <h2 className="text-lg font-display font-semibold text-center mb-6">
                  Start with the most common paths
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {quickPaths.map((path) => (
                    <Link key={path.title} to={path.href}>
                      <div className="h-full rounded-2xl border border-border bg-card p-5 hover:border-primary/30 hover:shadow-md transition-all group">
                        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                          <path.icon className="w-5 h-5 text-primary" />
                        </div>
                        <h3 className="font-display font-semibold mb-2 group-hover:text-primary transition-colors">
                          {path.title}
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">{path.description}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </motion.section>

              {/* Categories - Clean Grid */}
              <motion.section
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.34 }}
                className="max-w-4xl mx-auto mb-16 lg:mb-20"
              >
                <h2 className="text-lg font-display font-semibold text-center mb-6">
                  Browse by topic
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4">
                  {helpCategories.map((category) => (
                    <Link key={category.title} to={category.href}>
                      <div className="h-full p-4 lg:p-5 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-md transition-all duration-200 group">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/15 transition-colors">
                          <category.icon className="w-5 h-5 text-primary" />
                        </div>
                        <h3 className="font-display font-semibold text-sm mb-1 group-hover:text-primary transition-colors">
                          {category.title}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {category.description}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </motion.section>

              {/* Popular Articles - Scannable List */}
              <motion.section
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="max-w-2xl mx-auto mb-16 lg:mb-20"
              >
                <h2 className="text-lg font-display font-semibold text-center mb-6">
                  Popular articles
                </h2>
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  {popularArticles.map((article, index) => (
                    <Link
                      key={article.title}
                      to={article.href}
                      className={`flex items-center justify-between p-4 hover:bg-muted/50 transition-colors group ${
                        index !== 0 ? "border-t border-border" : ""
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-muted-foreground block mb-1">
                          {article.category}
                        </span>
                        <span className="font-medium text-sm group-hover:text-primary transition-colors line-clamp-1">
                          {article.title}
                        </span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary flex-shrink-0 ml-3 transition-colors" />
                    </Link>
                  ))}
                </div>
              </motion.section>

              <motion.section
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.46 }}
                className="max-w-5xl mx-auto mb-16 lg:mb-20"
              >
                <div className="rounded-[2rem] border border-border/70 bg-card/85 p-6 shadow-[0_24px_48px_-36px_rgba(8,21,47,0.4)] lg:p-8">
                  <div className="max-w-2xl">
                    <h2 className="text-xl font-display font-semibold">What to expect from support</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      CoParrent support is here to make product setup, records, exports, billing, and account access easier to understand. This page is meant to give you a calm first stop before you need to reach out.
                    </p>
                  </div>

                  <div className="mt-6 grid gap-3 md:grid-cols-3">
                    {supportExpectations.map((item) => (
                      <div
                        key={item}
                        className="rounded-[1.5rem] border border-border/70 bg-background/70 p-4"
                      >
                        <p className="text-sm leading-6 text-foreground/88">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.section>
            </>
          )}

          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.48 }}
            className="max-w-5xl mx-auto mb-16 lg:mb-20"
          >
            <div className="grid gap-4 md:grid-cols-3">
              {trustGuidance.map((item) => (
                <div
                  key={item.title}
                  className="rounded-[1.75rem] border border-border/70 bg-card/80 p-5 shadow-[0_20px_40px_-34px_rgba(8,21,47,0.35)]"
                >
                  <p className="text-sm font-display font-semibold">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
          </motion.section>

          {/* Contact - Calm Escalation */}
          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="max-w-xl mx-auto text-center"
          >
            <div className="bg-muted/30 border border-border rounded-2xl p-8 lg:p-10">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
                <Mail className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-xl font-display font-bold mb-3">
                Need more help?
              </h2>
              <p className="text-muted-foreground text-sm mb-3 max-w-sm mx-auto">
                Can't find what you're looking for? Our team typically responds within one business day for product, billing, and account questions.
              </p>
              <p className="text-xs text-muted-foreground/85 mb-6 max-w-md mx-auto leading-5">
                If you are trying to understand records or exports for court use, include the exact product area you were using so support can point you to the right workflow faster.
              </p>
              <Button asChild size="lg" className="px-8">
                <Link to="/help/contact">
                  Contact Support
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
          </motion.section>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default HelpCenter;
