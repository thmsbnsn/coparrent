import { motion } from "framer-motion";
import { 
  Calendar, 
  MessageSquare, 
  Users, 
  FileText, 
  DollarSign, 
  BookOpen, 
  Scale, 
  Trophy,
  CheckCircle,
  ArrowRight,
  FlaskConical,
  Crown,
  Shield,
  Clock,
  Zap
} from "lucide-react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * Features Page - System Overview
 * 
 * Design Intent:
 * - Group features by USER INTENT, not engineering category
 * - Make it obvious this is a cohesive SYSTEM, not a checklist
 * - Clear visual hierarchy across all breakpoints
 * - Professional, court-ready credibility
 * 
 * CORRECTIONS (Post-Review):
 * - Fixed: Screenshots are placeholders - noted for future asset replacement
 * - Fixed: "Designed for peace" could feel soft to stressed parent - kept but grounded by structure
 * - Fixed: Mobile category headers need stronger visual weight
 */

// Feature screenshots
import calendarFeature from "@/assets/features/calendar-feature.png";
import messagingFeature from "@/assets/features/messaging-feature.png";
import childrenFeature from "@/assets/features/children-feature.png";
import documentsFeature from "@/assets/features/documents-feature.png";
import expensesFeature from "@/assets/features/expenses-feature.png";
import journalFeature from "@/assets/features/journal-feature.png";
import lawLibraryFeature from "@/assets/features/law-library-feature.png";
import professionalFeature from "@/assets/features/professional-feature.png";

type FeatureTier = "free" | "premium";

interface Feature {
  text: string;
  tier?: FeatureTier;
  beta?: boolean;
}

interface FeatureGroup {
  id: string;
  category: string;
  icon: typeof Calendar;
  title: string;
  description: string;
  features: Feature[];
  image: string;
  tier: FeatureTier;
  beta?: boolean;
}

// Organized by USER INTENT
const featureGroups: FeatureGroup[] = [
  // ORGANIZE YOUR TIME
  {
    id: "calendar",
    category: "Organize Your Time",
    icon: Calendar,
    title: "Smart Parenting Calendar",
    description: "Build custody schedules that work. Visual calendars with pattern-based scheduling, exchange tracking, and change request workflows.",
    features: [
      { text: "Visual custody schedules with parent color-coding" },
      { text: "Pattern templates: 2-2-3, week-on/week-off, custom" },
      { text: "Schedule change requests with approval workflows" },
      { text: "Exchange check-ins and confirmations" },
      { text: "Holiday schedule overrides", tier: "premium" },
    ],
    image: calendarFeature,
    tier: "free",
  },
  {
    id: "sports",
    category: "Organize Your Time",
    icon: Trophy,
    title: "Sports & Activities Hub",
    description: "Coordinate activities, practices, and games. Keep both parents informed about equipment, coaches, and logistics.",
    features: [
      { text: "Activity and event management" },
      { text: "Coach contact information" },
      { text: "Equipment checklists" },
      { text: "Pickup/dropoff coordination" },
      { text: "Event reminders", beta: true },
    ],
    image: professionalFeature,
    tier: "premium",
    beta: true,
  },
  // COMMUNICATE CLEARLY
  {
    id: "messaging",
    category: "Communicate Clearly",
    icon: MessageSquare,
    title: "Documented Messaging",
    description: "Every conversation preserved, timestamped, and exportable. Professional communication with complete records.",
    features: [
      { text: "Timestamped messages with delivery confirmation" },
      { text: "Read receipts for accountability" },
      { text: "Complete, searchable conversation history" },
      { text: "AI tone assistance for constructive dialogue", tier: "premium", beta: true },
      { text: "Court-ready message exports", tier: "premium" },
    ],
    image: messagingFeature,
    tier: "free",
  },
  // MANAGE RECORDS
  {
    id: "children",
    category: "Manage Records",
    icon: Users,
    title: "Children Information Hub",
    description: "Centralize everything about your children. Medical info, school details, and emergency contacts—shared and always current.",
    features: [
      { text: "Medical information and medication tracking" },
      { text: "School schedules and contact details" },
      { text: "Emergency contacts and procedures" },
      { text: "Shared access with permission controls" },
    ],
    image: childrenFeature,
    tier: "free",
  },
  {
    id: "documents",
    category: "Manage Records",
    icon: FileText,
    title: "Secure Document Vault",
    description: "Store and organize important documents. Audit trails, access logging, and court-ready exports when you need them.",
    features: [
      { text: "Encrypted document storage" },
      { text: "Category organization by type" },
      { text: "Access logging and audit trails", tier: "premium" },
      { text: "Court-ready PDF exports", tier: "premium" },
      { text: "Shared access between co-parents" },
    ],
    image: documentsFeature,
    tier: "free",
  },
  {
    id: "journal",
    category: "Manage Records",
    icon: BookOpen,
    title: "Journal & Notes",
    description: "Private records of observations, moods, and exchange notes. Your personal documentation for peace of mind.",
    features: [
      { text: "Private journal entries" },
      { text: "Child mood tracking" },
      { text: "Exchange-linked notes" },
      { text: "Tag-based organization" },
      { text: "Searchable history" },
    ],
    image: journalFeature,
    tier: "free",
  },
  // HANDLE FINANCES
  {
    id: "expenses",
    category: "Handle Finances",
    icon: DollarSign,
    title: "Expense Tracking",
    description: "Track shared costs and manage reimbursements fairly. Clear records of who paid what and who owes whom.",
    features: [
      { text: "Shared expense tracking by category" },
      { text: "Reimbursement request workflows" },
      { text: "Split percentage calculations" },
      { text: "Receipt uploads and attachments" },
      { text: "Exportable expense reports", tier: "premium" },
    ],
    image: expensesFeature,
    tier: "premium",
  },
  // UNDERSTAND YOUR RIGHTS
  {
    id: "law-library",
    category: "Understand Your Rights",
    icon: Scale,
    title: "Law Library",
    description: "State-specific family law resources for reference. Educational materials to help you understand custody guidelines.",
    features: [
      { text: "State-specific legal resources" },
      { text: "Custody and visitation guidelines" },
      { text: "Educational reference documents" },
      { text: "Regularly updated content" },
    ],
    image: lawLibraryFeature,
    tier: "free",
  },
];

// Group features by category
const categories = [...new Set(featureGroups.map(f => f.category))];

const TierBadge = ({ tier, beta }: { tier: FeatureTier; beta?: boolean }) => {
  if (beta) {
    return (
      <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/20">
        <FlaskConical className="w-3 h-3 mr-1" />
        Beta
      </Badge>
    );
  }
  
  if (tier === "premium") {
    return (
      <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
        <Crown className="w-3 h-3 mr-1" />
        Power
      </Badge>
    );
  }
  
  return null;
};

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section - Direct, Authoritative */}
      <section className="pt-28 pb-12 lg:pt-36 lg:pb-16 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6"
            >
              <Shield className="w-4 h-4" />
              Complete Co-Parenting Platform
            </motion.div>
            
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mb-5"
            >
              Built for clarity.<br />Designed for peace.
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8"
            >
              Every feature works together to reduce conflict, document decisions, 
              and keep your children's needs at the center of every interaction.
            </motion.p>
            
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-col sm:flex-row gap-3 justify-center"
            >
              <Button asChild size="lg">
                <Link to="/signup">Get Started Free</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/pricing">View Pricing</Link>
              </Button>
            </motion.div>
            
            {/* Legend */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-8 flex flex-wrap justify-center gap-6 text-sm text-muted-foreground"
            >
              <span className="flex items-center gap-2">
                <TierBadge tier="premium" />
                <span>Power plan</span>
              </span>
              <span className="flex items-center gap-2">
                <TierBadge tier="free" beta />
                <span>In development</span>
              </span>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Feature Sections - Grouped by Intent */}
      <section className="py-16 lg:py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          {categories.map((category, catIndex) => {
            const categoryFeatures = featureGroups.filter(f => f.category === category);
            
            return (
              <div key={category} className="mb-20 lg:mb-28 last:mb-0">
                {/* Category Header - FIX: Stronger visual weight for mobile hierarchy */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="mb-10 lg:mb-14"
                >
                  {/* FIX: Increased text size and weight for better mobile hierarchy */}
                  <span className="inline-block text-sm sm:text-xs font-bold sm:font-semibold text-primary uppercase tracking-widest mb-2">
                    {category}
                  </span>
                  {/* FIX: Wider underline for stronger visual anchor */}
                  <div className="w-16 sm:w-12 h-0.5 bg-primary/40 rounded-full" />
                </motion.div>

                {/* Features in Category */}
                <div className="space-y-16 lg:space-y-24">
                  {categoryFeatures.map((feature, index) => (
                    <motion.div
                      key={feature.id}
                      initial={{ opacity: 0, y: 24 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.1 }}
                      className={`flex flex-col ${index % 2 === 1 ? 'lg:flex-row-reverse' : 'lg:flex-row'} gap-10 lg:gap-16 items-center`}
                    >
                      {/* Content */}
                      <div className="flex-1 max-w-xl">
                        <div className="flex items-center gap-3 mb-5">
                          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
                            <feature.icon className="w-6 h-6 text-primary" />
                          </div>
                          <TierBadge tier={feature.tier} beta={feature.beta} />
                        </div>
                        
                        <h2 className="text-2xl sm:text-3xl font-display font-bold mb-3">
                          {feature.title}
                        </h2>
                        
                        <p className="text-muted-foreground mb-6 leading-relaxed">
                          {feature.description}
                        </p>
                        
                        <ul className="space-y-2.5">
                          {feature.features.map((item, i) => (
                            <li key={i} className="flex items-start gap-3">
                              <CheckCircle className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                              <span className="text-foreground/80 flex items-center gap-2 flex-wrap">
                                {item.text}
                                {item.tier === "premium" && (
                                  <Badge variant="outline" className="text-xs bg-primary/5 text-primary/80 border-primary/15">
                                    Power
                                  </Badge>
                                )}
                                {item.beta && (
                                  <Badge variant="outline" className="text-xs bg-warning/5 text-warning/80 border-warning/15">
                                    Beta
                                  </Badge>
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Screenshot */}
                      <div className="flex-1 w-full max-w-lg">
                        <div className="relative rounded-2xl overflow-hidden border border-border bg-card shadow-lg">
                          <div className="aspect-[4/3]">
                            <img 
                              src={feature.image} 
                              alt={`${feature.title} screenshot`}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 lg:py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl mx-auto text-center"
          >
            <div className="flex items-center justify-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-white/80" />
              <span className="text-sm font-medium text-white/80">Start in minutes</span>
            </div>
            <h2 className="text-white mb-4">
              Ready to bring clarity to co-parenting?
            </h2>
            <p className="text-white/70 mb-8 text-lg">
              Free plan includes everything you need to get started. 
              Upgrade when you're ready.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild size="lg" variant="secondary">
                <Link to="/signup">Get Started Free</Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="text-white hover:bg-white/10">
                <Link to="/pricing" className="flex items-center gap-2">
                  View Pricing
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
