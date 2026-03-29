import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatThread } from "@/components/messages/ChatThread";
import { CourtThread } from "@/components/messages/CourtThread";
import type { MessageTimelineItem } from "@/components/messages/threadTimeline";
import { cn } from "@/lib/utils";

interface EvidencePanelProps {
  timelineItems: MessageTimelineItem[];
  viewMode: "chat" | "court";
  className?: string;
}

export const EvidencePanel = ({
  timelineItems,
  viewMode,
  className,
}: EvidencePanelProps) => {
  const hasUserMessages = timelineItems.some((item) => item.kind === "message");

  return (
    <ScrollArea className={cn("min-h-0", className)} data-scroll-area>
      {viewMode === "court" ? (
        <CourtThread hasUserMessages={hasUserMessages} timelineItems={timelineItems} />
      ) : (
        <ChatThread hasUserMessages={hasUserMessages} timelineItems={timelineItems} />
      )}
    </ScrollArea>
  );
};
