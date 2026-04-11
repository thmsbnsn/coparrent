interface ProtectedRouteRule {
  allowChild: boolean;
  allowLawOffice: boolean;
  allowThirdParty: boolean;
  familyScoped: boolean;
  path: string;
}

const PROTECTED_ROUTE_RULES: readonly ProtectedRouteRule[] = [
  { path: "/dashboard/games", allowThirdParty: true, allowLawOffice: false, allowChild: true, familyScoped: true },
  { path: "/dashboard/calendar", allowThirdParty: true, allowLawOffice: false, allowChild: true, familyScoped: true },
  { path: "/dashboard/children", allowThirdParty: false, allowLawOffice: false, allowChild: false, familyScoped: true },
  { path: "/dashboard/messages", allowThirdParty: true, allowLawOffice: false, allowChild: true, familyScoped: true },
  { path: "/dashboard/calls", allowThirdParty: true, allowLawOffice: false, allowChild: false, familyScoped: true },
  { path: "/dashboard/documents", allowThirdParty: false, allowLawOffice: false, allowChild: false, familyScoped: true },
  { path: "/dashboard/settings", allowThirdParty: false, allowLawOffice: false, allowChild: false, familyScoped: true },
  { path: "/dashboard/families", allowThirdParty: false, allowLawOffice: false, allowChild: false, familyScoped: false },
  { path: "/dashboard/notifications", allowThirdParty: true, allowLawOffice: false, allowChild: true, familyScoped: false },
  { path: "/dashboard/law-library", allowThirdParty: true, allowLawOffice: false, allowChild: false, familyScoped: false },
  { path: "/dashboard/journal", allowThirdParty: true, allowLawOffice: false, allowChild: false, familyScoped: false },
  { path: "/dashboard/expenses", allowThirdParty: false, allowLawOffice: false, allowChild: false, familyScoped: true },
  { path: "/dashboard/sports", allowThirdParty: false, allowLawOffice: false, allowChild: false, familyScoped: true },
  { path: "/dashboard/gifts", allowThirdParty: false, allowLawOffice: false, allowChild: false, familyScoped: true },
  { path: "/dashboard/kid-center", allowThirdParty: false, allowLawOffice: false, allowChild: false, familyScoped: true },
  { path: "/dashboard/kids-hub", allowThirdParty: false, allowLawOffice: false, allowChild: false, familyScoped: true },
  { path: "/dashboard/audit", allowThirdParty: false, allowLawOffice: false, allowChild: false, familyScoped: true },
  { path: "/dashboard/blog", allowThirdParty: true, allowLawOffice: false, allowChild: false, familyScoped: false },
  { path: "/dashboard", allowThirdParty: true, allowLawOffice: false, allowChild: false, familyScoped: true },
  { path: "/law-office/dashboard", allowThirdParty: false, allowLawOffice: true, allowChild: false, familyScoped: false },
  { path: "/onboarding", allowThirdParty: true, allowLawOffice: false, allowChild: false, familyScoped: false },
  { path: "/kids/portal", allowThirdParty: false, allowLawOffice: false, allowChild: true, familyScoped: true },
  { path: "/kids/games", allowThirdParty: false, allowLawOffice: false, allowChild: true, familyScoped: true },
  { path: "/kids", allowThirdParty: false, allowLawOffice: false, allowChild: true, familyScoped: true },
  { path: "/admin", allowThirdParty: false, allowLawOffice: false, allowChild: false, familyScoped: false },
  { path: "/pwa-diagnostics", allowThirdParty: true, allowLawOffice: false, allowChild: true, familyScoped: false },
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
  isLawOffice?: boolean;
  isThirdParty?: boolean;
  requireParent?: boolean;
}

export interface ProtectedRouteAccessDecision {
  allowed: boolean;
  redirectTo: string | null;
  reason:
    | "allowed"
    | "child_route_restricted"
    | "law_office_role_required"
    | "law_office_route_restricted"
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
  const isLawOfficeUser = Boolean(options.isLawOffice);

  if (!routeRule) {
    return {
      allowed: false,
      redirectTo: isLawOfficeUser ? "/law-office/dashboard" : isChildScopedUser ? "/kids" : "/dashboard",
      reason: "route_not_registered",
    };
  }

  if (isLawOfficeUser && !routeRule.allowLawOffice) {
    return {
      allowed: false,
      redirectTo: "/law-office/dashboard",
      reason: "law_office_route_restricted",
    };
  }

  if (!isLawOfficeUser && routeRule.allowLawOffice) {
    return {
      allowed: false,
      redirectTo: isChildScopedUser ? "/kids" : "/dashboard",
      reason: "law_office_role_required",
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

  if (options.requireParent && isLawOfficeUser) {
    return {
      allowed: false,
      redirectTo: "/law-office/dashboard",
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
