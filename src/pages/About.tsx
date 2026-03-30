import { motion } from "framer-motion";
import {
  FileText,
  Heart,
  Scale,
  Shield,
  Users,
  ArrowRight,
  Calendar,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";

const principles = [
  {
    icon: Heart,
    title: "Children stay at the center",
    description:
      "The product is meant to reduce the amount of adult friction children have to absorb, not add another noisy place for conflict to spill.",
  },
  {
    icon: Scale,
    title: "Neutral structure matters",
    description:
      "CoParrent is designed to document what happened clearly and consistently rather than pushing one parent’s version of events over the other’s.",
  },
  {
    icon: Shield,
    title: "Sensitive information needs boundaries",
    description:
      "Family data can be personal, emotional, and sometimes legally important. Access and recordkeeping need to be treated that way from the start.",
  },
  {
    icon: Users,
    title: "Real families involve more than two logins",
    description:
      "The product leaves room for co-parents, children, step-parents, and selected third parties because actual coordination usually extends beyond one conversation thread.",
  },
];

const differentiators = [
  {
    icon: Calendar,
    title: "A product for coordination, not just messaging",
    description:
      "Schedules, exchanges, events, documents, expenses, and child information all support each other instead of living in separate tools.",
  },
  {
    icon: FileText,
    title: "Records are part of the workflow",
    description:
      "Documentation is not treated as an afterthought. Messages, exports, and activity history are meant to stay legible when details matter later.",
  },
  {
    icon: Scale,
    title: "Court-aware without pretending to be a law firm",
    description:
      "CoParrent is built for clarity and stronger records, but it does not position itself as legal advice or as a substitute for counsel.",
  },
];

const guardrails = [
  "not a social network for families",
  "not a surveillance or location-tracking product",
  "not a replacement for legal, medical, or safety professionals",
];

const About = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-24 lg:pt-32 pb-24">
        <section className="pb-16 lg:pb-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-16 items-start">
              <div>
                <motion.span
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="inline-block text-sm font-semibold text-primary uppercase tracking-widest mb-4"
                >
                  About CoParrent
                </motion.span>
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="text-4xl sm:text-5xl font-display font-bold mb-6"
                >
                  A calmer system for one of the hardest parts of family life
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-lg text-muted-foreground leading-relaxed mb-6"
                >
                  CoParrent was built around a simple idea: separated parents should not
                  have to rebuild the same family context every time they need to talk,
                  schedule, document, or share information.
                </motion.p>
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="text-lg text-muted-foreground leading-relaxed"
                >
                  The product is meant to reduce friction, keep records clearer, and
                  create a steadier operating system for custody coordination without
                  turning a difficult family situation into something louder or more chaotic.
                </motion.p>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-[2rem] border border-border bg-muted/30 p-7 lg:p-8"
              >
                <h2 className="text-xl font-display font-semibold mb-5">What the product is trying to do well</h2>
                <div className="space-y-4">
                  <div className="rounded-2xl border border-border bg-card p-5">
                    <h3 className="font-display font-semibold mb-2">Give parents one shared source of truth</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      The calendar, messages, child information, documents, and expenses are strongest when they live together.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-5">
                    <h3 className="font-display font-semibold mb-2">Make documentation part of normal use</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Clear records should happen because the workflow is structured well, not because users are doing extra admin work.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-5">
                    <h3 className="font-display font-semibold mb-2">Stay useful without becoming invasive</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      The product aims for accountability and clarity without drifting into surveillance or unnecessary complexity.
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        <section className="py-16 lg:py-20 bg-muted/20 border-y border-border/60">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center mb-12 lg:mb-14">
              <motion.h2
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-3xl font-display font-bold mb-4"
              >
                What guides the product
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.08 }}
                className="text-lg text-muted-foreground leading-relaxed"
              >
                CoParrent is intentionally opinionated about calm design, documented communication,
                access boundaries, and keeping children out of the middle.
              </motion.p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {principles.map((value, index) => (
                <motion.div
                  key={value.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.08 }}
                  className="flex gap-4 rounded-2xl border border-border bg-card p-6"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <value.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold mb-2">{value.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{value.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 lg:py-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr] gap-12 lg:gap-16">
              <div>
                <motion.span
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="inline-block text-sm font-semibold text-primary uppercase tracking-widest mb-4"
                >
                  Product Thesis
                </motion.span>
                <motion.h2
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.08 }}
                  className="text-3xl font-display font-bold mb-5"
                >
                  Why CoParrent is broader than a communication tool
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.14 }}
                  className="text-lg text-muted-foreground leading-relaxed"
                >
                  A message thread alone does not solve custody coordination. Parents still
                  need a shared schedule, a place for records, a way to manage documents and expenses,
                  and a system that keeps all of it tied together.
                </motion.p>
              </div>

              <div className="space-y-4">
                {differentiators.map((item, index) => (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.08 }}
                    className="rounded-2xl border border-border bg-card p-6"
                  >
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 mb-4">
                      <item.icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-lg font-display font-semibold mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 lg:py-20 bg-muted/20 border-y border-border/60">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <motion.h2
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-3xl font-display font-bold mb-6 text-center"
              >
                What CoParrent is not
              </motion.h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {guardrails.map((item, index) => (
                  <motion.div
                    key={item}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.08 }}
                    className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground leading-relaxed"
                  >
                    <span className="block text-xs font-semibold uppercase tracking-widest text-primary mb-2">
                      Guardrail
                    </span>
                    {item}
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="pt-16 lg:pt-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="max-w-3xl mx-auto text-center rounded-[2rem] bg-primary px-8 py-12 text-primary-foreground"
            >
              <h2 className="text-white text-3xl font-display font-bold mb-4">
                See how the product is structured
              </h2>
              <p className="text-lg text-white/75 max-w-2xl mx-auto mb-8">
                Explore the features, compare the plans, and see how CoParrent is set up
                to handle coordination, records, and family workflow together.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-3">
                <Button asChild size="lg" variant="secondary">
                  <Link to="/features">Explore Features</Link>
                </Button>
                <Button asChild size="lg" variant="ghost" className="text-white hover:bg-white/10">
                  <Link to="/pricing" className="flex items-center gap-2">
                    View Pricing
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default About;
