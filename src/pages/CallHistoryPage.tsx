import { useCallback, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  AlertCircle,
  ArrowLeft,
  History,
  Loader2,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  RefreshCw,
  Video,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
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
    madeBy: outgoing ? "You made this call" : `${otherName} made this call`,
    otherName,
    otherProfileId,
    summary: outgoing ? `You called ${otherName}` : `${otherName} called you`,
  };
};

const CallHistoryPage = () => {
  const { activeFamilyId, profileId } = useFamilyRole();
  const { calls, loading, refresh, scopeError } = useCallHistory();
  const { activeSession, createCall, incomingSession, sessions } = useCallSessions(null);
  const [pendingCallId, setPendingCallId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

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
    <DashboardLayout>
      <div className="page-shell-app page-stack">
        <div className="surface-hero overflow-hidden p-5 sm:p-6">
          <div className="absolute left-8 top-4 h-28 w-28 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-36 w-36 rounded-full bg-accent/15 blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-4">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full border-white/10 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white"
                asChild
              >
                <Link to="/dashboard">
                  <ArrowLeft className="h-4 w-4" />
                  Dashboard
                </Link>
              </Button>

              <div className="space-y-3">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-100/85">
                  <History className="h-3.5 w-3.5" />
                  Family call log
                </div>
                <div>
                  <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
                    Calls
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200/78 sm:text-base">
                    Recent calls for the active family. Each row shows who placed the call, when it happened, and a direct callback action.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                variant="outline"
                className="rounded-2xl border-white/10 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white"
                onClick={() => void handleRefresh()}
                disabled={refreshing}
              >
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Refresh
              </Button>
              <Button className="rounded-2xl" asChild>
                <Link to="/dashboard/messages">
                  <Phone className="h-4 w-4" />
                  Start from Messages
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <section className="surface-primary p-4 sm:p-6">
          {loading ? (
            <div className="flex min-h-64 items-center justify-center">
              <LoadingSpinner size="lg" />
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
                No calls recorded yet
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                Start a direct call from Messages. Once calls are placed or received in the active family, they will appear here by timestamp.
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
                const DirectionIcon = details?.direction === "Incoming" ? PhoneIncoming : PhoneOutgoing;

                return (
                  <article
                    key={call.id}
                    className="rounded-[1.75rem] border border-border/70 bg-background/70 p-4 shadow-[0_20px_36px_-34px_rgba(8,21,47,0.55)]"
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
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div className="min-w-0">
                            <p className="truncate font-display text-lg font-semibold text-foreground">
                              {details?.summary ?? "Call participant could not be resolved"}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {details?.madeBy ?? "This call is not tied to the current profile."}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {details ? (
                              <Badge variant="outline" className="rounded-full border-border/70">
                                <DirectionIcon className="mr-1.5 h-3.5 w-3.5" />
                                {details.direction}
                              </Badge>
                            ) : null}
                            <Badge
                              variant="secondary"
                              className={cn(
                                "rounded-full",
                                call.status === "missed" && "bg-destructive/10 text-destructive",
                                call.status === "failed" && "bg-destructive/10 text-destructive",
                              )}
                            >
                              {CALL_STATUS_LABELS[call.status]}
                            </Badge>
                            <Badge variant="outline" className="rounded-full border-border/70 capitalize">
                              {call.call_type === "video" ? <Video className="mr-1.5 h-3.5 w-3.5" /> : <Phone className="mr-1.5 h-3.5 w-3.5" />}
                              {call.call_type}
                            </Badge>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
                          <p>
                            <span className="font-medium text-foreground">Started:</span>{" "}
                            {formatCallTimestamp(call.created_at)}
                          </p>
                          <p>
                            <span className="font-medium text-foreground">Answered:</span>{" "}
                            {formatCallTimestamp(call.answered_at)}
                          </p>
                          <p>
                            <span className="font-medium text-foreground">Ended:</span>{" "}
                            {formatCallTimestamp(call.ended_at)}
                          </p>
                        </div>
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
