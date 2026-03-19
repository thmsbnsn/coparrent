import { AlertTriangle, FileText, Hash, MessageSquare, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ThreadSummaryBarProps {
  unreadCount: number;
  totalMessages: number;
  threadType: "family_channel" | "group_chat" | "direct_message";
  courtView: boolean;
  className?: string;
}

const THREAD_LABELS = {
  family_channel: {
    label: "Family channel",
    icon: Hash,
    note: "Shared family record",
  },
  group_chat: {
    label: "Group chat",
    icon: UsersRound,
    note: "Multi-party conversation",
  },
  direct_message: {
    label: "Direct message",
    icon: MessageSquare,
    note: "One-to-one communication",
  },
} as const;

export const ThreadSummaryBar = ({
  unreadCount,
  totalMessages,
  threadType,
  courtView,
  className,
}: ThreadSummaryBarProps) => {
  const thread = THREAD_LABELS[threadType];
  const Icon = thread.icon;

  return (
    <div
      className={cn(
        "border-b border-border bg-muted/30 px-4 py-2.5",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="outline" className="gap-1.5">
          <Icon className="h-3.5 w-3.5" />
          {thread.label}
        </Badge>
        <Badge variant={unreadCount > 0 ? "destructive" : "secondary"}>
          {unreadCount > 0 ? `${unreadCount} unread` : "No unread"}
        </Badge>
        <Badge variant="secondary">{totalMessages} messages</Badge>
        <Badge variant={courtView ? "default" : "outline"} className="gap-1.5">
          <FileText className="h-3.5 w-3.5" />
          {courtView ? "Court view active" : "Standard view"}
        </Badge>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {thread.note}. Messages are permanent and exportable for review.
        {unreadCount > 0 && " Review unread items before replying."}
      </p>
      {unreadCount > 5 && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-warning">
          <AlertTriangle className="h-3.5 w-3.5" />
          This thread has accumulated unread activity.
        </div>
      )}
    </div>
  );
};
