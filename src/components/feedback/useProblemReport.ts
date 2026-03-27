import { useContext } from "react";
import { ProblemReportContext } from "@/components/feedback/ProblemReportSharedContext";

export const useProblemReport = () => {
  const context = useContext(ProblemReportContext);

  if (!context) {
    throw new Error("useProblemReport must be used within ProblemReportProvider");
  }

  return context;
};
