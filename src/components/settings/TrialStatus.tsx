import { differenceInDays, format } from "date-fns";
import { Clock, Crown, AlertTriangle, ExternalLink, Loader2, Gift, CreditCard } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { STRIPE_TIERS } from "@/lib/stripe";
import { getSubscriptionTierLabel, getAccessReasonLabel } from "@/lib/displayLabels";

interface TrialStatusProps {
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  subscriptionStatus: string | null;
}

export const TrialStatus = ({ trialStartedAt, trialEndsAt, subscriptionStatus }: TrialStatusProps) => {
  const navigate = useNavigate();
  const { 
    tier, 
    subscribed, 
    loading, 
    portalLoading, 
    freeAccess, 
    accessReason, 
    openCustomerPortal, 
    subscriptionEnd,
    trial,
    trialEndsAt: hookTrialEndsAt,
    pastDue,
  } = useSubscription();

  const tierLabel = STRIPE_TIERS[tier]?.name || getSubscriptionTierLabel(tier);

  // Show past due warning
  if (pastDue && subscribed) {
    return (
      <Card className="border-warning">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-warning" />
            Payment Issue
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
            <div className="flex items-center gap-3 mb-2">
              <Badge variant="outline" className="border-warning text-warning">{tierLabel}</Badge>
              <span className="text-sm font-medium text-warning">Payment past due</span>
            </div>
            <p className="text-sm text-muted-foreground">
              There was an issue with your last payment. Please update your payment method to avoid service interruption.
            </p>
          </div>
          <Button variant="outline" onClick={openCustomerPortal} disabled={loading || portalLoading}>
            {portalLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ExternalLink className="w-4 h-4 mr-2" />}
            Update Payment Method
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Show free premium access status
  if (freeAccess) {
    return (
      <Card className="border-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" />
            Subscription Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-primary/10">
            <div className="flex items-center gap-3">
              <Badge className="bg-gradient-to-r from-primary to-primary/80">
                Free Forever ✨
              </Badge>
              <span className="text-sm">Full {tierLabel} access</span>
            </div>
          </div>
          {accessReason && (
            <p className="text-sm text-muted-foreground italic">
              {getAccessReasonLabel(accessReason)}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // Show Stripe trial (from subscription)
  if (trial && hookTrialEndsAt) {
    const now = new Date();
    const endDate = new Date(hookTrialEndsAt);
    const daysRemaining = Math.max(0, differenceInDays(endDate, now));
    const isExpired = now > endDate;

    if (!isExpired) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Trial Period
            </CardTitle>
            <CardDescription>
              Enjoying your {tierLabel} trial
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-primary/10">
              <div className="flex items-center gap-3">
                <Badge className="bg-primary">{tierLabel} Trial</Badge>
                <span className="text-sm">{daysRemaining} days remaining</span>
              </div>
            </div>
            <Progress value={(7 - daysRemaining) / 7 * 100} className="h-2" />
            <p className="text-xs text-muted-foreground">
              Trial ends {format(endDate, "MMM d, yyyy")}. Your subscription will begin automatically.
            </p>
            <Button variant="outline" onClick={openCustomerPortal} disabled={loading || portalLoading}>
              {portalLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ExternalLink className="w-4 h-4 mr-2" />}
              Manage Subscription
            </Button>
          </CardContent>
        </Card>
      );
    }
  }

  // Show active subscription status (paid)
  if (subscribed && !freeAccess) {
    return (
      <Card className="border-success/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-primary" />
            Subscription Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-success/10">
            <div className="flex items-center gap-3">
              <Badge className="bg-success">{tierLabel}</Badge>
              <span className="text-sm">Full access to all features</span>
            </div>
          </div>
          {subscriptionEnd && (
            <p className="text-xs text-muted-foreground">
              Renews on {format(new Date(subscriptionEnd), "MMM d, yyyy")}
            </p>
          )}
          <Button variant="outline" onClick={openCustomerPortal} disabled={loading || portalLoading}>
            {portalLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ExternalLink className="w-4 h-4 mr-2" />}
            Manage Subscription
          </Button>
        </CardContent>
      </Card>
    );
  }

  // No trial started - prompt to upgrade
  if (!trialStartedAt || !trialEndsAt) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5" />
            Subscription Status
          </CardTitle>
          <CardDescription>
            You're on the Free plan
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-muted">
            <p className="text-sm font-medium mb-2">Free plan includes:</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>✓ Custody calendar</li>
              <li>✓ Messaging hub</li>
              <li>✓ Child info hub (up to 4 kids)</li>
              <li>✓ Document vault</li>
              <li>✓ Law library & blog</li>
            </ul>
          </div>
          <Button onClick={() => navigate("/pricing")} className="w-full">
            Upgrade to Power - $5/month
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Local trial (co-parent linked trial)
  const now = new Date();
  const endDate = new Date(trialEndsAt);
  const startDate = new Date(trialStartedAt);
  const totalDays = 7;
  const daysRemaining = Math.max(0, differenceInDays(endDate, now));
  const daysUsed = totalDays - daysRemaining;
  const progress = (daysUsed / totalDays) * 100;
  const isExpired = now > endDate;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isExpired ? (
            <AlertTriangle className="w-5 h-5 text-warning" />
          ) : (
            <Clock className="w-5 h-5 text-primary" />
          )}
          {isExpired ? "Trial Expired" : "Free Trial"}
        </CardTitle>
        <CardDescription>
          {isExpired 
            ? "Your trial has ended. Subscribe to continue using premium features."
            : `Started ${format(startDate, "MMM d, yyyy")}`
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Trial progress</span>
            <span className="font-medium">
              {isExpired ? "Expired" : `${daysRemaining} days remaining`}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {isExpired ? (
          <>
            <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
              <p className="text-sm font-medium text-warning mb-2">Limited Access</p>
              <p className="text-xs text-muted-foreground">
                You can still use core features, but Power features like 
                Expenses, Court Exports, and Sports Hub are disabled.
              </p>
            </div>
            <Button onClick={() => navigate("/pricing")} className="w-full">
              Upgrade to Power
            </Button>
          </>
        ) : (
          <div className="p-4 rounded-lg bg-muted">
            <p className="text-sm font-medium mb-2">Trial includes Power features:</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>✓ Expense tracking & splitting</li>
              <li>✓ Court-ready exports</li>
              <li>✓ Youth Sports Hub</li>
              <li>✓ Up to 6 children</li>
              <li>✓ AI message assistance</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
