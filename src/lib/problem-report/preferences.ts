import type { MotionPermissionState } from "@/lib/problem-report/deviceMotion";

export interface ProblemReportPreferences {
  dismissedMotionNudge: boolean;
  lastTriggerAt: number | null;
  motionPermissionState: MotionPermissionState;
  shakeEnabled: boolean;
}

const STORAGE_KEY = "coparrent.problemReport.preferences";

export const DEFAULT_PROBLEM_REPORT_PREFERENCES: ProblemReportPreferences = {
  dismissedMotionNudge: false,
  lastTriggerAt: null,
  motionPermissionState: "unknown",
  shakeEnabled: false,
};

export const getProblemReportPreferences = (): ProblemReportPreferences => {
  if (typeof window === "undefined") {
    return DEFAULT_PROBLEM_REPORT_PREFERENCES;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return DEFAULT_PROBLEM_REPORT_PREFERENCES;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ProblemReportPreferences>;

    return {
      ...DEFAULT_PROBLEM_REPORT_PREFERENCES,
      ...parsed,
    };
  } catch {
    return DEFAULT_PROBLEM_REPORT_PREFERENCES;
  }
};

export const setProblemReportPreferences = (preferences: ProblemReportPreferences) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
};

export const updateProblemReportPreferences = (
  patch: Partial<ProblemReportPreferences>,
): ProblemReportPreferences => {
  const next = {
    ...getProblemReportPreferences(),
    ...patch,
  };

  setProblemReportPreferences(next);
  return next;
};
