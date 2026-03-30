import type { DailyParticipant } from "@daily-co/daily-js";
import type { CallSessionRow } from "@/lib/calls";
import { ActiveCallPanel } from "@/components/calls/ActiveCallPanel";
import { IncomingCallSheet } from "@/components/calls/IncomingCallSheet";
import { OutgoingCallSheet } from "@/components/calls/OutgoingCallSheet";

interface CallSessionLayerProps {
  activeSession: CallSessionRow | null;
  incomingSession: CallSessionRow | null;
  isLocalAudioEnabled: boolean;
  isLocalVideoEnabled: boolean;
  localParticipant: DailyParticipant | null;
  onAcceptIncoming: () => void;
  onCancelOutgoing: () => void;
  onDeclineIncoming: () => void;
  onEndActive: () => void;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  outgoingSession: CallSessionRow | null;
  remoteParticipant: DailyParticipant | null;
  showActiveCallPanel: boolean;
}

export const CallSessionLayer = ({
  activeSession,
  incomingSession,
  isLocalAudioEnabled,
  isLocalVideoEnabled,
  localParticipant,
  onAcceptIncoming,
  onCancelOutgoing,
  onDeclineIncoming,
  onEndActive,
  onToggleAudio,
  onToggleVideo,
  outgoingSession,
  remoteParticipant,
  showActiveCallPanel,
}: CallSessionLayerProps) => {
  const hasActiveCallPanel = Boolean(activeSession && showActiveCallPanel);

  return (
    <>
      {!hasActiveCallPanel && incomingSession && (
        <IncomingCallSheet
          open={Boolean(incomingSession)}
          session={incomingSession}
          onAccept={onAcceptIncoming}
          onDecline={onDeclineIncoming}
        />
      )}

      {!hasActiveCallPanel &&
        outgoingSession &&
        outgoingSession.status === "ringing" &&
        outgoingSession.initiator_profile_id && (
          <OutgoingCallSheet
            open
            session={outgoingSession}
            onCancel={onCancelOutgoing}
          />
        )}

      {hasActiveCallPanel && activeSession && (
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
