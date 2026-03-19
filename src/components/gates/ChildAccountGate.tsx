import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useChildAccount } from "@/hooks/useChildAccount";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { recordChildDenial } from "@/lib/denialTelemetry";
import { isParentOnlyRoute } from "@/lib/routeAccess";

interface ChildAccountGateProps {
  children: React.ReactNode;
  requireParent?: boolean;
  fallback?: React.ReactNode;
  /** Feature name for telemetry */
  featureName?: string;
}

export const ChildAccountGate = ({
  children,
  requireParent = false,
  fallback,
  featureName = "This feature",
}: ChildAccountGateProps) => {
  const { isChildAccount, permissions, loading } = useChildAccount();
  const location = useLocation();

  // Record telemetry when child is blocked
  useEffect(() => {
    if (!loading && isChildAccount) {
      const isParentOnly = isParentOnlyRoute(location.pathname);

      if (requireParent || isParentOnly) {
        recordChildDenial(featureName, "free");
      }
    }
  }, [loading, isChildAccount, requireParent, location.pathname, featureName]);

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading..." />;
  }

  // If this route requires parent access and user is a child
  if (requireParent && isChildAccount) {
    return fallback ? <>{fallback}</> : <Navigate to="/kids" replace />;
  }

  // Check if child is trying to access parent-only routes
  if (isChildAccount) {
    if (isParentOnlyRoute(location.pathname)) {
      return <Navigate to="/kids" replace />;
    }
  }

  // Check if login is disabled for child account
  if (isChildAccount && !permissions.login_enabled) {
    // Redirect to login - session should be invalidated
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// HOC for easy use with route definitions
export function withParentOnly<P extends object>(
  WrappedComponent: React.ComponentType<P>
): React.FC<P> {
  return function ParentOnlyComponent(props: P) {
    return (
      <ChildAccountGate requireParent>
        <WrappedComponent {...props} />
      </ChildAccountGate>
    );
  };
}
