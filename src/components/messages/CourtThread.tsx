import { Eye, EyeOff } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { MessageAttachments } from "@/components/messages/MessageAttachments";
import { ThreadSystemEventCard } from "@/components/messages/ThreadSystemEventCard";
import type { MessageTimelineItem } from "@/components/messages/threadTimeline";
import { resolveSenderName } from "@/lib/displayResolver";
import type { MessageAttachment } from "@/hooks/useMessagingHub";

interface CourtThreadProps {
  hasUserMessages: boolean;
  onOpenAttachment: (attachment: MessageAttachment) => void;
  timelineItems: MessageTimelineItem[];
}

const formatReadSummary = (message: MessageTimelineItem & { kind: "message" }) => {
  if (!message.message.read_by || message.message.read_by.length === 0) {
    return "Unread";
  }

  if (message.message.read_by.length === 1) {
    return `Read by ${message.message.read_by[0].reader_name}`;
  }

  return `Read by ${message.message.read_by.length} people`;
};

export const CourtThread = ({
  hasUserMessages,
  onOpenAttachment,
  timelineItems,
}: CourtThreadProps) => {
  return (
    <div className="space-y-3 p-4">
      {timelineItems.map((item) => {
        if (item.kind === "system") {
          return <ThreadSystemEventCard key={item.id} event={item.event} />;
        }

        const message = item.message;

        return (
          <article
            key={message.id}
            className="rounded-xl border border-border bg-background px-4 py-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">
                    {resolveSenderName(message.sender_name)}
                  </p>
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                    {message.sender_role.replace(/_/g, " ")}
                  </Badge>
                  {message.is_from_me && (
                    <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                      You
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs font-medium text-foreground">
                  {format(new Date(message.created_at), "MMM d, yyyy 'at' h:mm a")}
                </p>
              </div>

              <div className="text-right text-xs text-muted-foreground">
                <div className="flex items-center justify-end gap-1">
                  {message.read_by && message.read_by.length > 0 ? (
                    <Eye className="h-3.5 w-3.5" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5" />
                  )}
                  <span>{formatReadSummary(item)}</span>
                </div>
                {message.read_by && message.read_by.length > 0 && (
                  <p className="mt-1">
                    Last read{" "}
                    {format(
                      new Date(message.read_by[message.read_by.length - 1].read_at),
                      "MMM d, h:mm a",
                    )}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">
              {message.content}
            </div>

            <div className="mt-3">
              <MessageAttachments
                attachments={message.attachments ?? []}
                onOpenAttachment={onOpenAttachment}
              />
            </div>
          </article>
        );
      })}

      {!hasUserMessages && (
        <div className="rounded-xl border border-dashed border-border bg-[linear-gradient(180deg,hsl(var(--background)/0.9),hsl(var(--muted)/0.2))] p-5 text-center">
          <p className="text-sm font-medium">No messages on record yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            This record is open but still empty. Send the first message when you are ready.
          </p>
        </div>
      )}
    </div>
  );
};
