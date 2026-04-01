import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import {
  MessageSquare,
  FileText,
  Shield,
  Calendar,
  Phone,
  Receipt,
  Clock,
  ArrowRight,
  CheckCircle2,
  Eye,
  FolderCheck,
  Scale,
} from "lucide-react";

const capturedRecords = [
  {
    icon: MessageSquare,
    title: "Documented messaging",
    description:
      "Messages are timestamped, threaded, and preserved in order. They anchor the unified server-generated export timeline.",
    points: [
      "Chronological conversation history",
      "Sender attribution and channel context",
      "Read-receipt data included in exports",
    ],
  },
  {
    icon: Phone,
    title: "Call session activity",
    description:
      "Call attempts, answers, declines, and related session events are preserved as timeline evidence for the selected family.",
    points: [
      "Session and event timestamps",
      "Participant and status context",
      "No recordings or transcripts claimed",
    ],
  },
  {
    icon: Calendar,
    title: "Schedule requests and exchanges",
    description:
      "Schedule change requests, approvals, denials, and exchange check-ins create a cleaner history of what was proposed and what happened.",
    points: [
      "Request type, dates, and status history",
      "Exchange check-in timestamps and notes",
      "Timestamp-based exchange records, not GPS verification",
    ],
  },
  {
    icon: FolderCheck,
    title: "Documents and access events",
    description:
      "Shared documents can be paired with access logs so families can see when important records were viewed, downloaded, or handled.",
    points: [
      "Document titles and access actions",
      "Who accessed a file and when",
      "Useful for agreements, forms, and supporting records",
    ],
  },
  {
    icon: Receipt,
    title: "Expense and reimbursement history",
    description:
      "Expense records capture dates, amounts, categories, split percentages, child association, and supporting notes for selected periods.",
    points: [
      "Categorized shared expenses",
      "Reimbursement-related context",
      "Exportable summaries for the chosen date range",
    ],
  },
];

const exportSections = [
  {
    label: "Communication log",
    body: "Messages are exported in chronological order with sender attribution and timestamps.",
  },
  {
    label: "Call activity",
    body: "Call evidence is exported as persisted session and event history with timestamps and status context only.",
  },
  {
    label: "Schedule change requests",
    body: "Requests show original date, proposed date, request type, requesting party, and resulting status.",
  },
  {
    label: "Exchange check-ins",
    body: "Check-ins include exchange date, recorded time, and optional notes.",
  },
  {
    label: "Document references",
    body: "Document metadata is included so the export can reference titles, categories, and upload context without embedding raw document files.",
  },
  {
    label: "Document access logs",
    body: "Access events identify which document was touched, which action occurred, and when it happened.",
  },
  {
    label: "Expense records",
    body: "Expense exports summarize transaction history across the selected period.",
  },
  {
    label: "Custody schedule overview",
    body: "The current schedule pattern, exchange details, and schedule metadata can be included in the same report.",
  },
];

const guardrails = [
  "CoParrent is a recordkeeping and coordination tool, not legal advice.",
  "Admissibility of any export depends on the rules of the court or jurisdiction reviewing it.",
  "Journal entries are intentionally excluded from court exports today to preserve privacy.",
  "Call evidence reflects session and event history only. CoParrent does not claim call recordings or transcripts.",
  "Document references and access logs can be exported, but raw document files are not embedded in the court-record package.",
  "Exchange check-ins are timestamp-based only and should not be described as GPS-verified.",
];

const recordHighlights = [
  {
    icon: Shield,
    title: "Court-aware design",
    description: "The product is structured to make records easier to follow later, not just easier to create in the moment.",
  },
  {
    icon: Eye,
    title: "Section-based export control",
    description: "Exports can be assembled around the date range and report sections that are relevant to the period being reviewed.",
  },
  {
    icon: Scale,
    title: "Clearer review package",
    description: "The server generates a PDF artifact and evidence package together so the review copy can be verified later.",
  },
];

const CourtRecordsPage = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <main className="flex-1">
        <section className="py-20 lg:py-24 bg-gradient-to-b from-muted/30 via-background to-background border-b border-border/60">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto text-center">
              <motion.span
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary mb-6"
              >
                <Scale className="h-4 w-4" />
                Court Records and Legal Review
              </motion.span>
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="text-4xl md:text-5xl font-display font-bold mb-6"
              >
                Clearer records for families who need stronger documentation
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed"
              >
                CoParrent is designed so messages, call activity, schedule events, document access,
                and expense history are easier to review later when a mediator, attorney,
                or court needs a cleaner picture of what happened.
              </motion.p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12 max-w-5xl mx-auto">
              {recordHighlights.map((item, index) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.16 + index * 0.06 }}
                  className="rounded-2xl border border-border bg-card p-5 text-left"
                >
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 mb-4">
                    <item.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h2 className="font-display font-semibold mb-2">{item.title}</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 lg:py-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center mb-12">
              <h2 className="text-3xl font-display font-bold mb-4">What the product records today</h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                The strongest record value comes from ordinary use. Families coordinate in the app,
                and the documentation is created as part of that workflow.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
              {capturedRecords.map((record, index) => (
                <motion.div
                  key={record.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.06 }}
                >
                  <Card className="h-full border-border shadow-sm">
                    <CardContent className="p-6 lg:p-7">
                      <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-5">
                        <record.icon className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="text-xl font-display font-semibold mb-3">{record.title}</h3>
                      <p className="text-muted-foreground leading-relaxed mb-5">{record.description}</p>
                      <ul className="space-y-2">
                        {record.points.map((point) => (
                          <li key={point} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 lg:py-20 bg-muted/20 border-y border-border/60">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr] gap-12 lg:gap-16 items-start max-w-6xl mx-auto">
              <div>
                <h2 className="text-3xl font-display font-bold mb-5">What a court-ready export includes</h2>
                <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                  The current export flow is generated on the server around a selected family and date range.
                  Families can include the sections that matter to the period under review, then retain both a PDF artifact and a verification-backed evidence package.
                </p>
                <div className="rounded-2xl border border-border bg-card p-6">
                  <h3 className="font-display font-semibold mb-3">Important precision</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    The export is built server-side from stored family records and verified later against its receipt.
                    Call evidence remains session/event history only, and document coverage is limited to metadata and access history rather than raw file binaries.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {exportSections.map((section, index) => (
                  <motion.div
                    key={section.label}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.05 }}
                    className="rounded-2xl border border-border bg-card p-5"
                  >
                    <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">
                      Included section
                    </p>
                    <h3 className="font-display font-semibold mb-2">{section.label}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{section.body}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 lg:py-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-display font-bold text-center mb-8">Important legal and product guardrails</h2>
              <div className="space-y-4">
                {guardrails.map((item, index) => (
                  <motion.div
                    key={item}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.05 }}
                    className="rounded-2xl border border-border bg-card p-5 flex items-start gap-3"
                  >
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <p className="text-sm text-muted-foreground leading-relaxed">{item}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 lg:py-20 bg-primary text-primary-foreground">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl font-display font-bold text-white mb-4">
                Need the step-by-step export details?
              </h2>
              <p className="text-lg text-white/75 leading-relaxed mb-8">
                The Help Center explains how records are created, what can be exported,
                and how to approach documentation inside the product without overclaiming what it does.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-3">
                <Button asChild size="lg" variant="secondary">
                  <Link to="/help/documents/exports">See export guidance</Link>
                </Button>
                <Button asChild size="lg" variant="ghost" className="text-white hover:bg-white/10">
                  <Link to="/pricing" className="flex items-center gap-2">
                    View plans
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default CourtRecordsPage;
