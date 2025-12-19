import { differenceInDays, format } from "date-fns";
import { Clock, Crown, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface TrialStatusProps {
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  subscriptionStatus: string | null;
}

export const TrialStatus = ({ trialStartedAt, trialEndsAt, subscriptionStatus }: TrialStatusProps) => {
  if (!trialStartedAt || !trialEndsAt) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5" />
            Subscription Status
          </CardTitle>
          <CardDescription>
            Link with your co-parent to start your 7-day free trial
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 rounded-lg bg-muted text-center">
            <p className="text-sm text-muted-foreground">
              Invite your co-parent to unlock all features and start your free trial.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const now = new Date();
  const endDate = new Date(trialEndsAt);
  const startDate = new Date(trialStartedAt);
  const totalDays = 7;
  const daysRemaining = Math.max(0, differenceInDays(endDate, now));
  const daysUsed = totalDays - daysRemaining;
  const progress = (daysUsed / totalDays) * 100;
  const isExpired = now > endDate;

  if (subscriptionStatus === "active") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-primary" />
            Subscription Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/10">
            <Badge className="bg-primary">Active</Badge>
            <span className="text-sm">Full access to all features</span>
          </div>
        </CardContent>
      </Card>
    );
  }

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
            ? "Your trial has ended. Some features are now limited."
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
          <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
            <p className="text-sm font-medium text-warning mb-2">Limited Access</p>
            <p className="text-xs text-muted-foreground">
              You can still view your calendar and messages, but some features like 
              document generation and schedule change requests are disabled.
            </p>
          </div>
        ) : (
          <div className="p-4 rounded-lg bg-muted">
            <p className="text-sm font-medium mb-2">Trial includes:</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>✓ Unlimited messages</li>
              <li>✓ Full calendar access</li>
              <li>✓ Schedule change requests</li>
              <li>✓ Document generation</li>
              <li>✓ Child information hub</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
