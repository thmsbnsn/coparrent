import {
  AlertTriangle,
  MessageSquare,
  Phone,
  PhoneCall,
  PhoneOff,
} from "lucide-react";
import { format } from "date-fns";
import type { ThreadSystemEvent } from "@/hooks/useMessagingHub";
import { cn } from "@/lib/utils";

interface ThreadSystemEventCardProps {
  event: ThreadSystemEvent;
  className?: string;
}

const EVENT_META: Record<
  ThreadSystemEvent["eventType"],
  {
    Icon: typeof MessageSquare;
    label: string;
  }
> = {
  conversation_started: {
    Icon: MessageSquare,
    label: "Conversation started",
  },
  call_answered: {
    Icon: PhoneCall,
    label: "Call answered",
  },
  call_attempt: {
    Icon: Phone,
    label: "Call attempt",
  },
  call_declined: {
    Icon: PhoneOff,
    label: "Call declined",
  },
  call_missed: {
    Icon: AlertTriangle,
    label: "Call missed",
  },
};

const buildEventDetail = (event: ThreadSystemEvent) => {
  switch (event.eventType) {
    case "conversation_started":
      return event.note || "This conversation is now part of the recorded family communication history.";
    case "call_attempt":
      return event.note || "A call was started from this conversation.";
    case "call_answered":
      return event.note || "The call connected successfully.";
    case "call_declined":
      return event.note || "The call was declined.";
    case "call_missed":
      return event.note || "No answer.";
    default:
      return event.note || "";
  }
};

export const ThreadSystemEventCard = ({
  event,
  className,
}: ThreadSystemEventCardProps) => {
  const meta = EVENT_META[event.eventType];
  const detail = buildEventDetail(event);
  const actorName = event.actorName?.trim();

  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-border bg-muted/20 px-4 py-3 text-center",
        className,
      )}
    >
      <div className="flex items-center justify-center gap-2 text-sm font-semibold text-foreground">
        <meta.Icon className="h-4 w-4 text-muted-foreground" />
        <span>{meta.label}</span>
      </div>
      <p className="mt-1 text-xs font-medium text-muted-foreground">
        {format(new Date(event.timestamp), "MMM d, yyyy 'at' h:mm a")}
      </p>
      {actorName && (
        <p className="mt-2 text-sm text-foreground">
          {actorName}
        </p>
      )}
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
};
