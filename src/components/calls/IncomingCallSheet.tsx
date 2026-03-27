import { Phone, PhoneOff, Video } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getCallSourceLabel, type CallSessionRow } from "@/lib/calls";

interface IncomingCallSheetProps {
  onAccept: () => void;
  onDecline: () => void;
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

export const IncomingCallSheet = ({
  onAccept,
  onDecline,
  open,
  session,
}: IncomingCallSheetProps) => {
  const callerName = session.initiator_display_name ?? "Family member";
  const sourceLabel = getCallSourceLabel(session.source);

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-sm border-none bg-slate-950 text-slate-50 shadow-2xl sm:rounded-3xl">
        <DialogTitle className="sr-only">
          Incoming {session.call_type} call from {callerName}
        </DialogTitle>
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-200">
            Incoming {session.call_type} call
          </Badge>
          <Avatar className="h-20 w-20 border border-white/15">
            <AvatarFallback className="bg-white/10 text-xl text-white">
              {getInitials(callerName)}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <p className="text-2xl font-semibold">{callerName}</p>
            <p className="text-sm text-slate-300">
              {session.call_type === "video" ? "Video call" : "Audio call"} from {sourceLabel}
            </p>
          </div>

          <div className="flex w-full items-center gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 border-red-400/40 bg-red-500/10 text-red-100 hover:bg-red-500/20"
              onClick={onDecline}
            >
              <PhoneOff className="mr-2 h-4 w-4" />
              Decline
            </Button>
            <Button type="button" className="flex-1 bg-emerald-500 text-white hover:bg-emerald-400" onClick={onAccept}>
              {session.call_type === "video" ? <Video className="mr-2 h-4 w-4" /> : <Phone className="mr-2 h-4 w-4" />}
              Answer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
