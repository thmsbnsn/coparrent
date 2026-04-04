import { FileText, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface CourtViewToggleProps {
  enabled: boolean;
  onToggle: () => void;
  compact?: boolean;
}

export const CourtViewToggle = ({
  enabled,
  onToggle,
  compact = false,
}: CourtViewToggleProps) => {
  const label = enabled ? "Exit legal view" : "Enter legal view";

  const button = (
    <Button
      type="button"
      variant="outline"
      size={compact ? "icon" : "sm"}
      onClick={onToggle}
      aria-pressed={enabled}
      aria-label={label}
      className={cn(
        "rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10",
        enabled && "border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,245,249,0.94))] text-slate-900 hover:bg-white",
      )}
    >
      {enabled ? <MessageSquare className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
      {!compact && <span className="ml-2">{enabled ? "Chat View" : "Legal View"}</span>}
    </Button>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
};
