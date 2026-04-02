import { format } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ThreadSystemEventCard } from "@/components/messages/ThreadSystemEventCard";
import type { MessageTimelineItem } from "@/components/messages/threadTimeline";
import { cn } from "@/lib/utils";
import { resolveSenderName } from "@/lib/displayResolver";

interface ChatThreadProps {
  hasUserMessages: boolean;
  timelineItems: MessageTimelineItem[];
}

const getInitials = (name?: string | null) => {
  const resolved = name?.trim();
  if (!resolved) {
    return "?";
  }

  const parts = resolved.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export const ChatThread = ({ hasUserMessages, timelineItems }: ChatThreadProps) => {
  return (
    <div className="space-y-4 p-4">
      {timelineItems.map((item) => {
        if (item.kind === "system") {
          return <ThreadSystemEventCard key={item.id} event={item.event} />;
        }

        const message = item.message;
        const senderName = resolveSenderName(message.sender_name);

        return (
          <article
            key={message.id}
            className={cn(
              "flex gap-3",
              message.is_from_me ? "justify-end" : "justify-start",
            )}
          >
            {!message.is_from_me && (
              <Avatar className="mt-1 h-9 w-9 flex-shrink-0">
                <AvatarFallback className="text-xs">
                  {getInitials(senderName)}
                </AvatarFallback>
              </Avatar>
            )}

            <div
              className={cn(
                "max-w-[85%] space-y-2 rounded-2xl border px-4 py-3 shadow-sm sm:max-w-[75%]",
                message.is_from_me
                  ? "border-primary/20 bg-primary/10"
                  : "border-border bg-background",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">{senderName}</p>
                <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                  {message.sender_role.replace(/_/g, " ")}
                </Badge>
                {message.is_from_me && (
                  <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                    You
                  </Badge>
                )}
              </div>

              <div className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                {message.content}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{format(new Date(message.created_at), "MMM d, h:mm a")}</span>
                {message.read_by && message.read_by.length > 0 && (
                  <span>
                    Read by {message.read_by.length === 1 ? message.read_by[0].reader_name : `${message.read_by.length} people`}
                  </span>
                )}
              </div>
            </div>

            {message.is_from_me && (
              <Avatar className="mt-1 h-9 w-9 flex-shrink-0">
                <AvatarFallback className="text-xs">
                  {getInitials(senderName)}
                </AvatarFallback>
              </Avatar>
            )}
          </article>
        );
      })}

      {!hasUserMessages && (
        <div className="rounded-2xl border border-dashed border-border bg-[linear-gradient(180deg,hsl(var(--background)/0.88),hsl(var(--muted)/0.2))] p-5 text-center">
          <p className="text-sm font-medium">No messages on record yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            The first message you send here will begin the conversation record. Use the deliberate composer below when you are ready.
          </p>
        </div>
      )}
    </div>
  );
};
