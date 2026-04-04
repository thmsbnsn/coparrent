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
import { SectionCard } from "@/components/ui/SectionCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";

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
      <section className="border-y border-border/60 bg-muted/20 px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="page-shell-public">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto mb-12 max-w-3xl lg:mb-14"
          >
            <SectionHeader
              align="center"
              eyebrow="Why It Works"
              eyebrowTone="pill"
              title="Built for the full coordination loop"
              description="CoParrent works best when the schedule, the conversation, the records, and the follow-through all live in the same system."
              descriptionClassName="sm:text-lg"
            />
          </motion.div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:gap-6">
            {proofCards.map((card, index) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
              >
                <SectionCard variant="standard" className="p-6 lg:p-7">
                  <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/10 bg-primary/10">
                    <card.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="mb-3 text-lg font-display font-semibold">{card.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{card.body}</p>
                </SectionCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-background px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="page-shell-public">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-12 max-w-3xl lg:mb-14"
          >
            <SectionHeader
              eyebrow="Product Surface"
              eyebrowTone="pill"
              title="A broader system than messaging alone"
              description="The strongest co-parenting products are not just inboxes. They help families manage time, information, records, and accountability without rebuilding the same context over and over."
              descriptionClassName="max-w-2xl sm:text-lg"
            />
          </motion.div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {showcaseCards.map((card, index) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <SectionCard variant="standard" className="overflow-hidden p-0">
                  <div className="aspect-[4/3] overflow-hidden border-b border-border/70 bg-muted">
                    <img
                      src={card.image}
                      alt={card.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-6">
                    <StatusPill variant="scope" className="mb-4">
                      {card.badge}
                    </StatusPill>
                    <h3 className="mb-3 text-xl font-display font-semibold">{card.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{card.description}</p>
                  </div>
                </SectionCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-muted/25 px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="page-shell-public">
          <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <SectionHeader
                eyebrow="Workflow"
                eyebrowTone="pill"
                title="Clarity should come from the system, not from extra effort"
                description="The strongest part of the product is the structure underneath it: families, roles, shared records, and flows that create documentation while people are simply trying to stay organized."
                descriptionClassName="sm:text-lg"
              />
            </motion.div>

            <div className="space-y-4">
              {workflowSteps.map((step, index) => (
                <motion.div
                  key={step.step}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.08 }}
                >
                  <SectionCard variant="standard" className="p-6">
                    <div className="mb-2 text-sm font-semibold text-primary">{step.step}</div>
                    <h3 className="mb-3 text-lg font-display font-semibold">{step.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                  </SectionCard>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-background px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="page-shell-public">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto mb-12 max-w-3xl lg:mb-14"
          >
            <SectionHeader
              align="center"
              eyebrow="Roles"
              eyebrowTone="pill"
              title="Made for the people actually involved"
              description="CoParrent is designed for parents first, but it already leaves room for the other people real families rely on."
              descriptionClassName="sm:text-lg"
            />
          </motion.div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {roleCards.map((card, index) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
              >
                <SectionCard variant="standard" className="p-6 lg:p-7">
                  <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/10 bg-primary/10">
                    <card.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="mb-3 text-lg font-display font-semibold">{card.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{card.body}</p>
                </SectionCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20 text-primary-foreground sm:px-6 lg:px-8 lg:py-24">
        <div className="page-shell-public">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="surface-hero mx-auto max-w-4xl px-6 py-8 text-center sm:px-8 sm:py-10"
          >
            <span className="eyebrow-pill-dark">
              Start With Structure
            </span>
            <h2 className="mt-4 text-white">See the full system before you commit to more chaos</h2>
            <p className="mx-auto mb-8 mt-4 max-w-2xl text-lg text-white/75">
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
