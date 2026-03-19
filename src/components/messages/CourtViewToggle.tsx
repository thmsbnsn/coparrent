import { FileText, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  const label = enabled ? "Exit court view" : "Enter court view";

  const button = (
    <Button
      type="button"
      variant={enabled ? "default" : "outline"}
      size={compact ? "icon" : "sm"}
      onClick={onToggle}
      aria-pressed={enabled}
      aria-label={label}
    >
      {enabled ? <MessageSquare className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
      {!compact && <span className="ml-2">{enabled ? "Chat View" : "Court View"}</span>}
    </Button>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
};
