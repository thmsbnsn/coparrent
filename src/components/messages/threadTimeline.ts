import type { ThreadMessage, ThreadSystemEvent } from "@/hooks/useMessagingHub";

export type MessageTimelineItem =
  | {
      id: string;
      kind: "message";
      timestamp: string;
      message: ThreadMessage;
    }
  | {
      id: string;
      kind: "system";
      timestamp: string;
      event: ThreadSystemEvent;
    };

export const buildMessageTimeline = (
  messages: ThreadMessage[],
  systemEvents: ThreadSystemEvent[],
): MessageTimelineItem[] => {
  const items: MessageTimelineItem[] = [
    ...systemEvents.map((event) => ({
      id: event.id,
      kind: "system" as const,
      timestamp: event.timestamp,
      event,
    })),
    ...messages.map((message) => ({
      id: message.id,
      kind: "message" as const,
      timestamp: message.created_at,
      message,
    })),
  ];

  return items.sort((left, right) => {
    const timeDifference =
      new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime();

    if (timeDifference !== 0) {
      return timeDifference;
    }

    if (left.kind === right.kind) {
      return left.id.localeCompare(right.id);
    }

    return left.kind === "system" ? -1 : 1;
  });
};
