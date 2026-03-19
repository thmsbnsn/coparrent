/**
 * ProtectedRoute - Authentication and role-based route protection
 * 
 * CRITICAL: Role enforcement is per-family, NOT global.
 * A user's access to routes depends on their role in the ACTIVE family.
 * 
 * @see src/contexts/FamilyContext.tsx for role source of truth
 */

import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyRole } from "@/hooks/useFamilyRole";
import { useChildAccount } from "@/hooks/useChildAccount";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { getProtectedRouteAccessDecision } from "@/lib/routeAccess";

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
  const { isThirdParty, isChild, loading: roleLoading } = useFamilyRole();
  const { isChildAccount, loading: childLoading } = useChildAccount();
  const location = useLocation();

  if (authLoading || roleLoading || childLoading) {
    return <LoadingSpinner fullScreen message="Loading..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const accessDecision = getProtectedRouteAccessDecision(location.pathname, {
    requireParent,
    isThirdParty,
    isChild,
    isChildAccount,
  });

  if (!accessDecision.allowed && accessDecision.redirectTo) {
    return <Navigate to={accessDecision.redirectTo} replace />;
  }

  return <>{children}</>;
};
