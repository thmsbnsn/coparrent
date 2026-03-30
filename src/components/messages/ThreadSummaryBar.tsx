import { AlertTriangle, FileText, Hash, MessageSquare, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ThreadSummaryBarProps {
  unreadCount: number;
  totalMessages: number;
  threadType: "family_channel" | "group_chat" | "direct_message";
  courtView: boolean;
  recordState?:
    | "ready"
    | "empty"
    | "loading_existing"
    | "loading_empty"
    | "error"
    | "history_unavailable";
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
  recordState = totalMessages === 0 ? "empty" : "ready",
  className,
}: ThreadSummaryBarProps) => {
  const thread = THREAD_LABELS[threadType];
  const Icon = thread.icon;
  const emptyThread = recordState === "empty";
  const loadingRecord =
    recordState === "loading_existing" || recordState === "loading_empty";
  const blockedRecord =
    recordState === "error" || recordState === "history_unavailable";
  const statusBadge =
    recordState === "loading_existing"
      ? "Loading recorded history"
      : recordState === "loading_empty"
        ? "Checking thread status"
        : recordState === "history_unavailable"
          ? "History unavailable"
          : recordState === "error"
            ? "Load blocked"
            : emptyThread
              ? "No messages yet"
              : `${totalMessages} message${totalMessages === 1 ? "" : "s"}`;
  const statusNote =
    recordState === "loading_existing"
      ? "This thread already has recorded activity. Loading the full history now."
      : recordState === "loading_empty"
        ? "Confirming the current state of this record before drafting."
        : recordState === "history_unavailable"
          ? "This thread has recorded activity metadata, but the message history did not hydrate in this view. Refresh before replying."
          : recordState === "error"
            ? "The selected record could not be loaded right now. Refresh before replying."
            : emptyThread
              ? `${thread.note}. The record is open and ready for the first message.`
              : `${thread.note}. Messages are permanent and exportable for review.`;

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
        {loadingRecord ? (
          <Badge variant="secondary">{statusBadge}</Badge>
        ) : blockedRecord ? (
          <Badge variant="destructive">{statusBadge}</Badge>
        ) : (
          <>
            {unreadCount > 0 && (
              <Badge variant="destructive">{unreadCount} unread</Badge>
            )}
            <Badge variant="secondary">{statusBadge}</Badge>
          </>
        )}
        <Badge variant={courtView ? "default" : "outline"} className="gap-1.5">
          <FileText className="h-3.5 w-3.5" />
          {courtView ? "Court view active" : "Chat view active"}
        </Badge>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {statusNote}
        {recordState === "ready" && unreadCount > 0 && " Review unread items before replying."}
      </p>
      {recordState === "ready" && unreadCount > 5 && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-warning">
          <AlertTriangle className="h-3.5 w-3.5" />
          This thread has accumulated unread activity.
        </div>
      )}
    </div>
  );
};
