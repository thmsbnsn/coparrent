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
  const readyRecord = recordState === "ready";
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
              ? "No messages on record"
              : "Existing record";
  const countBadge =
    readyRecord
      ? `${totalMessages} message${totalMessages === 1 ? "" : "s"} on record`
      : emptyThread
        ? "First message pending"
        : null;
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
              ? `${thread.note}. No messages are on record yet, so the first message will open the conversation history.`
              : `${thread.note}. ${totalMessages} recorded message${totalMessages === 1 ? "" : "s"} are visible in order for review.`;
  const statusToneClass = loadingRecord
    ? "border-primary/20 bg-primary/10 text-primary"
    : blockedRecord
      ? "border-warning/35 bg-warning/10 text-warning"
      : readyRecord
        ? "border-accent/25 bg-accent/10 text-accent"
        : "border-border/70 bg-background/65 text-muted-foreground";
  const viewBadgeClass = courtView
    ? "border-slate-300/40 bg-slate-900 text-white"
    : "border-border/70 bg-background/75 text-foreground/85";

  return (
    <div
      className={cn(
        "border-b border-border/80 px-4 py-3",
        courtView
          ? "bg-[linear-gradient(180deg,rgba(250,250,249,0.98),rgba(244,244,245,0.92))]"
          : "bg-[linear-gradient(180deg,hsl(var(--background)/0.86),hsl(var(--muted)/0.28))]",
        className
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="outline" className="gap-1.5 rounded-full bg-background/70">
            <Icon className="h-3.5 w-3.5" />
            {thread.label}
          </Badge>
          <Badge variant="outline" className={cn("rounded-full", statusToneClass)}>
            {statusBadge}
          </Badge>
          {countBadge ? (
            <Badge variant="outline" className="rounded-full border-border/70 bg-background/70 text-muted-foreground">
              {countBadge}
            </Badge>
          ) : null}
          {unreadCount > 0 && (
            <Badge variant="destructive" className="rounded-full">
              {unreadCount} unread
            </Badge>
          )}
        </div>
        <Badge
          variant="outline"
          className={cn("w-fit gap-1.5 rounded-full", viewBadgeClass)}
        >
          <FileText className="h-3.5 w-3.5" />
          {courtView ? "Legal view" : "Chat view"}
        </Badge>
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
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
