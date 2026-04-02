import { Loader2, ShieldCheck, ShieldX } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { KidPortalApprovalRequest } from "@/hooks/useKidPortalApprovals";

interface ParentApprovalSheetProps {
  loading?: boolean;
  onDecision: (requestId: string, decision: "approve" | "decline") => Promise<void> | void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  requests: KidPortalApprovalRequest[];
}

export const ParentApprovalSheet = ({
  loading = false,
  onDecision,
  onOpenChange,
  open,
  requests,
}: ParentApprovalSheetProps) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
      <SheetHeader>
        <SheetTitle>Kids Portal Approvals</SheetTitle>
        <SheetDescription>
          Review under-6 dashboard requests for the active family. Approval stays server-authorized
          and time-limited.
        </SheetDescription>
      </SheetHeader>

      <div className="mt-6 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading requests...
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-muted/30 p-6 text-center">
            <p className="font-medium">No pending requests</p>
            <p className="mt-1 text-sm text-muted-foreground">
              New under-6 approvals will appear here as soon as a child presses the green button.
            </p>
          </div>
        ) : (
          requests.map((request) => (
            <div
              key={request.id}
              className="rounded-3xl border border-border bg-card p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Waiting for approval</p>
                  <h3 className="mt-1 text-xl font-display font-semibold">{request.child_name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Requested {formatDistanceToNow(new Date(request.requested_at), { addSuffix: true })}
                  </p>
                </div>
                <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  Under 6
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-muted/40 p-4 text-sm text-muted-foreground">
                Opening the child dashboard will stay limited to this family and to the current
                approval window.
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 rounded-2xl border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                  onClick={() => void onDecision(request.id, "decline")}
                >
                  <ShieldX className="mr-2 h-4 w-4" />
                  Decline
                </Button>
                <Button
                  type="button"
                  className="h-12 rounded-2xl bg-emerald-500 text-white hover:bg-emerald-400"
                  onClick={() => void onDecision(request.id, "approve")}
                >
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Approve
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </SheetContent>
  </Sheet>
);
