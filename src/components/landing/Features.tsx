import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Calendar, MessageSquare, Users, FileText, DollarSign, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/SectionCard";
import { SectionHeader } from "@/components/ui/SectionHeader";

/**
 * Features Section - System Overview
 * 
 * Design Intent:
 * - Group by user intent, not engineering category
 * - Make it obvious this is a cohesive system
 * - Clear visual rhythm and intentional spacing
 * - Purpose-built feel, not borrowed components
 * 
 * CORRECTIONS (Post-Review):
 * - Fixed: Using hardcoded HSL colors in style props - now uses semantic tokens where possible
 * - Fixed: Hover underline color was inline HSL - removed in favor of CSS class
 * - Simplified: Icon backgrounds use primary color variants for consistency
 */

const coreCapabilities = [
  {
    icon: Calendar,
    title: "Scheduling",
    description: "Visual custody calendars with pattern-based scheduling, exchange tracking, and change request workflows.",
    accent: "primary",
  },
  {
    icon: MessageSquare,
    title: "Communication",
    description: "Timestamped messaging with read receipts, tone assistance, and complete conversation history for records.",
    accent: "info",
  },
  {
    icon: Users,
    title: "Child Records",
    description: "Centralized medical info, school details, and emergency contacts—shared and always up to date.",
    accent: "success",
  },
  {
    icon: FileText,
    title: "Documentation",
    description: "Secure document storage with audit trails and court-ready PDF exports of all records.",
    accent: "primary",
  },
  {
    icon: DollarSign,
    title: "Expenses",
    description: "Shared expense tracking with reimbursement workflows, receipt uploads, and exportable reports.",
    accent: "warning",
  },
];

// Map accent names to Tailwind classes for proper theming
const accentClasses = {
  primary: { bg: "bg-primary/10", text: "text-primary", line: "bg-primary" },
  info: { bg: "bg-info/10", text: "text-info", line: "bg-info" },
  success: { bg: "bg-success/10", text: "text-success", line: "bg-success" },
  warning: { bg: "bg-warning/10", text: "text-warning", line: "bg-warning" },
};

export const Features = () => {
  return (
    <section className="relative px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
      <div className="page-shell-public">
        {/* Section Header - Direct, Authoritative */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto mb-14 max-w-3xl lg:mb-16"
        >
          <SectionHeader
            align="center"
            eyebrow="The Platform"
            eyebrowTone="pill"
            title="Everything in one place"
            description="A complete system for coordinating custody, schedules, messages, expenses, and records, designed to reduce conflict and create clarity."
            descriptionClassName="sm:text-lg"
          />
        </motion.div>

        {/* Capabilities Grid - Structured, Cohesive */}
        <div className="mb-12 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {coreCapabilities.map((capability, index) => {
            const classes = accentClasses[capability.accent as keyof typeof accentClasses];
            
            return (
              <motion.div
                key={capability.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
              >
                <SectionCard variant="standard" interactive className="group relative overflow-hidden p-6 lg:p-7">
                  <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  <div className={`mb-5 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-current/5 ${classes.bg}`}>
                    <capability.icon className={`h-5 w-5 ${classes.text}`} />
                  </div>

                  <h3 className="mb-2 text-lg font-display font-semibold transition-colors group-hover:text-primary">
                    {capability.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {capability.description}
                  </p>

                  <div className={`absolute bottom-0 left-6 right-6 h-0.5 origin-left scale-x-0 rounded-full transition-transform duration-300 group-hover:scale-x-100 ${classes.line}`} />
                </SectionCard>
              </motion.div>
            );
          })}
        </div>

        {/* CTA - Clear Next Step */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <Button asChild variant="outline" size="lg" className="group">
            <Link to="/features" className="flex items-center gap-2">
              Explore All Features
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
};
