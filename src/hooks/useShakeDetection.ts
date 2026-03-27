import { useEffect, useRef } from "react";
import {
  DEFAULT_SHAKE_CONFIG,
  evaluateShakeSample,
  getMotionMagnitude,
  INITIAL_SHAKE_STATE,
  type ShakeDetectionConfig,
  type ShakeDetectionState,
} from "@/lib/problem-report/deviceMotion";

interface UseShakeDetectionOptions {
  active: boolean;
  config?: Partial<ShakeDetectionConfig>;
  initialLastTriggerAt?: number | null;
  onShake: () => void;
}

export const useShakeDetection = ({
  active,
  config,
  initialLastTriggerAt,
  onShake,
}: UseShakeDetectionOptions) => {
  const stateRef = useRef<ShakeDetectionState>({
    ...INITIAL_SHAKE_STATE,
    lastTriggerAt: initialLastTriggerAt ?? null,
  });
  const onShakeRef = useRef(onShake);

  useEffect(() => {
    onShakeRef.current = onShake;
  }, [onShake]);

  useEffect(() => {
    stateRef.current = {
      ...stateRef.current,
      lastTriggerAt: initialLastTriggerAt ?? null,
    };
  }, [initialLastTriggerAt]);

  useEffect(() => {
    if (!active || typeof window === "undefined") {
      return;
    }

    const resolvedConfig: ShakeDetectionConfig = {
      ...DEFAULT_SHAKE_CONFIG,
      ...config,
    };

    const handleMotion = (event: DeviceMotionEvent) => {
      const magnitude =
        getMotionMagnitude(event.accelerationIncludingGravity) ??
        getMotionMagnitude(event.acceleration);

      const result = evaluateShakeSample({
        config: resolvedConfig,
        magnitude,
        now: Date.now(),
        state: stateRef.current,
      });

      stateRef.current = result.nextState;

      if (result.triggered) {
        onShakeRef.current();
      }
    };

    window.addEventListener("devicemotion", handleMotion, { passive: true });

    return () => {
      window.removeEventListener("devicemotion", handleMotion);
    };
  }, [active, config]);
};
