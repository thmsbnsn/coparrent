import { describe, expect, it } from "vitest";
import {
  getPlanLimits,
  getTierDisplayName,
  hasFeatureAccess,
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
    expect(hasFeatureAccess("power", "sportsHub")).toBe(true);
    expect(hasFeatureAccess("premium", "courtExports")).toBe(true);
    expect(hasFeatureAccess("free", "expenses")).toBe(false);
  });

  it("returns display names for the active tier", () => {
    expect(getTierDisplayName("power")).toBe("Power");
    expect(getTierDisplayName("premium")).toBe("Power");
    expect(getTierDisplayName(null)).toBe("Free");
  });
});
