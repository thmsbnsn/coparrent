import { motion } from "framer-motion";
import { Calendar, MessageSquare, Users, Briefcase, FileText, Bell } from "lucide-react";

const features = [
  {
    icon: Calendar,
    title: "Smart Parenting Calendar",
    description:
      "Build court-friendly custody schedules with our step-by-step wizard. Choose from common patterns like 2-2-3 or create custom arrangements.",
    gradient: "from-primary to-info",
  },
  {
    icon: Users,
    title: "Child Info Hub",
    description:
      "Keep all important details in one place—medical info, school schedules, clothing sizes, and recent purchases shared between parents.",
    gradient: "from-accent-foreground to-success",
  },
  {
    icon: MessageSquare,
    title: "Court-Ready Messaging",
    description:
      "Communicate with documented, timestamped messages. Export conversation logs formatted for legal proceedings when needed.",
    gradient: "from-warning to-destructive",
  },
  {
    icon: Briefcase,
    title: "Law Office Portal",
    description:
      "Family law professionals can manage multiple cases, access court views, and export documentation with ease.",
    gradient: "from-primary to-accent-foreground",
  },
  {
    icon: FileText,
    title: "Document Export",
    description:
      "Generate clean, professional summaries of schedules, messages, and child information for court filings.",
    gradient: "from-success to-info",
  },
  {
    icon: Bell,
    title: "Smart Notifications",
    description:
      "Stay informed about schedule changes, upcoming exchanges, and new messages with customizable alerts.",
    gradient: "from-info to-primary",
  },
];

export const Features = () => {
  return (
    <section className="py-24 lg:py-32 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center mb-16 lg:mb-20">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-sm font-medium text-primary uppercase tracking-wider"
          >
            Features
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold mt-4 mb-6"
          >
            Everything you need for peaceful co-parenting
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-lg text-muted-foreground"
          >
            From scheduling to documentation, ClearNest helps you focus on what matters most—your children.
          </motion.p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="group relative p-6 lg:p-8 rounded-2xl bg-card border border-border hover:border-primary/20 hover:shadow-lg transition-all duration-300"
            >
              {/* Icon */}
              <div
                className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} mb-6`}
              >
                <feature.icon className="w-6 h-6 text-primary-foreground" />
              </div>

              {/* Content */}
              <h3 className="text-xl font-display font-semibold mb-3 group-hover:text-primary transition-colors">
                {feature.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">{feature.description}</p>

              {/* Hover Glow Effect */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity -z-10" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
