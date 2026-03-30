/**
 * RoleGate - Family-scoped role-based access control
 * 
 * CRITICAL: Role is per-family, NOT global.
 * A user who is Parent in Family A and Third-party in Family B
 * will see Parent features when Family A is active, and
 * restricted view when Family B is active.
 * 
 * Permissions are derived from effective role in the ACTIVE family.
 */

import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { UserX, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useFamilyRole } from "@/hooks/useFamilyRole";
import { useSubscription } from "@/hooks/useSubscription";
import { recordRoleDenial, getDenialContext } from "@/lib/denialTelemetry";
import { useFamily } from "@/contexts/FamilyContext";

interface RoleGateProps {
  children: ReactNode;
  /** Require parent or guardian role in ACTIVE family (not third-party) */
  requireParent?: boolean;
  /** Show inline message instead of full card overlay */
  inline?: boolean;
  /** Show nothing instead of access denied message when locked */
  hideWhenLocked?: boolean;
  /** Custom fallback component */
  fallback?: ReactNode;
  /** Custom message for restricted access */
  restrictedMessage?: string;
  /** Feature name for telemetry */
  featureName?: string;
}

/**
 * RoleGate - Family role-based access control
 * 
 * Restricts access based on family member role IN THE ACTIVE FAMILY:
 * - Parent: Full access to all features
 * - Guardian: Full access (treated as parent)
 * - Third-Party: Limited view-only access
 * - Child: Very limited access
 * 
 * Third-party restrictions (enforced both UI + server):
 * - Cannot edit calendar/schedule
 * - Cannot edit children info
 * - Cannot manage documents
 * - Cannot manage expenses
 * - Cannot access settings
 * - Can view: messages, calendar (read-only), journal, law library, blog
 */
export const RoleGate = ({
  children,
  requireParent = true,
  inline = false,
  hideWhenLocked = false,
  fallback,
  restrictedMessage = "This feature requires parent access.",
  featureName = "This feature",
}: RoleGateProps) => {
  const navigate = useNavigate();
  const { isParent, isThirdParty, isChild, loading, activeFamilyId } = useFamilyRole();
  const { activeFamily } = useFamily();
  const { tier } = useSubscription();

  // Check if user has required role IN THE ACTIVE FAMILY
  const hasAccess = requireParent ? isParent : true;

  // Record telemetry when access is denied
  useEffect(() => {
    if (!loading && !hasAccess && (isThirdParty || isChild)) {
      recordRoleDenial(
        featureName,
        isChild ? "child" : "third_party",
        tier || "free"
      );
    }
  }, [loading, hasAccess, isThirdParty, isChild, featureName, tier]);

  // Get user-friendly context
  const context = getDenialContext("role_restricted", featureName);

  if (loading) {
    return inline ? (
      <Skeleton className="h-8 w-full" />
    ) : (
      <Card className="border-dashed">
        <CardContent className="p-6">
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  if (hideWhenLocked) {
    return null;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (inline) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <UserX className="h-4 w-4" />
        <span>{context.title}</span>
      </div>
    );
  }

  // Build context-aware message showing which family has restrictions
  const familyName = activeFamily?.display_name || "this family";
  const roleLabel = isChild ? "child account" : "third-party member";

  return (
    <Card className="border-dashed border-2 border-muted-foreground/20 bg-muted/5">
      <CardContent className="p-6 flex flex-col items-center text-center gap-4">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
          <Users className="h-6 w-6 text-muted-foreground" />
        </div>
        
        <div className="space-y-2">
          <h3 className="font-semibold text-lg">{context.title}</h3>
          <p className="text-muted-foreground text-sm max-w-sm">
            {(isThirdParty || isChild)
              ? `You are a ${roleLabel} in ${familyName}. ${context.description}`
              : restrictedMessage
            }
          </p>
          {activeFamilyId && (
            <p className="text-xs text-muted-foreground/70">
              Switch families to access features where you have parent permissions.
            </p>
          )}
        </div>

        <Button variant="outline" onClick={() => navigate("/dashboard")}>
          {context.action.label}
        </Button>
      </CardContent>
    </Card>
  );
};
