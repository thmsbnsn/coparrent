import { differenceInDays, format } from "date-fns";
import { Clock, Crown, AlertTriangle, Sparkles, Gift, CreditCard } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useSubscription } from "@/hooks/useSubscription";
import { STRIPE_TIERS } from "@/lib/stripe";
import { getSubscriptionTierLabel } from "@/lib/displayLabels";

export const SubscriptionBanner = () => {
  const { 
    tier, 
    subscribed, 
    loading, 
    freeAccess, 
    trial,
    trialEndsAt,
    pastDue,
  } = useSubscription();

  // Don't show anything while loading
  if (loading) return null;

  const tierLabel = STRIPE_TIERS[tier]?.name || getSubscriptionTierLabel(tier);

  // Past due warning banner
  if (pastDue && subscribed) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-warning bg-warning/5 p-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5 text-warning" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-semibold text-warning">Payment Issue</h3>
                <Badge variant="outline" className="border-warning text-warning text-xs">{tierLabel}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Please update your payment method to avoid service interruption.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild className="shrink-0">
            <Link to="/dashboard/settings">Update Payment</Link>
          </Button>
        </div>
      </motion.div>
    );
  }

  // Free premium access - subtle positive banner
  if (freeAccess) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-primary/30 bg-primary/5 p-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Gift className="w-5 h-5 text-primary" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-gradient-to-r from-primary to-primary/80">Free Forever ✨</Badge>
            <span className="text-sm text-muted-foreground">Full {tierLabel} access enabled</span>
          </div>
        </div>
      </motion.div>
    );
  }

  // Active paid subscription - no banner needed (or subtle success)
  if (subscribed && !trial) {
    return null; // Don't clutter dashboard for active subscribers
  }

  // Trial period (Stripe or local)
  if (trial && trialEndsAt) {
    const now = new Date();
    const endDate = new Date(trialEndsAt);
    const daysRemaining = Math.max(0, differenceInDays(endDate, now));
    const isExpired = now > endDate;
    const progress = ((7 - daysRemaining) / 7) * 100;

    if (isExpired) {
      return (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-warning bg-warning/5 p-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-warning" />
              </div>
              <div>
                <h3 className="font-display font-semibold">Trial Expired</h3>
                <p className="text-sm text-muted-foreground">
                  Upgrade to Power to keep using Expenses, Court Exports & Sports Hub
                </p>
              </div>
            </div>
            <Button size="sm" asChild className="shrink-0">
              <Link to="/pricing">Get Power</Link>
            </Button>
          </div>
        </motion.div>
      );
    }

    // Active trial countdown
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-primary/30 bg-primary/5 p-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="font-display font-semibold">Free Trial</h3>
                <Badge variant="secondary" className="text-xs">
                  {daysRemaining} {daysRemaining === 1 ? "day" : "days"} left
                </Badge>
              </div>
              <div className="flex items-center gap-3">
                <Progress value={progress} className="h-1.5 flex-1 max-w-32" />
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  Ends {format(endDate, "MMM d")}
                </span>
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild className="shrink-0">
            <Link to="/pricing">
              <Sparkles className="w-4 h-4 mr-1.5" />
              View Plans
            </Link>
          </Button>
        </div>
      </motion.div>
    );
  }

  // No subscription, no trial - prompt to get started
  if (!subscribed && !trial) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border bg-muted/30 p-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
              <Crown className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-display font-semibold">Upgrade to Power</h3>
              <p className="text-sm text-muted-foreground">
                Get Expenses, Court Exports, and Sports Hub for $5/month
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild className="shrink-0">
            <Link to="/pricing">View Plans</Link>
          </Button>
        </div>
      </motion.div>
    );
  }

  return null;
};
