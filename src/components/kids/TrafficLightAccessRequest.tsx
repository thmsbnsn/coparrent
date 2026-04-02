import { Loader2, TimerReset } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { KidPortalRequestState } from "@/lib/kidsPortal";

interface TrafficLightAccessRequestProps {
  loading?: boolean;
  onOpenDashboard?: () => void;
  onRequestAccess: () => Promise<void> | void;
  requestState: KidPortalRequestState;
}

const StatusCopy = ({ requestState }: { requestState: KidPortalRequestState }) => {
  switch (requestState.status) {
    case "pending":
      return (
        <>
          <h2 className="text-2xl font-display font-semibold text-amber-950">Waiting for a grown-up</h2>
          <p className="mt-2 text-sm text-amber-900/80">
            Your request was sent. A parent or guardian can say yes or no from their family screen.
          </p>
        </>
      );
    case "approved":
      return (
        <>
          <h2 className="text-2xl font-display font-semibold text-emerald-950">You can go in now</h2>
          <p className="mt-2 text-sm text-emerald-900/80">
            A parent approved this session. Tap the green button again to open your Kids Dashboard.
          </p>
        </>
      );
    case "declined":
      return (
        <>
          <h2 className="text-2xl font-display font-semibold text-rose-950">Not right now</h2>
          <p className="mt-2 text-sm text-rose-900/80">
            A parent said no this time. You can try again when a grown-up is ready.
          </p>
        </>
      );
    case "expired":
      return (
        <>
          <h2 className="text-2xl font-display font-semibold text-slate-950">Time to ask again</h2>
          <p className="mt-2 text-sm text-slate-700">
            The last okay time ended. Press the green button to ask for another turn.
          </p>
        </>
      );
    default:
      return (
        <>
          <h2 className="text-2xl font-display font-semibold text-slate-950">Press the green button</h2>
          <p className="mt-2 text-sm text-slate-700">
            A parent will get a fast approval request before the Kids Dashboard opens.
          </p>
        </>
      );
  }
};

export const TrafficLightAccessRequest = ({
  loading = false,
  onOpenDashboard,
  onRequestAccess,
  requestState,
}: TrafficLightAccessRequestProps) => {
  const isApproved = requestState.dashboard_unlocked;
  const isPending = requestState.status === "pending";

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/60 bg-white/90 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.18)] backdrop-blur">
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-amber-100 via-white to-emerald-100" />

      <div className="relative mx-auto max-w-3xl">
        <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-center">
          <div className="mx-auto flex w-full max-w-[220px] flex-col gap-5 rounded-[2rem] bg-slate-900 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <div className="mx-auto h-14 w-14 rounded-full bg-rose-500/50 shadow-[0_0_0_8px_rgba(255,255,255,0.03)]" />
            <div className="mx-auto h-14 w-14 rounded-full bg-amber-400/50 shadow-[0_0_0_8px_rgba(255,255,255,0.03)]" />
            <button
              type="button"
              disabled={loading || isPending}
              onClick={() => {
                if (isApproved) {
                  onOpenDashboard?.();
                  return;
                }

                void onRequestAccess();
              }}
              className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-emerald-400 text-center text-lg font-display font-bold text-emerald-950 shadow-[0_16px_40px_rgba(16,185,129,0.4)] transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-80"
            >
              {loading ? <Loader2 className="h-8 w-8 animate-spin" /> : isApproved ? "GO" : "PUSH"}
            </button>
          </div>

          <div className="space-y-6">
            <div className="inline-flex rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-white">
              Kids Portal
            </div>
            <StatusCopy requestState={requestState} />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-100/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Safe start</p>
                <p className="mt-2 text-sm text-slate-700">
                  This screen never guesses a family. It only works with the active family already selected.
                </p>
              </div>
              <div className="rounded-2xl bg-slate-100/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Parent approval</p>
                <p className="mt-2 text-sm text-slate-700">
                  Approval stays on the server. The green button only asks. It does not unlock anything by itself.
                </p>
              </div>
            </div>

            {requestState.status === "expired" && (
              <div className="inline-flex items-center rounded-full bg-slate-950 px-4 py-2 text-sm text-white">
                <TimerReset className="mr-2 h-4 w-4" />
                Ask again for a new dashboard window.
              </div>
            )}

            <Button
              type="button"
              size="lg"
              className="h-14 rounded-full bg-emerald-500 px-8 text-base text-white hover:bg-emerald-400"
              disabled={loading || isPending}
              onClick={() => {
                if (isApproved) {
                  onOpenDashboard?.();
                  return;
                }

                void onRequestAccess();
              }}
            >
              {loading
                ? "Sending..."
                : isPending
                  ? "Waiting for parent approval"
                  : isApproved
                    ? "Open my dashboard"
                    : "Press the green button"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
