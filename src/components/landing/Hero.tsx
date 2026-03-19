import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Shield, Scale, FileCheck, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Hero Section - Authority-Driven Design
 * 
 * Design Intent:
 * - Communicate calm authority, not "friendly app" vibes
 * - Value proposition legible in 3 seconds
 * - Professional credibility suitable for court scrutiny
 * - "Reassuringly serious" rather than "pleasant"
 * 
 * CORRECTIONS (Post-Review):
 * - Fixed: Text contrast was too low (white/70 → white/90)
 * - Fixed: Secondary CTA was invisible (ghost → outline with visible border)
 * - Fixed: Trust signals were washed out (white/60 → white/80)
 * - Fixed: Eyebrow pill had poor contrast (white/80 → white/90)
 */

const trustSignals = [
  { icon: Shield, label: "Secure & Private" },
  { icon: Scale, label: "Court-Ready Records" },
  { icon: FileCheck, label: "Documented History" },
];

export const Hero = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  return (
    <section className="relative min-h-[90vh] flex items-center pt-20 lg:pt-24 overflow-hidden bg-[#0a0f1a]">
      {/* Structured Background - Direct dark navy gradient for guaranteed contrast */}
      <div 
        className="absolute inset-0 -z-10"
        style={{
          background: 'linear-gradient(160deg, hsl(222, 50%, 6%) 0%, hsl(222, 45%, 10%) 50%, hsl(215, 40%, 12%) 100%)'
        }}
      />
      
      {/* Subtle Grid Pattern for Structure */}
      <div 
        className="absolute inset-0 -z-10 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(hsl(0 0% 100%) 1px, transparent 1px),
                           linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }}
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          {/* Eyebrow - Subtle but legible, not playful */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6"
          >
            {/* FIX: Increased contrast on eyebrow text for readability */}
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 text-white/95 text-sm font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              Trusted by families and attorneys
            </span>
          </motion.div>

          {/* Primary Headline - Commanding, Clear */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-white mb-6"
          >
            Custody coordination
            <br />
            {/* FIX: headline sub-line was too faint */}
            <span className="text-white/95">built for clarity</span>
          </motion.h1>

          {/* Value Proposition - Direct, Confident */}
          {/* FIX: Increased contrast from white/70 to white/85 */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg sm:text-xl text-white/85 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            The co-parenting platform that keeps schedules organized, 
            communication documented, and records court-ready—so you can 
            focus on what matters.
          </motion.p>

          {/* CTA - Singular, Clear Action */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mb-12"
          >
            {!loading && user ? (
              <Button 
                size="lg" 
                onClick={() => navigate("/dashboard")} 
                className="h-14 px-8 text-base font-medium bg-white text-primary hover:bg-white/95 shadow-xl"
              >
                <LayoutDashboard className="mr-2 w-5 h-5" />
                Go to Dashboard
              </Button>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button 
                  size="lg" 
                  onClick={() => navigate("/signup")} 
                  className="h-14 px-8 text-base font-medium bg-white text-primary hover:bg-white/95 shadow-xl"
                >
                  Start Free
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
                {/* Secondary CTA - visible outline button */}
                <Button 
                  variant="outline" 
                  size="lg"
                  onClick={() => navigate("/features")} 
                  className="h-14 px-6 text-base text-white bg-transparent border-white/50 hover:bg-white/10 hover:border-white"
                >
                  See How It Works
                </Button>
              </div>
            )}
          </motion.div>

          {/* Trust Signals - Understated but VISIBLE Authority */}
          {/* FIX: Increased contrast from white/60 to white/80 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-wrap items-center justify-center gap-6 sm:gap-10"
          >
            {trustSignals.map((signal, index) => (
              <motion.div
                key={signal.label}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.5 + index * 0.1 }}
                className="flex items-center gap-2 text-white/80"
              >
                <signal.icon className="w-4 h-4" />
                <span className="text-sm font-medium">{signal.label}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Bottom Fade to Content */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
};
