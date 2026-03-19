import { describe, expect, it } from "vitest";
import {
  calculateLeaveByTime,
  estimateDistance,
  getParentResponsibility,
  getRequiredEquipment,
} from "./reminderHelpers";

describe("reminderHelpers", () => {
  it("uses the fallback distance estimate when no address exists", () => {
    expect(estimateDistance(null)).toBe(10);
    expect(estimateDistance("123 Main St")).toBe(15);
  });

  it("calculates leave-by times with prep and travel buffers", () => {
    expect(calculateLeaveByTime("18:00", 15)).toBe("5:15 PM");
  });

  it("wraps leave-by time across midnight instead of returning invalid hours", () => {
    expect(calculateLeaveByTime("00:10", 20)).toBe("11:15 PM");
  });

  it("assigns pickup and drop-off responsibilities correctly", () => {
    expect(getParentResponsibility("parent-1", "parent-1", "parent-1")).toBe("Drop-off & Pick-up");
    expect(getParentResponsibility("parent-1", "parent-1", "parent-2")).toBe("Drop-off");
    expect(getParentResponsibility("parent-1", "parent-2", "parent-1")).toBe("Pick-up");
    expect(getParentResponsibility("parent-1", "parent-2", "parent-3")).toBeNull();
  });

  it("keeps only required equipment with usable names", () => {
    expect(
      getRequiredEquipment([
        { name: "Shin guards", required: true },
        { name: "  Water bottle  ", required: true },
        { name: "", required: true },
        { name: "Optional snack", required: false },
      ]),
    ).toEqual(["Shin guards", "Water bottle"]);
  });
});
