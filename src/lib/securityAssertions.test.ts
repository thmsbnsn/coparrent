import { describe, expect, it } from "vitest";
import {
  assertChildRouteRestriction,
  assertRouteProtected,
  getSecurityViolations,
  hasCriticalViolations,
  runSecurityAssertions,
} from "@/lib/securityAssertions";

describe("securityAssertions", () => {
  it("allows third-party users on shared routes and blocks parent-only routes", () => {
    expect(assertRouteProtected("/dashboard/messages/thread-1", "third_party").passed).toBe(true);
    expect(assertRouteProtected("/dashboard/settings", "third_party").passed).toBe(false);
  });

  it("allows child accounts on approved routes and blocks restricted ones", () => {
    expect(assertChildRouteRestriction("/dashboard/calendar/day", true).passed).toBe(true);
    expect(assertChildRouteRestriction("/dashboard/expenses", true).passed).toBe(false);
  });

  it("surfaces critical violations when a restricted user is on a blocked route", () => {
    const results = runSecurityAssertions({
      pathname: "/dashboard/settings",
      role: "third_party",
      isChildAccount: false,
      isAdmin: false,
      adminSource: "user_roles_table",
      subscriptionSource: "profile_database",
      trialEndsAt: null,
    });

    const violations = getSecurityViolations(results);

    expect(violations.some((violation) => violation.invariant === "ROUTE_PROTECTION")).toBe(true);
    expect(hasCriticalViolations(results)).toBe(true);
  });

  it("keeps clean contexts free of route violations", () => {
    const results = runSecurityAssertions({
      pathname: "/dashboard/messages/thread-1",
      role: "third_party",
      isChildAccount: false,
      isAdmin: false,
      adminSource: "user_roles_table",
      subscriptionSource: "profile_database",
      trialEndsAt: null,
    });

    expect(getSecurityViolations(results)).toEqual([]);
  });
});
