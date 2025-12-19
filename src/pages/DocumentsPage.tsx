import { motion } from "framer-motion";
import { FileText, Calendar, MessageSquare, Users, Download } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";

const documents = [
  {
    icon: Calendar,
    title: "Parenting Schedule Summary",
    description: "Complete custody schedule with holidays and exchanges",
    lastGenerated: "Never",
  },
  {
    icon: MessageSquare,
    title: "Message Transcript",
    description: "Full communication log between co-parents",
    lastGenerated: "Dec 5, 2024",
  },
  {
    icon: Users,
    title: "Child Information Summary",
    description: "All children's profiles, health, and school info",
    lastGenerated: "Dec 8, 2024",
  },
];

const DocumentsPage = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl lg:text-3xl font-display font-bold">Documents & Exports</h1>
          <p className="text-muted-foreground mt-1">Generate court-ready documentation</p>
        </motion.div>

        {/* Documents Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {documents.map((doc, index) => (
            <motion.div
              key={doc.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="rounded-2xl border border-border bg-card p-6 hover:shadow-lg transition-shadow"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <doc.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-display font-semibold mb-2">{doc.title}</h3>
              <p className="text-sm text-muted-foreground mb-4">{doc.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Last generated: {doc.lastGenerated}
                </span>
              </div>
              <Button className="w-full mt-4">
                <Download className="w-4 h-4 mr-2" />
                Generate
              </Button>
            </motion.div>
          ))}
        </div>

        {/* Export History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl border border-border bg-card p-6"
        >
          <h2 className="text-lg font-display font-semibold mb-4">Recent Exports</h2>
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>No documents have been generated yet</p>
            <p className="text-sm mt-1">Generated documents will appear here</p>
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

export default DocumentsPage;
