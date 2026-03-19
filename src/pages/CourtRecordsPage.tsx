import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { 
  MessageSquare, 
  FileText, 
  Shield, 
  Calendar, 
  Receipt, 
  Clock,
  CheckCircle,
  ArrowRight
} from "lucide-react";

const CourtRecordsPage = () => {
  const recordTypes = [
    {
      icon: MessageSquare,
      title: "Timestamped Communication Records",
      description: "Every message between co-parents is automatically timestamped with date, time, and read receipts. Messages cannot be edited or deleted after sending, creating an accurate and reliable communication history.",
      features: [
        "Automatic date and time stamps on all messages",
        "Read receipt confirmation when messages are viewed",
        "Complete conversation threads preserved in order",
        "No ability to modify or remove sent messages"
      ]
    },
    {
      icon: Shield,
      title: "Immutable Message History",
      description: "Communication records are stored securely and cannot be altered by either parent. This ensures that all exchanges remain exactly as they occurred, providing an objective record of interactions.",
      features: [
        "Messages preserved in original form",
        "Secure storage with access controls",
        "Full audit trail of all communications",
        "Exportable for legal proceedings"
      ]
    },
    {
      icon: FileText,
      title: "Document Access Logging",
      description: "When important documents are uploaded and shared, CoParrent logs who accessed them and when. This creates accountability and transparency around shared parenting documents.",
      features: [
        "Automatic logging of document views",
        "Records of who accessed what and when",
        "Secure document storage with permission controls",
        "Complete access history available for export"
      ]
    },
    {
      icon: Clock,
      title: "Court-Ready PDF Exports",
      description: "Generate professional PDF reports of communications, schedules, and records. These exports are formatted for clarity and include all relevant timestamps and metadata.",
      features: [
        "Professional formatting suitable for court submission",
        "Includes all timestamps and read receipts",
        "Date range filtering for specific periods",
        "Organized and easy to navigate"
      ]
    },
    {
      icon: Receipt,
      title: "Expense Reports & Reimbursement Records",
      description: "Track shared expenses with detailed records of amounts, categories, and reimbursement requests. All financial interactions are logged with dates and response history.",
      features: [
        "Itemized expense tracking with categories",
        "Reimbursement request and response history",
        "Receipt storage and access logging",
        "Exportable financial summaries"
      ]
    },
    {
      icon: Calendar,
      title: "Schedule Changes & Exchange Check-ins",
      description: "All schedule modification requests, approvals, and exchange confirmations are recorded. This provides a clear history of custody schedule adherence and any agreed-upon changes.",
      features: [
        "Schedule change request records with reasons",
        "Approval and denial history with timestamps",
        "Exchange check-in confirmations",
        "Pattern of schedule adherence documentation"
      ]
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-20 px-4 bg-gradient-to-b from-muted/30 to-background">
          <div className="container mx-auto max-w-4xl text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
              Court-Ready Records & Legal Use
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              CoParrent creates accurate, timestamped records of all co-parenting interactions. 
              Designed for transparency and built for accountability.
            </p>
          </div>
        </section>

        {/* Trust Statement */}
        <section className="py-12 px-4 border-b border-border">
          <div className="container mx-auto max-w-4xl">
            <Card className="bg-muted/20 border-border">
              <CardContent className="p-8">
                <div className="flex items-start gap-4">
                  <CheckCircle className="h-8 w-8 text-primary flex-shrink-0 mt-1" />
                  <div>
                    <h2 className="text-xl font-semibold text-foreground mb-3">
                      Designed for Documentation Integrity
                    </h2>
                    <p className="text-muted-foreground leading-relaxed">
                      CoParrent is built with record-keeping at its core. Every interaction—messages, 
                      schedule changes, document access, and financial transactions—is automatically 
                      logged with timestamps that cannot be modified. This creates a neutral, objective 
                      record that both parents and legal professionals can rely on.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Record Types */}
        <section className="py-16 px-4">
          <div className="container mx-auto max-w-5xl">
            <h2 className="text-2xl font-semibold text-foreground text-center mb-12">
              What CoParrent Documents
            </h2>
            
            <div className="space-y-8">
              {recordTypes.map((record, index) => (
                <Card key={index} className="border-border">
                  <CardContent className="p-8">
                    <div className="flex flex-col md:flex-row gap-6">
                      <div className="flex-shrink-0">
                        <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                          <record.icon className="h-7 w-7 text-primary" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-foreground mb-3">
                          {record.title}
                        </h3>
                        <p className="text-muted-foreground mb-4 leading-relaxed">
                          {record.description}
                        </p>
                        <ul className="grid md:grid-cols-2 gap-2">
                          {record.features.map((feature, featureIndex) => (
                            <li key={featureIndex} className="flex items-start gap-2 text-sm text-muted-foreground">
                              <CheckCircle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* For Mediation and Court Review */}
        <section className="py-16 px-4 bg-muted/20">
          <div className="container mx-auto max-w-4xl">
            <h2 className="text-2xl font-semibold text-foreground text-center mb-8">
              For Mediation, Documentation, and Court Review
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="border-border bg-background">
                <CardContent className="p-6 text-center">
                  <h3 className="font-semibold text-foreground mb-2">Objective Records</h3>
                  <p className="text-sm text-muted-foreground">
                    Neither parent can edit or delete records, ensuring neutrality.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border bg-background">
                <CardContent className="p-6 text-center">
                  <h3 className="font-semibold text-foreground mb-2">Clear Exports</h3>
                  <p className="text-sm text-muted-foreground">
                    Professional PDF reports formatted for easy review and submission.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border bg-background">
                <CardContent className="p-6 text-center">
                  <h3 className="font-semibold text-foreground mb-2">Complete History</h3>
                  <p className="text-sm text-muted-foreground">
                    Full audit trails with timestamps for comprehensive documentation.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Disclaimer */}
        <section className="py-12 px-4 border-t border-border">
          <div className="container mx-auto max-w-3xl">
            <Card className="bg-muted/10 border-border">
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground text-center leading-relaxed">
                  <strong className="text-foreground">Important Notice:</strong> CoParrent is a record-keeping 
                  and communication tool. It does not provide legal advice and is not a substitute for 
                  professional legal counsel. The records created within CoParrent are designed to support 
                  accurate documentation, but their admissibility and use in legal proceedings is subject 
                  to the rules and discretion of the relevant court or jurisdiction.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 px-4">
          <div className="container mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              Learn More About Record Creation
            </h2>
            <p className="text-muted-foreground mb-8">
              Visit our Help Center for detailed guides on how records are created, 
              stored, and exported within CoParrent.
            </p>
            <Button asChild size="lg" className="gap-2">
              <Link to="/help">
                See how records are created
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default CourtRecordsPage;
