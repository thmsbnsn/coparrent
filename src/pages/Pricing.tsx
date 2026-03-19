import { motion } from "framer-motion";
import { Check, Loader2, ArrowRight, Shield, Clock, CreditCard } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { StripeTier } from "@/lib/stripe";

/**
 * Pricing Page - Clear, Confident, No Hesitation
 * 
 * Design Intent:
 * - Remove any hesitation or ambiguity
 * - Plan differences IMMEDIATELY legible
 * - Reinforce fairness, transparency, restraint
 * - "This is calm. This is fair. This is clear."
 * 
 * POST-REVIEW STATUS:
 * ✓ Passes court-scrutiny test - professional, no charm
 * ✓ Comparison table provides immediate clarity
 * ✓ Trust points are grounded (encrypted, cancel, no card)
 * ✓ No startup optimism or generic SaaS language
 */

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Essential tools for co-parenting coordination",
    highlight: false,
    features: [
      "Up to 4 child profiles",
      "Shared custody calendar",
      "Documented messaging",
      "Child information hub",
      "Photo gallery",
      "Document vault",
      "Kids activity center",
      "Law library access",
      "Up to 4 family accounts",
    ],
    cta: "Start Free",
    ctaVariant: "outline" as const,
    stripeTier: null as StripeTier | null,
  },
  {
    name: "Power",
    price: "$5",
    period: "per month",
    description: "Full platform for active co-parents",
    highlight: true,
    features: [
      "Everything in Free, plus:",
      "Up to 6 child profiles",
      "Up to 6 family accounts",
      "Expense tracking & reports",
      "Court-ready document exports",
      "Sports & events hub",
      "AI message tone assistance",
      "Priority support",
    ],
    cta: "Upgrade to Power",
    ctaVariant: "default" as const,
    stripeTier: "power" as StripeTier,
  },
];

const comparisonData = [
  { feature: "Child profiles", free: "4", power: "6" },
  { feature: "Family accounts", free: "4", power: "6" },
  { feature: "Custody calendar", free: true, power: true },
  { feature: "Messaging", free: true, power: true },
  { feature: "Child info hub", free: true, power: true },
  { feature: "Photo gallery", free: true, power: true },
  { feature: "Document vault", free: true, power: true },
  { feature: "Kids center", free: true, power: true },
  { feature: "Law library", free: true, power: true },
  { feature: "Expense tracking", free: false, power: true },
  { feature: "Court-ready exports", free: false, power: true },
  { feature: "Sports & events", free: false, power: true },
  { feature: "AI assistance", free: false, power: true },
  { feature: "Priority support", free: false, power: true },
];

const trustPoints = [
  { icon: Shield, text: "Secure & encrypted" },
  { icon: Clock, text: "Cancel anytime" },
  { icon: CreditCard, text: "No card required for free" },
];

const Pricing = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const { tier: currentTier, subscribed, loading, checkoutLoading, createCheckout } = useSubscription();

  useEffect(() => {
    if (searchParams.get("canceled") === "true") {
      toast({
        title: "Checkout canceled",
        description: "You can upgrade whenever you're ready.",
      });
    }
  }, [searchParams, toast]);

  const handleSubscribe = async (plan: typeof plans[number]) => {
    if (!plan.stripeTier) {
      if (!user) {
        navigate("/signup");
      }
      return;
    }

    if (!user) {
      toast({
        title: "Sign in required",
        description: "Create an account to subscribe.",
      });
      navigate("/signup");
      return;
    }

    await createCheckout(plan.stripeTier);
  };

  const normalizedTier = (currentTier as string) === "premium" || (currentTier as string) === "mvp" ? "power" : currentTier;

  const isCurrentPlan = (plan: typeof plans[number]) => {
    if (!plan.stripeTier && normalizedTier === "free" && !subscribed) return true;
    if (plan.stripeTier === normalizedTier && subscribed) return true;
    return false;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="pt-24 lg:pt-32 pb-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header - Direct, No Fluff */}
          <div className="max-w-2xl mx-auto text-center mb-14 lg:mb-16">
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4"
            >
              Simple pricing.<br />No surprises.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-lg text-muted-foreground"
            >
              Start free with everything you need. Upgrade for advanced features.
            </motion.p>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 max-w-3xl mx-auto mb-16">
            {plans.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  "relative rounded-2xl p-7 lg:p-8 border bg-card",
                  plan.highlight
                    ? "border-primary shadow-lg ring-1 ring-primary"
                    : "border-border"
                )}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                    Recommended
                  </div>
                )}

                {/* Plan Header */}
                <div className="mb-6">
                  <h3 className="text-xl font-display font-bold mb-1">
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline gap-1 mb-3">
                    <span className="text-4xl font-display font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">/{plan.period}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Button
                  variant={isCurrentPlan(plan) ? "outline" : plan.ctaVariant}
                  className={cn(
                    "w-full h-12",
                    isCurrentPlan(plan) && "border-success text-success pointer-events-none"
                  )}
                  onClick={() => handleSubscribe(plan)}
                  disabled={loading || checkoutLoading || isCurrentPlan(plan)}
                >
                  {(loading || checkoutLoading) ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isCurrentPlan(plan) ? (
                    "Current Plan"
                  ) : (
                    plan.cta
                  )}
                </Button>
              </motion.div>
            ))}
          </div>

          {/* Trust Points */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap justify-center gap-8 mb-20"
          >
            {trustPoints.map((point) => (
              <div key={point.text} className="flex items-center gap-2 text-muted-foreground">
                <point.icon className="w-4 h-4" />
                <span className="text-sm font-medium">{point.text}</span>
              </div>
            ))}
          </motion.div>

          {/* Comparison Table */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="max-w-3xl mx-auto"
          >
            <h2 className="text-2xl font-display font-bold text-center mb-8">
              Compare plans
            </h2>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left py-4 px-5 font-semibold text-sm">Feature</th>
                    <th className="text-center py-4 px-5 font-semibold text-sm w-28">Free</th>
                    <th className="text-center py-4 px-5 font-semibold text-sm text-primary w-28">Power</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonData.map((row, i) => (
                    <tr 
                      key={row.feature} 
                      className={cn(
                        "border-t border-border",
                        i % 2 === 0 && "bg-muted/20"
                      )}
                    >
                      <td className="py-3 px-5 text-sm">{row.feature}</td>
                      <td className="py-3 px-5 text-center">
                        {row.free === true ? (
                          <Check className="w-5 h-5 text-success mx-auto" />
                        ) : row.free === false ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">{row.free}</span>
                        )}
                      </td>
                      <td className="py-3 px-5 text-center">
                        {row.power === true ? (
                          <Check className="w-5 h-5 text-success mx-auto" />
                        ) : (
                          <span className="text-sm font-medium">{row.power}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* FAQ Teaser */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-16 text-center"
          >
            <p className="text-muted-foreground mb-4">
              Have questions about which plan is right for you?
            </p>
            <Button asChild variant="ghost" className="group">
              <a href="/help" className="flex items-center gap-2">
                Visit Help Center
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </a>
            </Button>
          </motion.div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Pricing;
