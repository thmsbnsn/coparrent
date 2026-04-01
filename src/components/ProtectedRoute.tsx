/**
 * ProtectedRoute - Authentication and role-based route protection
 * 
 * CRITICAL: Role enforcement is per-family, NOT global.
 * A user's access to routes depends on their role in the ACTIVE family.
 * 
 * @see src/contexts/FamilyContext.tsx for role source of truth
 */

import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyRole } from "@/hooks/useFamilyRole";
import { useChildAccount } from "@/hooks/useChildAccount";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { getProtectedRouteAccessDecision } from "@/lib/routeAccess";
import { Button } from "@/components/ui/button";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireParent?: boolean;
}

/**
 * ProtectedRoute enforces authentication and per-family role-based access.
 * 
 * Role is determined by the user's membership in the ACTIVE family:
 * - Parent/Guardian in active family → full access
 * - Third-party in active family → limited routes
 * - Child in active family → minimal routes
 * 
 * Switching families changes available routes immediately.
 */
export const ProtectedRoute = ({ children, requireParent }: ProtectedRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  // Role is scoped to active family via useFamilyRole
  const { activeFamilyId, isThirdParty, isChild, isLawOffice, loading: roleLoading } = useFamilyRole();
  const { isChildAccount, loading: childLoading } = useChildAccount();
  const location = useLocation();

  if (authLoading || roleLoading || childLoading) {
    return <LoadingSpinner fullScreen message="Loading..." />;
  }

  if (!user) {
    return <Navigate to={location.pathname.startsWith("/law-office") ? "/law-office/login" : "/login"} replace />;
  }

  const accessDecision = getProtectedRouteAccessDecision(location.pathname, {
    activeFamilyId,
    requireParent,
    isThirdParty,
    isChild,
    isChildAccount,
    isLawOffice,
  });

  if (accessDecision.reason === "missing_active_family") {
    const blockedRoleLabel = isChild || isChildAccount || isThirdParty
      ? "Ask a parent or guardian to select the active family before opening this route."
      : "Select or create an active family before opening this route.";

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-border bg-card p-6 text-center space-y-4">
          <div className="space-y-2">
            <h1 className="text-xl font-semibold">Active family required</h1>
            <p className="text-sm text-muted-foreground">
              This route is family-scoped and cannot render without an active family.
            </p>
            <p className="text-sm text-muted-foreground">{blockedRoleLabel}</p>
          </div>

          {!isChild && !isChildAccount && (
            <Button asChild>
              <Link to="/onboarding">Open onboarding</Link>
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (!accessDecision.allowed && accessDecision.redirectTo) {
    return <Navigate to={accessDecision.redirectTo} replace />;
  }

  return <>{children}</>;
};
