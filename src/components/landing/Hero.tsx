import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Calendar, MessageSquare, Users, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: Calendar, label: "Smart Scheduling" },
  { icon: MessageSquare, label: "Court-Ready Messaging" },
  { icon: Users, label: "Child Info Hub" },
  { icon: Shield, label: "Secure & Private" },
];

export const Hero = () => {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-gradient-radial from-accent/30 via-transparent to-transparent blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-gradient-radial from-secondary/40 via-transparent to-transparent blur-3xl" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary text-secondary-foreground text-sm font-medium mb-8"
          >
            <span className="w-2 h-2 rounded-full bg-gradient-accent animate-pulse" />
            Trusted by 10,000+ co-parents
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-display font-bold leading-tight mb-6"
          >
            Co-parenting made{" "}
            <span className="text-gradient bg-gradient-hero">clear & simple</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10"
          >
            The modern custody toolkit that helps parents stay organized, communicate clearly, 
            and keep their children's well-being at the center of every decision.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
          >
            <Button size="lg" onClick={() => navigate("/signup")} className="text-base px-8 h-12">
              Get Started Free
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/signup?type=lawoffice")}
              className="text-base px-8 h-12"
            >
              For Law Offices
            </Button>
          </motion.div>

          {/* Feature Pills */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-wrap items-center justify-center gap-3"
          >
            {features.map((feature, index) => (
              <motion.div
                key={feature.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.5 + index * 0.1 }}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border shadow-sm"
              >
                <feature.icon className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">{feature.label}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Preview Image Placeholder */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.6 }}
          className="mt-20 max-w-5xl mx-auto"
        >
          <div className="relative rounded-2xl overflow-hidden shadow-xl border border-border bg-card">
            <div className="aspect-[16/9] bg-gradient-to-br from-muted to-background flex items-center justify-center">
              <div className="text-center p-8">
                <Calendar className="w-16 h-16 text-primary/30 mx-auto mb-4" />
                <p className="text-muted-foreground">Interactive Dashboard Preview</p>
              </div>
            </div>
            {/* Glass overlay effect */}
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent pointer-events-none" />
          </div>
        </motion.div>
      </div>
    </section>
  );
};
