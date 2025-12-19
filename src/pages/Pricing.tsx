import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const tiers = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Get started with basic co-parenting tools",
    features: [
      "Basic parenting calendar",
      "1 child profile",
      "30-day message history",
      "Email notifications",
    ],
    cta: "Start Free",
    variant: "outline" as const,
    popular: false,
  },
  {
    name: "Premium",
    price: "$12",
    period: "per month",
    description: "Full features for active co-parents",
    features: [
      "Advanced calendar with holidays",
      "Unlimited child profiles",
      "Full message history",
      "Document vault access",
      "Court-ready exports",
      "Priority email support",
    ],
    cta: "Start Premium Trial",
    variant: "default" as const,
    popular: true,
  },
  {
    name: "MVP",
    price: "$24",
    period: "per month",
    description: "For power users & early adopters",
    features: [
      "Everything in Premium",
      "Early access to new features",
      "Priority support",
      "Custom templates",
      "API access (coming soon)",
      "Founding member badge",
    ],
    cta: "Join as MVP",
    variant: "outline" as const,
    popular: false,
  },
  {
    name: "Law Office",
    price: "$99",
    period: "per month",
    description: "Multi-family management for professionals",
    features: [
      "Manage unlimited families",
      "Case dashboard & filters",
      "Bulk export tools",
      "Custom document templates",
      "Dedicated account manager",
      "Onboarding & training",
      "Priority phone support",
    ],
    cta: "Contact Sales",
    variant: "outline" as const,
    popular: false,
  },
];

const Pricing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 lg:pt-32 pb-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="max-w-3xl mx-auto text-center mb-16">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl sm:text-5xl font-display font-bold mb-6"
            >
              Simple, transparent pricing
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-lg text-muted-foreground"
            >
              Choose the plan that fits your needs. All plans include a 14-day free trial.
            </motion.p>
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-4">
            {tiers.map((tier, index) => (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  "relative rounded-2xl p-6 lg:p-8 border bg-card",
                  tier.popular
                    ? "border-primary shadow-lg ring-1 ring-primary"
                    : "border-border"
                )}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                    Most Popular
                  </div>
                )}

                {/* Tier Header */}
                <div className="mb-6">
                  <h3 className="text-lg font-display font-semibold mb-2">{tier.name}</h3>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-4xl font-display font-bold">{tier.price}</span>
                    <span className="text-muted-foreground text-sm">/{tier.period}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{tier.description}</p>
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Button
                  variant={tier.variant}
                  className="w-full"
                  onClick={() => navigate("/signup")}
                >
                  {tier.cta}
                </Button>
              </motion.div>
            ))}
          </div>

          {/* Comparison Table */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-24 max-w-4xl mx-auto"
          >
            <h2 className="text-2xl font-display font-bold text-center mb-8">
              Compare all features
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-4 px-4 font-medium">Feature</th>
                    <th className="text-center py-4 px-4 font-medium">Free</th>
                    <th className="text-center py-4 px-4 font-medium text-primary">Premium</th>
                    <th className="text-center py-4 px-4 font-medium">MVP</th>
                    <th className="text-center py-4 px-4 font-medium">Law Office</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {[
                    ["Parenting calendar", "Basic", "Advanced", "Advanced", "Advanced"],
                    ["Child profiles", "1", "Unlimited", "Unlimited", "Unlimited"],
                    ["Message history", "30 days", "Full", "Full", "Full"],
                    ["Document exports", "—", "✓", "✓", "✓"],
                    ["Court view", "—", "✓", "✓", "✓"],
                    ["Custom templates", "—", "—", "✓", "✓"],
                    ["Multi-family management", "—", "—", "—", "✓"],
                    ["Priority support", "—", "—", "✓", "✓"],
                  ].map(([feature, ...values], i) => (
                    <tr key={feature} className={cn("border-b border-border/50", i % 2 === 0 && "bg-muted/30")}>
                      <td className="py-3 px-4">{feature}</td>
                      {values.map((value, j) => (
                        <td key={j} className="text-center py-3 px-4 text-muted-foreground">
                          {value === "✓" ? (
                            <Check className="w-5 h-5 text-success mx-auto" />
                          ) : (
                            value
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Pricing;
