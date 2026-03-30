import { CheckCircle, ArrowRight, FileText, Receipt, Sparkles, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";

const PaymentSuccess = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background px-4 py-10 lg:py-16">
      <div className="mx-auto max-w-5xl">
        <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-6 lg:gap-8 items-start">
          <Card className="border-border shadow-sm overflow-hidden">
            <CardHeader className="pb-5 bg-gradient-to-br from-primary/5 via-background to-background">
              <div className="mx-auto w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
              </div>
              <CardTitle className="text-3xl text-center">Power plan confirmed</CardTitle>
              <CardDescription className="text-base text-center max-w-xl mx-auto">
                Your upgrade has been processed. Power features should now be available in the app.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-6 lg:p-8">
              <div className="rounded-2xl border border-border bg-muted/25 p-5">
                <h2 className="font-display font-semibold mb-2">What happens next</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Return to your dashboard to keep using CoParrent normally. If you want to confirm billing details
                  or review your plan, your subscription settings are the fastest place to check.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-border bg-card p-5">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 mb-4">
                    <Receipt className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-display font-semibold mb-2">Subscription settings</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Review the current plan, billing status, and account-level subscription details.
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-card p-5">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 mb-4">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-display font-semibold mb-2">Premium features</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Power unlocks broader workflow tools like expenses, stronger exports, AI assistance, and sports coordination.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button asChild size="lg" className="sm:flex-1">
                  <Link to="/dashboard" className="flex items-center justify-center gap-2">
                    Go to Dashboard
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
                <Button variant="outline" asChild size="lg" className="sm:flex-1">
                  <Link to="/dashboard/settings">View Subscription</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="border-border shadow-sm">
              <CardContent className="p-6">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 mb-4">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-xl font-display font-semibold mb-3">Good places to use Power first</h2>
                <div className="space-y-3">
                  <div className="rounded-xl border border-border bg-muted/20 p-4">
                    <h3 className="font-medium mb-1">Expenses and reimbursements</h3>
                    <p className="text-sm text-muted-foreground">
                      Track shared costs with clearer records and exportable reporting.
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/20 p-4">
                    <h3 className="font-medium mb-1">Court-ready exports</h3>
                    <p className="text-sm text-muted-foreground">
                      Pull together a more structured documentation package when you need a report.
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/20 p-4">
                    <h3 className="font-medium mb-1">Sports and activities</h3>
                    <p className="text-sm text-muted-foreground">
                      Coordinate events, logistics, and reminders without splitting details across tools.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm">
              <CardContent className="p-6">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 mb-4">
                  <Trophy className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-xl font-display font-semibold mb-3">Need help after upgrading?</h2>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  If the plan does not look right or a feature still appears locked, start with Settings and then use the Help Center if needed.
                </p>
                <div className="flex flex-col gap-3">
                  <Button asChild variant="outline">
                    <Link to="/help/contact">Contact Support</Link>
                  </Button>
                  <Button asChild variant="ghost">
                    <Link to="/help">Visit Help Center</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
