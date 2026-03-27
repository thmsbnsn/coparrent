export type MotionPermissionState = "unknown" | "granted" | "denied" | "unsupported";

export interface ShakeDetectionConfig {
  threshold: number;
  deltaThreshold: number;
  minImpulseCount: number;
  sampleWindowMs: number;
  cooldownMs: number;
}

export interface ShakeDetectionState {
  firstImpulseAt: number | null;
  impulseCount: number;
  lastMagnitude: number | null;
  lastTriggerAt: number | null;
}

interface WindowLike {
  DeviceMotionEvent?: typeof DeviceMotionEvent & {
    requestPermission?: () => Promise<"granted" | "denied">;
  };
  innerWidth?: number;
  innerHeight?: number;
  isSecureContext?: boolean;
  matchMedia?: (query: string) => MediaQueryList | { matches: boolean };
  navigator?: NavigatorLike;
}

interface NavigatorLike {
  maxTouchPoints?: number;
  platform?: string;
  standalone?: boolean;
  userAgent?: string;
  userAgentData?: {
    mobile?: boolean;
    platform?: string;
  };
}

export const DEFAULT_SHAKE_CONFIG: ShakeDetectionConfig = {
  threshold: 28,
  deltaThreshold: 12,
  minImpulseCount: 2,
  sampleWindowMs: 900,
  cooldownMs: 25_000,
};

export const INITIAL_SHAKE_STATE: ShakeDetectionState = {
  firstImpulseAt: null,
  impulseCount: 0,
  lastMagnitude: null,
  lastTriggerAt: null,
};

export interface MotionSupportSnapshot {
  supported: boolean;
  likelyMobile: boolean;
  secure: boolean;
  permissionRequired: boolean;
}

export const isSecureMotionContext = (win: WindowLike | undefined = globalThis.window): boolean =>
  Boolean(win?.isSecureContext);

export const hasDeviceMotionSupport = (
  win: WindowLike | undefined = globalThis.window,
): boolean => Boolean(win?.DeviceMotionEvent);

export const requiresExplicitMotionPermission = (
  win: WindowLike | undefined = globalThis.window,
): boolean => typeof win?.DeviceMotionEvent?.requestPermission === "function";

export const isLikelyMobileTouchDevice = (
  win: WindowLike | undefined = globalThis.window,
  nav: NavigatorLike | undefined = globalThis.navigator,
): boolean => {
  const maxTouchPoints = nav?.maxTouchPoints ?? 0;
  const hasTouch = maxTouchPoints > 0;
  const coarsePointer = Boolean(win?.matchMedia?.("(pointer: coarse)").matches);
  const narrowViewport =
    typeof win?.innerWidth === "number" &&
    typeof win?.innerHeight === "number" &&
    Math.max(win.innerWidth, win.innerHeight) <= 1024;
  const uaMobile = Boolean(nav?.userAgentData?.mobile);

  return Boolean((hasTouch || coarsePointer || uaMobile) && (narrowViewport || coarsePointer || uaMobile));
};

export const getMotionSupportSnapshot = (
  win: WindowLike | undefined = globalThis.window,
  nav: NavigatorLike | undefined = globalThis.navigator,
): MotionSupportSnapshot => ({
  supported: hasDeviceMotionSupport(win),
  likelyMobile: isLikelyMobileTouchDevice(win, nav),
  permissionRequired: requiresExplicitMotionPermission(win),
  secure: isSecureMotionContext(win),
});

export const getStandaloneDisplayMode = (
  win: WindowLike | undefined = globalThis.window,
  nav: NavigatorLike | undefined = globalThis.navigator,
): boolean => {
  const mediaMatch = Boolean(win?.matchMedia?.("(display-mode: standalone)").matches);
  return mediaMatch || Boolean(nav?.standalone);
};

export const getMotionMagnitude = (
  acceleration: DeviceMotionEventAcceleration | null | undefined,
): number | null => {
  if (!acceleration) {
    return null;
  }

  const values = [acceleration.x, acceleration.y, acceleration.z].filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );

  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + Math.abs(value), 0);
};

export const getMotionPermissionStateFromSupport = (
  snapshot: MotionSupportSnapshot,
  storedState: MotionPermissionState,
): MotionPermissionState => {
  if (!snapshot.supported || !snapshot.likelyMobile || !snapshot.secure) {
    return "unsupported";
  }

  if (!snapshot.permissionRequired) {
    return "granted";
  }

  return storedState;
};

export const evaluateShakeSample = ({
  config = DEFAULT_SHAKE_CONFIG,
  magnitude,
  now,
  state,
}: {
  config?: ShakeDetectionConfig;
  magnitude: number | null;
  now: number;
  state: ShakeDetectionState;
}): {
  nextState: ShakeDetectionState;
  triggered: boolean;
} => {
  if (magnitude === null) {
    return { nextState: state, triggered: false };
  }

  let nextState: ShakeDetectionState = {
    ...state,
    lastMagnitude: magnitude,
  };

  if (
    nextState.firstImpulseAt !== null &&
    now - nextState.firstImpulseAt > config.sampleWindowMs
  ) {
    nextState = {
      ...nextState,
      firstImpulseAt: null,
      impulseCount: 0,
    };
  }

  const previousMagnitude = state.lastMagnitude ?? magnitude;
  const delta = Math.abs(magnitude - previousMagnitude);
  const isImpulse = magnitude >= config.threshold && delta >= config.deltaThreshold;

  if (isImpulse) {
    nextState = {
      ...nextState,
      firstImpulseAt: nextState.firstImpulseAt ?? now,
      impulseCount: nextState.impulseCount + 1,
    };
  }

  const withinWindow =
    nextState.firstImpulseAt !== null && now - nextState.firstImpulseAt <= config.sampleWindowMs;
  const cooldownSatisfied =
    nextState.lastTriggerAt === null || now - nextState.lastTriggerAt >= config.cooldownMs;

  if (withinWindow && nextState.impulseCount >= config.minImpulseCount && cooldownSatisfied) {
    return {
      nextState: {
        ...nextState,
        firstImpulseAt: null,
        impulseCount: 0,
        lastTriggerAt: now,
      },
      triggered: true,
    };
  }

  if (withinWindow && nextState.impulseCount >= config.minImpulseCount && !cooldownSatisfied) {
    return {
      nextState: {
        ...nextState,
        firstImpulseAt: null,
        impulseCount: 0,
      },
      triggered: false,
    };
  }

  return { nextState, triggered: false };
};
