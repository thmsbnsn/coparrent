import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHAKE_CONFIG,
  evaluateShakeSample,
  getMotionMagnitude,
  getMotionPermissionStateFromSupport,
  getMotionSupportSnapshot,
  requiresExplicitMotionPermission,
} from "@/lib/problem-report/deviceMotion";

describe("problem report device motion helpers", () => {
  it("detects when explicit motion permission is required", () => {
    const withPermission = {
      DeviceMotionEvent: {
        requestPermission: async () => "granted" as const,
      },
    } as unknown as Window;

    const withoutPermission = {
      DeviceMotionEvent: class DeviceMotionEventStub {},
    } as unknown as Window;

    expect(requiresExplicitMotionPermission(withPermission)).toBe(true);
    expect(requiresExplicitMotionPermission(withoutPermission)).toBe(false);
  });

  it("derives unsupported state when the environment is not viable", () => {
    const snapshot = getMotionSupportSnapshot(
      {
        DeviceMotionEvent: undefined,
        innerHeight: 800,
        innerWidth: 390,
        isSecureContext: true,
        matchMedia: () => ({ matches: true }) as MediaQueryList,
      } as unknown as Window,
      { maxTouchPoints: 5 } as Navigator,
    );

    expect(getMotionPermissionStateFromSupport(snapshot, "unknown")).toBe("unsupported");
  });

  it("triggers only after multiple impulses and respects cooldown", () => {
    const first = evaluateShakeSample({
      magnitude: 32,
      now: 1_000,
      state: {
        firstImpulseAt: null,
        impulseCount: 0,
        lastMagnitude: 8,
        lastTriggerAt: null,
      },
    });

    expect(first.triggered).toBe(false);

    const second = evaluateShakeSample({
      magnitude: 48,
      now: 1_300,
      state: first.nextState,
    });

    expect(second.triggered).toBe(true);

    const third = evaluateShakeSample({
      magnitude: 36,
      now: 2_000,
      state: second.nextState,
    });

    const fourth = evaluateShakeSample({
      magnitude: 38,
      now: 2_200,
      state: third.nextState,
    });

    expect(fourth.triggered).toBe(false);

    const fifth = evaluateShakeSample({
      config: { ...DEFAULT_SHAKE_CONFIG, cooldownMs: 500 },
      magnitude: 35,
      now: 3_000,
      state: {
        ...fourth.nextState,
        lastMagnitude: 10,
      },
    });

    const sixth = evaluateShakeSample({
      config: { ...DEFAULT_SHAKE_CONFIG, cooldownMs: 500 },
      magnitude: 50,
      now: 3_200,
      state: fifth.nextState,
    });

    expect(sixth.triggered).toBe(true);
  });

  it("safely calculates motion magnitude from partial acceleration values", () => {
    expect(getMotionMagnitude({ x: 4, y: null, z: -8 })).toBe(12);
    expect(getMotionMagnitude({ x: null, y: null, z: null })).toBeNull();
  });
});
