export const PARENT_ONLY_ROUTES = [
  "/dashboard/children",
  "/dashboard/documents",
  "/dashboard/expenses",
  "/dashboard/settings",
  "/dashboard/audit",
  "/dashboard/law-library",
  "/dashboard/kids-hub",
  "/admin",
] as const;

export const THIRD_PARTY_ALLOWED_ROUTES = [
  "/dashboard",
  "/dashboard/messages",
  "/dashboard/calendar",
  "/dashboard/journal",
  "/dashboard/blog",
  "/dashboard/notifications",
  "/onboarding",
] as const;

export const CHILD_ALLOWED_ROUTES = [
  "/kids",
  "/dashboard/messages",
  "/dashboard/calendar",
  "/dashboard/notifications",
] as const;

export interface ProtectedRouteAccessOptions {
  requireParent?: boolean;
  isThirdParty?: boolean;
  isChild?: boolean;
  isChildAccount?: boolean;
}

export interface ProtectedRouteAccessDecision {
  allowed: boolean;
  redirectTo: string | null;
  reason:
    | "allowed"
    | "child_route_restricted"
    | "parent_role_required"
    | "third_party_route_restricted";
}

const EXACT_MATCH_ROUTES = new Set(["/dashboard"]);

export const matchesRoutePrefix = (pathname: string, route: string): boolean =>
  EXACT_MATCH_ROUTES.has(route)
    ? pathname === route
    : pathname === route || pathname.startsWith(`${route}/`);

export const matchesAnyProtectedRoute = (
  pathname: string,
  routes: readonly string[],
): boolean => routes.some((route) => matchesRoutePrefix(pathname, route));

export const isParentOnlyRoute = (pathname: string): boolean =>
  matchesAnyProtectedRoute(pathname, PARENT_ONLY_ROUTES);

export const isThirdPartyAllowedRoute = (pathname: string): boolean =>
  matchesAnyProtectedRoute(pathname, THIRD_PARTY_ALLOWED_ROUTES);

export const isChildAllowedRoute = (pathname: string): boolean =>
  matchesAnyProtectedRoute(pathname, CHILD_ALLOWED_ROUTES);

export const canThirdPartyAccessRoute = (pathname: string): boolean =>
  !isParentOnlyRoute(pathname) || isThirdPartyAllowedRoute(pathname);

export function getProtectedRouteAccessDecision(
  pathname: string,
  options: ProtectedRouteAccessOptions,
): ProtectedRouteAccessDecision {
  const isChildScopedUser = Boolean(options.isChild || options.isChildAccount);

  if (isChildScopedUser && !isChildAllowedRoute(pathname)) {
    return {
      allowed: false,
      redirectTo: "/kids",
      reason: "child_route_restricted",
    };
  }

  if (options.requireParent && (options.isThirdParty || isChildScopedUser)) {
    return {
      allowed: false,
      redirectTo: isChildScopedUser ? "/kids" : "/dashboard",
      reason: "parent_role_required",
    };
  }

  if (options.isThirdParty && !isChildScopedUser && !canThirdPartyAccessRoute(pathname)) {
    return {
      allowed: false,
      redirectTo: "/dashboard",
      reason: "third_party_route_restricted",
    };
  }

  return {
    allowed: true,
    redirectTo: null,
    reason: "allowed",
  };
}
