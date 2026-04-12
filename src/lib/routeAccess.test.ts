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
    expect(isParentOnlyRoute("/dashboard/settings/child-access/child-1")).toBe(true);
    expect(isParentOnlyRoute("/dashboard/families/new")).toBe(true);
    expect(isParentOnlyRoute("/dashboard/messages/thread-1")).toBe(false);
  });

  it("keeps child accounts inside their allowed route set", () => {
    expect(isChildAllowedRoute("/dashboard/games")).toBe(true);
    expect(isChildAllowedRoute("/dashboard/games/flappy-plane/challenges")).toBe(true);
    expect(isChildAllowedRoute("/dashboard/games/flappy-plane/lobby/session-1")).toBe(true);
    expect(isChildAllowedRoute("/dashboard/messages/thread-1")).toBe(true);
    expect(isChildAllowedRoute("/dashboard/calls")).toBe(false);
    expect(isChildAllowedRoute("/kids/portal")).toBe(true);
    expect(isChildAllowedRoute("/kids/games/flappy-plane")).toBe(true);
    expect(isChildAllowedRoute("/dashboard/expenses")).toBe(false);
    expect(isChildAllowedRoute("/pwa-diagnostics")).toBe(true);

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
    expect(canThirdPartyAccessRoute("/dashboard/games")).toBe(true);
    expect(canThirdPartyAccessRoute("/dashboard/messages/thread-1")).toBe(true);
    expect(canThirdPartyAccessRoute("/dashboard/calls")).toBe(true);
    expect(canThirdPartyAccessRoute("/dashboard/media")).toBe(false);
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
    expect(requiresActiveFamilyScope("/dashboard/games")).toBe(true);
    expect(requiresActiveFamilyScope("/dashboard/games/flappy-plane/challenges")).toBe(true);
    expect(requiresActiveFamilyScope("/dashboard/games/flappy-plane/lobby/session-1")).toBe(true);
    expect(requiresActiveFamilyScope("/dashboard/messages")).toBe(true);
    expect(requiresActiveFamilyScope("/dashboard/calls")).toBe(true);
    expect(requiresActiveFamilyScope("/dashboard/media")).toBe(true);
    expect(requiresActiveFamilyScope("/dashboard/settings/child-access/child-1")).toBe(true);
    expect(requiresActiveFamilyScope("/kids/portal")).toBe(true);
    expect(requiresActiveFamilyScope("/kids/games/flappy-plane")).toBe(true);
    expect(requiresActiveFamilyScope("/law-office/dashboard")).toBe(false);
    expect(requiresActiveFamilyScope("/dashboard/law-library")).toBe(false);
    expect(requiresActiveFamilyScope("/pwa-diagnostics")).toBe(false);

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
      getProtectedRouteAccessDecision("/dashboard/media", {
        activeFamilyId: "family-1",
        isThirdParty: true,
      }),
    ).toEqual({
      allowed: false,
      redirectTo: "/dashboard",
      reason: "third_party_route_restricted",
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

    expect(
      getProtectedRouteAccessDecision("/pwa-diagnostics", {
        isChildAccount: true,
      }),
    ).toEqual({
      allowed: true,
      redirectTo: null,
      reason: "allowed",
    });

    expect(
      getProtectedRouteAccessDecision("/pwa-diagnostics", {
        isThirdParty: true,
      }),
    ).toEqual({
      allowed: true,
      redirectTo: null,
      reason: "allowed",
    });
  });

  it("keeps law office users inside law office routes", () => {
    expect(
      getProtectedRouteAccessDecision("/dashboard/messages", {
        activeFamilyId: "family-1",
        isLawOffice: true,
      }),
    ).toEqual({
      allowed: false,
      redirectTo: "/law-office/dashboard",
      reason: "law_office_route_restricted",
    });

    expect(
      getProtectedRouteAccessDecision("/law-office/dashboard", {
        isLawOffice: false,
      }),
    ).toEqual({
      allowed: false,
      redirectTo: "/dashboard",
      reason: "law_office_role_required",
    });

    expect(
      getProtectedRouteAccessDecision("/law-office/dashboard", {
        isLawOffice: true,
      }),
    ).toEqual({
      allowed: true,
      redirectTo: null,
      reason: "allowed",
    });
  });
});
