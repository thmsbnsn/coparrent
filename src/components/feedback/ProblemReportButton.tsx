import type { ReactNode } from "react";
import { Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProblemReport } from "@/components/feedback/useProblemReport";
import { cn } from "@/lib/utils";

interface ProblemReportButtonProps {
  children?: ReactNode;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
}

export const ProblemReportButton = ({
  children,
  className,
  size = "default",
  variant = "outline",
}: ProblemReportButtonProps) => {
  const { openReportModal } = useProblemReport();

  return (
    <Button
      className={cn(className)}
      onClick={() => openReportModal("manual")}
      size={size}
      type="button"
      variant={variant}
    >
      <Bug className="mr-2 h-4 w-4" />
      {children ?? "Report a problem"}
    </Button>
  );
};
