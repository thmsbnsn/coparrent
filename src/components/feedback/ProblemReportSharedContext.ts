import { createContext } from "react";
import type { MotionSupportSnapshot } from "@/lib/problem-report/deviceMotion";
import type { ProblemReportSource } from "@/lib/problem-report/payload";
import type { ProblemReportPreferences } from "@/lib/problem-report/preferences";

export interface ProblemReportContextValue {
  disableShakeReporting: () => void;
  enableShakeReporting: () => Promise<boolean>;
  motionSupport: MotionSupportSnapshot;
  openReportModal: (source?: ProblemReportSource) => void;
  preferences: ProblemReportPreferences;
}

export const ProblemReportContext = createContext<ProblemReportContextValue | undefined>(undefined);
