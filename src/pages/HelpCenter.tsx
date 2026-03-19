import { useState } from "react";
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
  BookOpen
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
  },
  {
    icon: Calendar,
    title: "Scheduling",
    description: "Custody calendars and exchanges",
    href: "/help/scheduling",
  },
  {
    icon: MessageSquare,
    title: "Messaging",
    description: "Communication and records",
    href: "/help/messaging",
  },
  {
    icon: FileText,
    title: "Documents",
    description: "Storage and exports",
    href: "/help/documents",
  },
  {
    icon: DollarSign,
    title: "Expenses",
    description: "Tracking and reimbursements",
    href: "/help/expenses",
  },
  {
    icon: Scale,
    title: "Court Use",
    description: "Legal documentation",
    href: "/court-records",
  },
  {
    icon: User,
    title: "Account",
    description: "Billing and settings",
    href: "/help/account",
  },
  {
    icon: Shield,
    title: "Security",
    description: "Privacy and protection",
    href: "/help/privacy",
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

const HelpCenter = () => {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="pt-24 lg:pt-32 pb-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          {/* Hero - Clear Purpose */}
          <div className="max-w-2xl mx-auto text-center mb-12 lg:mb-14">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-5"
            >
              <BookOpen className="w-4 h-4" />
              Help Center
            </motion.div>
            
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mb-4"
            >
              How can we help?
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="text-muted-foreground mb-8"
            >
              Find guides, answers, and support for every part of CoParrent.
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
                placeholder="Search for help..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-4 h-12 text-base rounded-xl"
              />
            </motion.div>
          </div>

          {/* Categories - Clean Grid */}
          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
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
                    index !== 0 ? 'border-t border-border' : ''
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
              <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
                Can't find what you're looking for? Our team typically responds within one business day.
              </p>
              <Button size="lg" className="px-8">
                Contact Support
                <ArrowRight className="w-4 h-4 ml-2" />
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
