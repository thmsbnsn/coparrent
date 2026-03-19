import { describe, expect, it } from "vitest";
import {
  canThirdPartyAccessRoute,
  getProtectedRouteAccessDecision,
  isChildAllowedRoute,
  isParentOnlyRoute,
} from "@/lib/routeAccess";

describe("routeAccess", () => {
  it("matches nested parent-only routes", () => {
    expect(isParentOnlyRoute("/dashboard/settings/security")).toBe(true);
    expect(isParentOnlyRoute("/dashboard/messages/thread-1")).toBe(false);
  });

  it("keeps child accounts inside their allowed route set", () => {
    expect(isChildAllowedRoute("/dashboard/messages/thread-1")).toBe(true);
    expect(isChildAllowedRoute("/dashboard/expenses")).toBe(false);

    expect(
      getProtectedRouteAccessDecision("/dashboard/expenses", {
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
});
