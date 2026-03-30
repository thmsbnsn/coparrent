import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Calendar,
  FileCheck,
  FolderKanban,
  MessageSquare,
  Shield,
  Stethoscope,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import calendarFeature from "@/assets/features/calendar-feature.png";
import messagingFeature from "@/assets/features/messaging-feature.png";
import documentsFeature from "@/assets/features/documents-feature.png";

const proofCards = [
  {
    icon: Calendar,
    title: "Shared schedule clarity",
    body: "Custody patterns, exchanges, and change requests stay in one place instead of getting scattered across texts and screenshots.",
  },
  {
    icon: MessageSquare,
    title: "Documented communication",
    body: "Messages are timestamped and preserved so important context is not lost when decisions need to be reviewed later.",
  },
  {
    icon: FolderKanban,
    title: "Family records that stay organized",
    body: "Child info, documents, notes, and expenses live in one structured system instead of being rebuilt every week.",
  },
  {
    icon: Shield,
    title: "Access with boundaries",
    body: "Parents can include co-parents, step-parents, and third parties without turning the product into a wide-open family feed.",
  },
];

const showcaseCards = [
  {
    title: "Keep custody schedules visible",
    description: "Recurring patterns, exchanges, and event coordination are easier to trust when the calendar is the source of truth.",
    image: calendarFeature,
    badge: "Calendar",
  },
  {
    title: "Reduce confusion in communication",
    description: "Documented messaging creates a cleaner record than chasing conversations across texts, screenshots, and email threads.",
    image: messagingFeature,
    badge: "Messaging",
  },
  {
    title: "Store the records families actually need",
    description: "Medical forms, school information, agreements, and supporting documents stay attached to the family instead of one device.",
    image: documentsFeature,
    badge: "Documents",
  },
];

const workflowSteps = [
  {
    step: "01",
    title: "Set the family structure",
    body: "Create the family, add children, and define the people involved so access starts from a real custody context instead of a generic app account.",
  },
  {
    step: "02",
    title: "Run coordination in one place",
    body: "Use the calendar, messages, documents, and expenses as a single operating system instead of stitching together multiple tools.",
  },
  {
    step: "03",
    title: "Keep a record without extra work",
    body: "Timestamps, exports, and organized history are built into the workflow so documentation happens as part of normal use.",
  },
];

const roleCards = [
  {
    icon: Users,
    title: "Parents and co-parents",
    body: "Shared schedules, documented messaging, expenses, and child records are designed for the people doing the day-to-day coordination.",
  },
  {
    icon: Stethoscope,
    title: "Professionals and support adults",
    body: "Third-party and limited-access roles give the product room to support therapists, sitters, grandparents, or other trusted adults.",
  },
  {
    icon: FileCheck,
    title: "Families who need stronger records",
    body: "CoParrent is structured for families who need clarity, accountability, and cleaner exports when disputes or legal review become part of the picture.",
  },
];

export const HomeSections = () => {
  return (
    <>
      <section className="py-20 lg:py-24 bg-muted/20 border-y border-border/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-12 lg:mb-14">
            <motion.span
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-block text-sm font-semibold text-primary uppercase tracking-widest mb-4"
            >
              Why It Works
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.08 }}
              className="mb-5"
            >
              Built for the full coordination loop
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.14 }}
              className="text-lg text-muted-foreground leading-relaxed"
            >
              CoParrent works best when the schedule, the conversation, the records,
              and the follow-through all live in the same system.
            </motion.p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6">
            {proofCards.map((card, index) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
                className="rounded-2xl border border-border bg-card p-6 lg:p-7 shadow-sm"
              >
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-5">
                  <card.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-display font-semibold mb-3">{card.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{card.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-24 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-12 lg:mb-14">
            <motion.span
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-block text-sm font-semibold text-primary uppercase tracking-widest mb-4"
            >
              Product Surface
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.08 }}
              className="mb-5"
            >
              A broader system than messaging alone
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.14 }}
              className="text-lg text-muted-foreground leading-relaxed max-w-2xl"
            >
              The strongest co-parenting products are not just inboxes. They help families
              manage time, information, records, and accountability without rebuilding the
              same context over and over.
            </motion.p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {showcaseCards.map((card, index) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-sm"
              >
                <div className="aspect-[4/3] overflow-hidden border-b border-border bg-muted">
                  <img
                    src={card.image}
                    alt={card.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="p-6">
                  <Badge variant="secondary" className="mb-4">
                    {card.badge}
                  </Badge>
                  <h3 className="text-xl font-display font-semibold mb-3">{card.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{card.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-24 bg-muted/25">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr] gap-12 lg:gap-16 items-start">
            <div>
              <motion.span
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="inline-block text-sm font-semibold text-primary uppercase tracking-widest mb-4"
              >
                Workflow
              </motion.span>
              <motion.h2
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.08 }}
                className="mb-5"
              >
                Clarity should come from the system, not from extra effort
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.14 }}
                className="text-lg text-muted-foreground leading-relaxed"
              >
                The strongest part of the product is the structure underneath it:
                families, roles, shared records, and flows that create documentation
                while people are simply trying to stay organized.
              </motion.p>
            </div>

            <div className="space-y-4">
              {workflowSteps.map((step, index) => (
                <motion.div
                  key={step.step}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.08 }}
                  className="rounded-2xl border border-border bg-card p-6"
                >
                  <div className="text-sm font-semibold text-primary mb-2">{step.step}</div>
                  <h3 className="text-lg font-display font-semibold mb-3">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-24 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-12 lg:mb-14">
            <motion.span
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-block text-sm font-semibold text-primary uppercase tracking-widest mb-4"
            >
              Roles
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.08 }}
              className="mb-5"
            >
              Made for the people actually involved
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.14 }}
              className="text-lg text-muted-foreground leading-relaxed"
            >
              CoParrent is designed for parents first, but it already leaves room
              for the other people real families rely on.
            </motion.p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {roleCards.map((card, index) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
                className="rounded-2xl border border-border bg-card p-6 lg:p-7"
              >
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-5">
                  <card.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-display font-semibold mb-3">{card.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{card.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-24 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto text-center"
          >
            <span className="inline-block text-sm font-semibold uppercase tracking-widest text-white/70 mb-4">
              Start With Structure
            </span>
            <h2 className="text-white mb-4">See the full system before you commit to more chaos</h2>
            <p className="text-lg text-white/75 max-w-2xl mx-auto mb-8">
              Explore the platform, compare the plans, and see how CoParrent handles
              schedules, communication, records, and family coordination together.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <Button asChild size="lg" variant="secondary">
                <Link to="/signup">Start Free</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="ghost"
                className="text-white hover:bg-white/10"
              >
                <Link to="/pricing" className="flex items-center gap-2">
                  View Pricing
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
};
