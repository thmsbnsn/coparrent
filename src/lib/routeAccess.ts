interface ProtectedRouteRule {
  allowChild: boolean;
  allowThirdParty: boolean;
  familyScoped: boolean;
  path: string;
}

const PROTECTED_ROUTE_RULES: readonly ProtectedRouteRule[] = [
  { path: "/dashboard/calendar", allowThirdParty: true, allowChild: true, familyScoped: true },
  { path: "/dashboard/children", allowThirdParty: false, allowChild: false, familyScoped: true },
  { path: "/dashboard/messages", allowThirdParty: true, allowChild: true, familyScoped: true },
  { path: "/dashboard/documents", allowThirdParty: false, allowChild: false, familyScoped: true },
  { path: "/dashboard/settings", allowThirdParty: false, allowChild: false, familyScoped: true },
  { path: "/dashboard/families", allowThirdParty: false, allowChild: false, familyScoped: false },
  { path: "/dashboard/notifications", allowThirdParty: true, allowChild: true, familyScoped: false },
  { path: "/dashboard/law-library", allowThirdParty: true, allowChild: false, familyScoped: false },
  { path: "/dashboard/journal", allowThirdParty: true, allowChild: false, familyScoped: false },
  { path: "/dashboard/expenses", allowThirdParty: false, allowChild: false, familyScoped: true },
  { path: "/dashboard/sports", allowThirdParty: false, allowChild: false, familyScoped: true },
  { path: "/dashboard/gifts", allowThirdParty: false, allowChild: false, familyScoped: true },
  { path: "/dashboard/kid-center", allowThirdParty: false, allowChild: false, familyScoped: true },
  { path: "/dashboard/kids-hub", allowThirdParty: false, allowChild: false, familyScoped: true },
  { path: "/dashboard/audit", allowThirdParty: false, allowChild: false, familyScoped: true },
  { path: "/dashboard/blog", allowThirdParty: true, allowChild: false, familyScoped: false },
  { path: "/dashboard", allowThirdParty: true, allowChild: false, familyScoped: true },
  { path: "/onboarding", allowThirdParty: true, allowChild: false, familyScoped: false },
  { path: "/kids", allowThirdParty: false, allowChild: true, familyScoped: true },
  { path: "/admin", allowThirdParty: false, allowChild: false, familyScoped: false },
] as const;

export const PARENT_ONLY_ROUTES = PROTECTED_ROUTE_RULES.filter(
  (rule) => !rule.allowThirdParty && !rule.allowChild,
).map((rule) => rule.path);

export const THIRD_PARTY_ALLOWED_ROUTES = PROTECTED_ROUTE_RULES.filter(
  (rule) => rule.allowThirdParty,
).map((rule) => rule.path);

export const CHILD_ALLOWED_ROUTES = PROTECTED_ROUTE_RULES.filter(
  (rule) => rule.allowChild,
).map((rule) => rule.path);

export interface ProtectedRouteAccessOptions {
  activeFamilyId?: string | null;
  isChild?: boolean;
  isChildAccount?: boolean;
  isThirdParty?: boolean;
  requireParent?: boolean;
}

export interface ProtectedRouteAccessDecision {
  allowed: boolean;
  redirectTo: string | null;
  reason:
    | "allowed"
    | "child_route_restricted"
    | "missing_active_family"
    | "parent_role_required"
    | "route_not_registered"
    | "third_party_route_restricted";
}

const EXACT_MATCH_ROUTES = new Set(["/admin", "/dashboard", "/kids", "/onboarding"]);

export const matchesRoutePrefix = (pathname: string, route: string): boolean =>
  EXACT_MATCH_ROUTES.has(route)
    ? pathname === route
    : pathname === route || pathname.startsWith(`${route}/`);

export const matchesAnyProtectedRoute = (
  pathname: string,
  routes: readonly string[],
): boolean => routes.some((route) => matchesRoutePrefix(pathname, route));

const getProtectedRouteRule = (pathname: string): ProtectedRouteRule | null =>
  PROTECTED_ROUTE_RULES.find((rule) => matchesRoutePrefix(pathname, rule.path)) ?? null;

export const isKnownProtectedRoute = (pathname: string): boolean => Boolean(getProtectedRouteRule(pathname));

export const requiresActiveFamilyScope = (pathname: string): boolean =>
  getProtectedRouteRule(pathname)?.familyScoped ?? false;

export const isParentOnlyRoute = (pathname: string): boolean => {
  const routeRule = getProtectedRouteRule(pathname);
  return Boolean(routeRule && !routeRule.allowThirdParty && !routeRule.allowChild);
};

export const isThirdPartyAllowedRoute = (pathname: string): boolean =>
  getProtectedRouteRule(pathname)?.allowThirdParty ?? false;

export const isChildAllowedRoute = (pathname: string): boolean =>
  getProtectedRouteRule(pathname)?.allowChild ?? false;

export const canThirdPartyAccessRoute = (pathname: string): boolean =>
  getProtectedRouteRule(pathname)?.allowThirdParty ?? false;

export const canAccessProtectedRoute = (
  pathname: string,
  options: ProtectedRouteAccessOptions,
): boolean => getProtectedRouteAccessDecision(pathname, options).allowed;

export function getProtectedRouteAccessDecision(
  pathname: string,
  options: ProtectedRouteAccessOptions,
): ProtectedRouteAccessDecision {
  const routeRule = getProtectedRouteRule(pathname);
  const isChildScopedUser = Boolean(options.isChild || options.isChildAccount);

  if (!routeRule) {
    return {
      allowed: false,
      redirectTo: isChildScopedUser ? "/kids" : "/dashboard",
      reason: "route_not_registered",
    };
  }

  if (routeRule.familyScoped && !options.activeFamilyId) {
    return {
      allowed: false,
      redirectTo: null,
      reason: "missing_active_family",
    };
  }

  if (isChildScopedUser && !routeRule.allowChild) {
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

  if (options.isThirdParty && !isChildScopedUser && !routeRule.allowThirdParty) {
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
