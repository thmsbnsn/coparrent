import { describe, expect, it } from "vitest";
import {
  getPlanLimits,
  getTierDisplayName,
  hasFeatureAccess,
  isGracePeriodActive,
  normalizeTier,
  PLAN_LIMITS,
} from "@/lib/planLimits";

describe("planLimits", () => {
  it("maps legacy paid tiers to power", () => {
    expect(normalizeTier("premium")).toBe("power");
    expect(normalizeTier("mvp")).toBe("power");
    expect(getPlanLimits("premium")).toBe(PLAN_LIMITS.power);
  });

  it("falls back unknown or missing tiers to free", () => {
    expect(normalizeTier(undefined)).toBe("free");
    expect(normalizeTier("enterprise")).toBe("free");
    expect(getPlanLimits("enterprise")).toBe(PLAN_LIMITS.free);
  });

  it("reports feature access from the normalized tier", () => {
    expect(hasFeatureAccess("power", "active", "sportsHub")).toBe(true);
    expect(hasFeatureAccess("premium", "active", "courtExports")).toBe(true);
    expect(hasFeatureAccess("free", "none", "expenses")).toBe(false);
  });

  it("keeps past-due users on power during the grace period", () => {
    const future = "2026-04-07T12:00:00.000Z";
    const now = new Date("2026-04-03T12:00:00.000Z");

    expect(isGracePeriodActive("past_due", future, now)).toBe(true);
    expect(normalizeTier("power", "past_due", future, now)).toBe("power");
    expect(hasFeatureAccess("power", "past_due", "expenses", future, now)).toBe(true);
    expect(getPlanLimits("power", "past_due", future, now)).toBe(PLAN_LIMITS.power);
  });

  it("drops past-due users to free after the grace period expires", () => {
    const expired = "2026-03-20T12:00:00.000Z";
    const now = new Date("2026-04-03T12:00:00.000Z");

    expect(isGracePeriodActive("past_due", expired, now)).toBe(false);
    expect(normalizeTier("power", "past_due", expired, now)).toBe("free");
    expect(hasFeatureAccess("power", "past_due", "sportsHub", expired, now)).toBe(false);
    expect(getPlanLimits("power", "past_due", expired, now)).toBe(PLAN_LIMITS.free);
  });

  it("returns display names for the active tier", () => {
    expect(getTierDisplayName("power")).toBe("Power");
    expect(getTierDisplayName("premium")).toBe("Power");
    expect(getTierDisplayName(null)).toBe("Free");
  });
});
