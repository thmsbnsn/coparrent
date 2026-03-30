import { describe, expect, it } from "vitest";
import {
  canThirdPartyAccessRoute,
  getProtectedRouteAccessDecision,
  isKnownProtectedRoute,
  isChildAllowedRoute,
  isParentOnlyRoute,
  requiresActiveFamilyScope,
} from "@/lib/routeAccess";

describe("routeAccess", () => {
  it("matches nested parent-only routes", () => {
    expect(isParentOnlyRoute("/dashboard/settings/security")).toBe(true);
    expect(isParentOnlyRoute("/dashboard/families/new")).toBe(true);
    expect(isParentOnlyRoute("/dashboard/messages/thread-1")).toBe(false);
  });

  it("keeps child accounts inside their allowed route set", () => {
    expect(isChildAllowedRoute("/dashboard/messages/thread-1")).toBe(true);
    expect(isChildAllowedRoute("/dashboard/expenses")).toBe(false);

    expect(
      getProtectedRouteAccessDecision("/dashboard/expenses", {
        activeFamilyId: "family-1",
        isChildAccount: true,
      }),
    ).toEqual({
      allowed: false,
      redirectTo: "/kids",
      reason: "child_route_restricted",
    });
  });

  it("blocks third-party users from parent-only routes while allowing approved read paths", () => {
    expect(canThirdPartyAccessRoute("/dashboard/messages/thread-1")).toBe(true);
    expect(canThirdPartyAccessRoute("/dashboard/settings")).toBe(false);

    expect(
      getProtectedRouteAccessDecision("/dashboard/settings", {
        activeFamilyId: "family-1",
        isThirdParty: true,
      }),
    ).toEqual({
      allowed: false,
      redirectTo: "/dashboard",
      reason: "third_party_route_restricted",
    });
  });

  it("enforces requireParent even on otherwise allowed routes", () => {
    expect(
      getProtectedRouteAccessDecision("/dashboard/messages", {
        activeFamilyId: "family-1",
        isThirdParty: true,
        requireParent: true,
      }),
    ).toEqual({
      allowed: false,
      redirectTo: "/dashboard",
      reason: "parent_role_required",
    });
  });

  it("allows parent-scoped users through protected routes", () => {
    expect(
      getProtectedRouteAccessDecision("/dashboard/expenses", {
        activeFamilyId: "family-1",
        isThirdParty: false,
        isChild: false,
        isChildAccount: false,
      }),
    ).toEqual({
      allowed: true,
      redirectTo: null,
      reason: "allowed",
    });
  });

  it("fails closed for unknown protected routes", () => {
    expect(isKnownProtectedRoute("/dashboard/not-registered")).toBe(false);

    expect(
      getProtectedRouteAccessDecision("/dashboard/not-registered", {
        activeFamilyId: "family-1",
      }),
    ).toEqual({
      allowed: false,
      redirectTo: "/dashboard",
      reason: "route_not_registered",
    });
  });

  it("requires active family scope only for registered family routes", () => {
    expect(requiresActiveFamilyScope("/dashboard/messages")).toBe(true);
    expect(requiresActiveFamilyScope("/dashboard/law-library")).toBe(false);

    expect(
      getProtectedRouteAccessDecision("/dashboard/messages", {
        isThirdParty: false,
      }),
    ).toEqual({
      allowed: false,
      redirectTo: null,
      reason: "missing_active_family",
    });

    expect(
      getProtectedRouteAccessDecision("/dashboard/law-library", {
        isThirdParty: true,
      }),
    ).toEqual({
      allowed: true,
      redirectTo: null,
      reason: "allowed",
    });
  });
});
