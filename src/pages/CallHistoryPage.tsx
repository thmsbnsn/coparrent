import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { format } from "date-fns";
import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  Loader2,
  MessageSquare,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Video,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCallHistory, type CallHistoryRow } from "@/hooks/useCallHistory";
import { useCallSessions } from "@/hooks/useCallSessions";
import { useFamilyRole } from "@/hooks/useFamilyRole";
import type { CallStatus } from "@/lib/calls";
import { cn } from "@/lib/utils";

const CALL_STATUS_LABELS: Record<CallStatus, string> = {
  accepted: "Connected",
  cancelled: "Cancelled",
  declined: "Declined",
  ended: "Ended",
  failed: "Failed",
  missed: "Missed",
  ringing: "Ringing",
};

const getDisplayName = (name: string | null, fallback: string) => name?.trim() || fallback;

const formatCallTimestamp = (timestamp: string | null) => {
  if (!timestamp) {
    return "Not recorded";
  }

  return format(new Date(timestamp), "MMM d, yyyy h:mm a");
};

const formatCallSummaryTimestamp = (timestamp: string) =>
  format(new Date(timestamp), "MMM d, h:mm a");

const formatCallSource = (source: string | null) => {
  if (!source) {
    return "Not recorded";
  }

  return source
    .split("_")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};

const resolveCallDetails = (call: CallHistoryRow, profileId: string | null) => {
  const outgoing = call.initiator_profile_id === profileId;
  const incoming = call.callee_profile_id === profileId;

  if (!outgoing && !incoming) {
    return null;
  }

  const otherProfileId = outgoing ? call.callee_profile_id : call.initiator_profile_id;
  const otherName = outgoing
    ? getDisplayName(call.callee_display_name, "Family member")
    : getDisplayName(call.initiator_display_name, "Family member");

  return {
    direction: outgoing ? "Outgoing" : "Incoming",
    otherName,
    otherProfileId,
  };
};

const CallHistoryPage = () => {
  const { activeFamilyId, profileId } = useFamilyRole();
  const { calls, loading, refresh, scopeError } = useCallHistory();
  const { activeSession, createCall, incomingSession, sessions } = useCallSessions(null);
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null);
  const [pendingCallId, setPendingCallId] = useState<string | null>(null);

  const outgoingSession = useMemo(() => {
    if (!profileId) {
      return null;
    }

    return (
      sessions.find(
        (session) =>
          session.status === "ringing" &&
          session.initiator_profile_id === profileId,
      ) ?? null
    );
  }, [profileId, sessions]);

  const callBackDisabled = Boolean(activeSession || incomingSession || outgoingSession || pendingCallId);

  const handleCallBack = useCallback(
    async (call: CallHistoryRow) => {
      const details = resolveCallDetails(call, profileId);

      if (!activeFamilyId || !profileId || !details?.otherProfileId) {
        toast.error("Active family, current profile, and call recipient are required before returning a call.");
        return;
      }

      setPendingCallId(call.id);
      try {
        await createCall({
          callType: call.call_type,
          calleeProfileId: details.otherProfileId,
          source: "dashboard",
        });
        await refresh();
      } finally {
        setPendingCallId(null);
      }
    },
    [activeFamilyId, createCall, profileId, refresh],
  );

  return (
    <DashboardLayout
      mobileHeader={{
        leading: (
          <Button
            asChild
            aria-label="Back to dashboard"
            size="icon"
            variant="ghost"
            className="h-10 w-10 rounded-full border border-border/70 bg-background/88"
          >
            <Link to="/dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
        ),
        title: "Call History",
        trailing: (
          <Button
            asChild
            aria-label="Open messages"
            size="icon"
            className="h-10 w-10 rounded-full bg-emerald-500 text-white shadow-[0_16px_30px_-24px_rgba(16,185,129,0.8)] hover:bg-emerald-400"
          >
            <Link to="/dashboard/messages">
              <MessageSquare className="h-5 w-5" />
            </Link>
          </Button>
        ),
        hideDefaultTrailing: true,
      }}
    >
      <div className="page-shell-app page-stack">
        <section className="surface-primary hidden items-start justify-between gap-4 p-5 md:flex">
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
              Call History
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              See recent family calls, scan the essentials quickly, and expand any row for the full record.
            </p>
          </div>

          <Button className="rounded-2xl" asChild>
            <Link to="/dashboard/messages">
              <MessageSquare className="h-4 w-4" />
              Open Messages
            </Link>
          </Button>
        </section>

        <section className="surface-primary p-4 sm:p-6">
          {loading ? (
            <div className="space-y-3" aria-label="Loading call history">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="animate-pulse rounded-[1.75rem] border border-border/70 bg-background/70 p-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 shrink-0 rounded-2xl bg-muted" />
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="h-5 w-32 rounded-full bg-muted" />
                      <div className="h-4 w-24 rounded-full bg-muted/80" />
                      <div className="flex gap-2">
                        <div className="h-7 w-20 rounded-full bg-muted/80" />
                        <div className="h-7 w-16 rounded-full bg-muted/80" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : scopeError ? (
            <div className="rounded-[1.75rem] border border-destructive/25 bg-destructive/10 p-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                <div>
                  <h2 className="font-display text-lg font-semibold text-foreground">
                    Call history is unavailable
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{scopeError}</p>
                </div>
              </div>
            </div>
          ) : calls.length === 0 ? (
            <div className="rounded-[1.75rem] border border-dashed border-border/70 bg-muted/25 p-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border/70 bg-background/80 text-muted-foreground">
                <Phone className="h-6 w-6" />
              </div>
              <h2 className="mt-5 font-display text-xl font-semibold text-foreground">
                No calls yet
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                Start a conversation to see your call history here.
              </p>
              <Button className="mt-5 rounded-2xl" asChild>
                <Link to="/dashboard/messages">Open Messages</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {calls.map((call) => {
                const details = resolveCallDetails(call, profileId);
                const pending = pendingCallId === call.id;
                const disabled = callBackDisabled || !details?.otherProfileId;
                const directionIcon = details?.direction === "Incoming" ? (
                  <PhoneIncoming className="mr-1.5 h-3.5 w-3.5" />
                ) : (
                  <PhoneOutgoing className="mr-1.5 h-3.5 w-3.5" />
                );
                const isExpanded = expandedCallId === call.id;

                return (
                  <article
                    key={call.id}
                    className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-background/70 p-4 shadow-[0_20px_36px_-34px_rgba(8,21,47,0.55)]"
                  >
                    <div className="flex items-start gap-4">
                      <Button
                        type="button"
                        className="h-12 w-12 shrink-0 rounded-2xl px-0"
                        disabled={disabled}
                        aria-label={details ? `Call ${details.otherName} back` : "Call back unavailable"}
                        onClick={() => {
                          void handleCallBack(call);
                        }}
                      >
                        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
                        <span className="sr-only">Call back</span>
                      </Button>

                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          className="w-full rounded-[1.35rem] text-left outline-none transition-colors hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-primary/40"
                          onClick={() => {
                            setExpandedCallId((current) => (current === call.id ? null : call.id));
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-3">
                                <p className="truncate font-display text-lg font-semibold text-foreground">
                                  {details?.otherName ?? "Call participant could not be resolved"}
                                </p>
                                <ChevronDown
                                  className={cn(
                                    "mt-0.5 h-5 w-5 shrink-0 text-muted-foreground transition-transform",
                                    isExpanded && "rotate-180",
                                  )}
                                />
                              </div>

                              <p className="mt-1 text-sm text-muted-foreground">
                                {formatCallSummaryTimestamp(call.created_at)}
                              </p>

                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                {details ? (
                                  <Badge variant="outline" className="rounded-full border-border/70">
                                    {directionIcon}
                                    {details.direction}
                                  </Badge>
                                ) : null}
                                <Badge variant="outline" className="rounded-full border-border/70">
                                  {call.call_type === "video" ? (
                                    <Video className="mr-1.5 h-3.5 w-3.5" />
                                  ) : (
                                    <Phone className="mr-1.5 h-3.5 w-3.5" />
                                  )}
                                  {call.call_type === "video" ? "Video" : "Audio"}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </button>

                        <AnimatePresence initial={false}>
                          {isExpanded ? (
                            <motion.div
                              key="call-details"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.22, ease: "easeOut" }}
                              className="overflow-hidden"
                            >
                              <div className="mt-3 rounded-[1.5rem] border border-border/60 bg-muted/35 p-4">
                                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                                  <div>
                                    <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                      Direction
                                    </dt>
                                    <dd className="mt-1 font-medium text-foreground">
                                      {details?.direction ?? "Unavailable"}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                      Status
                                    </dt>
                                    <dd className="mt-1 font-medium text-foreground">
                                      {CALL_STATUS_LABELS[call.status]}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                      Started
                                    </dt>
                                    <dd className="mt-1 text-foreground">
                                      {formatCallTimestamp(call.created_at)}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                      Answered
                                    </dt>
                                    <dd className="mt-1 text-foreground">
                                      {formatCallTimestamp(call.answered_at)}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                      Ended
                                    </dt>
                                    <dd className="mt-1 text-foreground">
                                      {formatCallTimestamp(call.ended_at)}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                      Source
                                    </dt>
                                    <dd className="mt-1 text-foreground">
                                      {formatCallSource(call.source)}
                                    </dd>
                                  </div>
                                </dl>
                              </div>
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
};

export default CallHistoryPage;
