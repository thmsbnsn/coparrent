/**
 * OnboardingStatus - Detects and displays missing onboarding state
 * 
 * Eliminates "dead-ends" during first session by:
 * - Detecting unlinked co-parent states
 * - Detecting missing children
 * - Explaining what's missing
 * - Explaining how to proceed
 * 
 * Never leaves the user guessing.
 */

import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, 
  Baby, 
  Link2, 
  ArrowRight, 
  X,
  CheckCircle2,
  AlertCircle,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface OnboardingItem {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  complete: boolean;
  action: {
    label: string;
    href: string;
  };
  /** Severity: optional = nice-to-have, recommended = should do, required = must do */
  severity: "optional" | "recommended" | "required";
}

interface OnboardingStatusProps {
  /** Show as a compact banner vs. full card */
  variant?: "banner" | "card" | "minimal";
  /** Allow dismissing (persists for session) */
  dismissible?: boolean;
  /** Show only if incomplete items exist */
  hideWhenComplete?: boolean;
  className?: string;
}

export function OnboardingStatus({
  variant = "card",
  dismissible = true,
  hideWhenComplete = true,
  className,
}: OnboardingStatusProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<OnboardingItem[]>([]);

  useEffect(() => {
    if (!user) return;

    const checkOnboardingStatus = async () => {
      setLoading(true);
      
      try {
        // Fetch profile with co_parent_id
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, co_parent_id, full_name, account_role")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!profile) {
          setLoading(false);
          return;
        }

        // Check for children
        const { count: childCount } = await supabase
          .from("parent_children")
          .select("*", { count: "exact", head: true })
          .eq("parent_id", profile.id);

        // Check for pending invitations
        const { count: pendingInvites } = await supabase
          .from("invitations")
          .select("*", { count: "exact", head: true })
          .eq("inviter_id", profile.id)
          .eq("status", "pending");

        const hasChildren = (childCount || 0) > 0;
        const hasCoParent = !!profile.co_parent_id;
        const hasRole = !!profile.account_role;
        const hasPendingInvite = (pendingInvites || 0) > 0;

        const newItems: OnboardingItem[] = [];

        // Check role setup
        if (!hasRole) {
          newItems.push({
            id: "role",
            title: "Set your role",
            description: "Tell us whether you're a father, mother, or guardian.",
            icon: Users,
            complete: false,
            action: { label: "Set Role", href: "/onboarding" },
            severity: "required",
          });
        }

        // Check children
        if (!hasChildren) {
          newItems.push({
            id: "children",
            title: "Add your children",
            description: "Create profiles for your kids to start tracking schedules and activities.",
            icon: Baby,
            complete: false,
            action: { label: "Add Children", href: "/dashboard/children" },
            severity: "required",
          });
        } else {
          newItems.push({
            id: "children",
            title: "Children added",
            description: `You have ${childCount} child${childCount !== 1 ? "ren" : ""} set up.`,
            icon: Baby,
            complete: true,
            action: { label: "View", href: "/dashboard/children" },
            severity: "required",
          });
        }

        // Check co-parent
        if (!hasCoParent) {
          if (hasPendingInvite) {
            newItems.push({
              id: "coparent",
              title: "Waiting for co-parent",
              description: "Your invitation is pending. Your co-parent will receive an email to join.",
              icon: Link2,
              complete: false,
              action: { label: "Manage Invite", href: "/dashboard/settings" },
              severity: "recommended",
            });
          } else {
            newItems.push({
              id: "coparent",
              title: "Invite your co-parent",
              description: "Link with your co-parent to share schedules and communicate seamlessly.",
              icon: Link2,
              complete: false,
              action: { label: "Send Invite", href: "/dashboard/settings" },
              severity: "recommended",
            });
          }
        } else {
          newItems.push({
            id: "coparent",
            title: "Co-parent connected",
            description: "You're linked with your co-parent.",
            icon: Link2,
            complete: true,
            action: { label: "View", href: "/dashboard/settings" },
            severity: "recommended",
          });
        }

        setItems(newItems);
      } catch (error) {
        console.error("Error checking onboarding status:", error);
      } finally {
        setLoading(false);
      }
    };

    checkOnboardingStatus();
  }, [user]);

  // Calculate progress
  const completedCount = items.filter(i => i.complete).length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const isComplete = completedCount === totalCount;

  // Hide if complete and configured to do so
  if (hideWhenComplete && isComplete && !loading) {
    return null;
  }

  // Hide if dismissed
  if (dismissed) {
    return null;
  }

  // Find first incomplete item for CTA
  const nextItem = items.find(i => !i.complete);

  if (loading) {
    return null; // Don't show skeleton, just wait
  }

  // Minimal variant - just shows next action
  if (variant === "minimal" && nextItem) {
    return (
      <div className={cn("flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20", className)}>
        <Info className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm flex-1">{nextItem.description}</span>
        <Button size="sm" variant="ghost" asChild>
          <Link to={nextItem.action.href}>
            {nextItem.action.label}
            <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </div>
    );
  }

  // Banner variant
  if (variant === "banner") {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={cn(
            "relative flex items-center gap-4 p-4 rounded-lg border",
            isComplete 
              ? "bg-success/5 border-success/20" 
              : "bg-primary/5 border-primary/20",
            className
          )}
        >
          <div className="flex-1 flex items-center gap-4">
            <div className="flex items-center gap-2">
              {isComplete ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : (
                <AlertCircle className="h-5 w-5 text-primary" />
              )}
              <span className="font-medium">
                {isComplete 
                  ? "Setup complete!" 
                  : `${completedCount}/${totalCount} steps complete`}
              </span>
            </div>
            
            <Progress value={progress} className="w-32 h-2" />
            
            {nextItem && (
              <Button size="sm" asChild>
                <Link to={nextItem.action.href}>
                  {nextItem.action.label}
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            )}
          </div>

          {dismissible && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={() => setDismissed(true)}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </motion.div>
      </AnimatePresence>
    );
  }

  // Card variant (default)
  return (
    <Card className={cn("border-primary/20", className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-lg">Get Started</h3>
            <p className="text-sm text-muted-foreground">
              {isComplete 
                ? "You're all set up!" 
                : "Complete these steps to get the most out of CoParrent"}
            </p>
          </div>
          
          {dismissible && !isComplete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 -mt-1 -mr-2"
              onClick={() => setDismissed(true)}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{completedCount}/{totalCount}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg transition-colors",
                item.complete 
                  ? "bg-muted/50" 
                  : "bg-primary/5 hover:bg-primary/10"
              )}
            >
              <div className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                item.complete 
                  ? "bg-success/20 text-success" 
                  : "bg-primary/20 text-primary"
              )}>
                {item.complete ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <item.icon className="h-4 w-4" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "font-medium text-sm",
                  item.complete && "text-muted-foreground"
                )}>
                  {item.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.description}
                </p>
              </div>

              {!item.complete && (
                <Button size="sm" variant="ghost" asChild className="shrink-0">
                  <Link to={item.action.href}>
                    {item.action.label}
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Hook to check if user has completed basic onboarding
 */
export function useOnboardingComplete() {
  const { user } = useAuth();
  const [isComplete, setIsComplete] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsComplete(null);
      setIsLoading(false);
      return;
    }

    const check = async () => {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, account_role")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!profile) {
          setIsComplete(false);
          return;
        }

        const { count } = await supabase
          .from("parent_children")
          .select("*", { count: "exact", head: true })
          .eq("parent_id", profile.id);

        // Minimum: has role and at least one child
        setIsComplete(!!(profile.account_role && (count || 0) > 0));
      } catch (error) {
        console.error("Error checking onboarding:", error);
        setIsComplete(false);
      } finally {
        setIsLoading(false);
      }
    };

    check();
  }, [user]);

  return { isComplete, isLoading };
}
