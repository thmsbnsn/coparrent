import { Loader2, PhoneOff, Video } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getCallSourceLabel, type CallSessionRow } from "@/lib/calls";

interface OutgoingCallSheetProps {
  onCancel: () => void;
  open: boolean;
  session: CallSessionRow;
}

const getInitials = (name: string | null) => {
  if (!name) {
    return "?";
  }

  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export const OutgoingCallSheet = ({ onCancel, open, session }: OutgoingCallSheetProps) => {
  const calleeName = session.callee_display_name ?? "Family member";
  const sourceLabel = getCallSourceLabel(session.source);

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-sm border-none bg-slate-950 text-slate-50 shadow-2xl sm:rounded-3xl">
        <DialogTitle className="sr-only">
          Outgoing {session.call_type} call to {calleeName}
        </DialogTitle>
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <Badge variant="secondary" className="bg-white/10 text-slate-200">
            Calling from {sourceLabel}
          </Badge>
          <Avatar className="h-20 w-20 border border-white/15">
            <AvatarFallback className="bg-white/10 text-xl text-white">
              {getInitials(calleeName)}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <p className="text-2xl font-semibold">{calleeName}</p>
            <p className="text-sm text-slate-300">
              Waiting for them to answer your {session.call_type} call
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-sm text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            Ringing…
          </div>
          <div className="flex w-full items-center gap-3 pt-2">
            <Button
              type="button"
              className="flex-1 bg-red-500 text-white hover:bg-red-400"
              onClick={onCancel}
            >
              <PhoneOff className="mr-2 h-4 w-4" />
              Cancel call
            </Button>
            {session.call_type === "video" && (
              <div className="hidden rounded-full border border-white/10 p-3 text-slate-300 sm:block">
                <Video className="h-4 w-4" />
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
