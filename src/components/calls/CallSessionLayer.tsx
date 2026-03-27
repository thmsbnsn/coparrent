import type { DailyParticipant, DailyMeetingState } from "@daily-co/daily-js";
import type { CallSessionRow } from "@/lib/calls";
import { ActiveCallPanel } from "@/components/calls/ActiveCallPanel";
import { IncomingCallSheet } from "@/components/calls/IncomingCallSheet";
import { OutgoingCallSheet } from "@/components/calls/OutgoingCallSheet";

interface CallSessionLayerProps {
  activeSession: CallSessionRow | null;
  incomingSession: CallSessionRow | null;
  isJoined: boolean;
  isLocalAudioEnabled: boolean;
  isLocalVideoEnabled: boolean;
  localParticipant: DailyParticipant | null;
  meetingState: DailyMeetingState;
  onAcceptIncoming: () => void;
  onCancelOutgoing: () => void;
  onDeclineIncoming: () => void;
  onEndActive: () => void;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  outgoingSession: CallSessionRow | null;
  remoteParticipant: DailyParticipant | null;
}

export const CallSessionLayer = ({
  activeSession,
  incomingSession,
  isJoined,
  isLocalAudioEnabled,
  isLocalVideoEnabled,
  localParticipant,
  meetingState,
  onAcceptIncoming,
  onCancelOutgoing,
  onDeclineIncoming,
  onEndActive,
  onToggleAudio,
  onToggleVideo,
  outgoingSession,
  remoteParticipant,
}: CallSessionLayerProps) => {
  return (
    <>
      {incomingSession && (
        <IncomingCallSheet
          open={Boolean(incomingSession)}
          session={incomingSession}
          onAccept={onAcceptIncoming}
          onDecline={onDeclineIncoming}
        />
      )}

      {outgoingSession &&
        outgoingSession.status === "ringing" &&
        outgoingSession.initiator_profile_id && (
          <OutgoingCallSheet
            open
            session={outgoingSession}
            onCancel={onCancelOutgoing}
          />
        )}

      {activeSession && (meetingState === "joining-meeting" || isJoined) && (
        <ActiveCallPanel
          callType={activeSession.call_type}
          isLocalAudioEnabled={isLocalAudioEnabled}
          isLocalVideoEnabled={isLocalVideoEnabled}
          localParticipant={localParticipant}
          remoteParticipant={remoteParticipant}
          onEnd={onEndActive}
          onToggleAudio={onToggleAudio}
          onToggleVideo={onToggleVideo}
        />
      )}
    </>
  );
};
