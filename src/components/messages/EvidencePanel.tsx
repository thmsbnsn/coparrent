import { FileText, Eye, EyeOff } from "lucide-react";
import { format } from "date-fns";
import { ThreadMessage } from "@/hooks/useMessagingHub";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { resolveSenderName } from "@/lib/displayResolver";

interface EvidencePanelProps {
  messages: ThreadMessage[];
  courtView: boolean;
  className?: string;
}

const formatReadSummary = (message: ThreadMessage) => {
  if (!message.read_by || message.read_by.length === 0) {
    return "Unread";
  }

  if (message.read_by.length === 1) {
    return `Read by ${message.read_by[0].reader_name}`;
  }

  return `Read by ${message.read_by.length} people`;
};

export const EvidencePanel = ({
  messages,
  courtView,
  className,
}: EvidencePanelProps) => {
  return (
    <ScrollArea className={cn("min-h-0", className)}>
      <div className="space-y-3 p-4">
        {messages.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 text-center">
            <FileText className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No messages in this thread yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              The first message will appear here as part of the permanent family communication record.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <article
              key={message.id}
              className={cn(
                "rounded-xl border border-border bg-background px-4 py-3",
                message.is_from_me && !courtView && "border-primary/20 bg-primary/5"
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
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
                  <p className="mt-1 text-xs text-muted-foreground">
                    {format(new Date(message.created_at), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
                <div className="text-right">
                  <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                    {message.read_by && message.read_by.length > 0 ? (
                      <Eye className="h-3.5 w-3.5" />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5" />
                    )}
                    <span>{formatReadSummary(message)}</span>
                  </div>
                  {message.read_by && message.read_by.length > 0 && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Last read {format(new Date(message.read_by[message.read_by.length - 1].read_at), "MMM d, h:mm a")}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">
                {message.content}
              </div>
            </article>
          ))
        )}
      </div>
    </ScrollArea>
  );
};
