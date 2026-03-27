import { useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useFamilyRole } from "@/hooks/useFamilyRole";
import { useCallSessions } from "@/hooks/useCallSessions";
import { useDailyCall } from "@/hooks/useDailyCall";
import { CallSessionLayer } from "@/components/calls/CallSessionLayer";

export const GlobalCallManager = () => {
  const { profileId } = useFamilyRole();
  const {
    activeSession,
    endCall,
    incomingSession,
    respondToCall,
    sessions,
  } = useCallSessions(null);
  const {
    currentCallSessionId,
    destroyCallObject,
    error: dailyCallError,
    isJoined,
    isLocalAudioEnabled,
    isLocalVideoEnabled,
    joinCall,
    localParticipant,
    meetingState,
    remoteParticipant,
    toggleAudio,
    toggleVideo,
  } = useDailyCall();

  useEffect(() => {
    if (!activeSession) {
      if (
        currentCallSessionId &&
        (meetingState === "joined-meeting" || meetingState === "joining-meeting")
      ) {
        void destroyCallObject();
      }
      return;
    }

    if (currentCallSessionId === activeSession.id) {
      return;
    }

    void joinCall(activeSession).catch((error) => {
      console.error("Error joining active call:", error);
      toast.error(error instanceof Error ? error.message : "Unable to join the call.");
    });
  }, [activeSession, currentCallSessionId, destroyCallObject, joinCall, meetingState]);

  useEffect(() => {
    if (dailyCallError) {
      toast.error(dailyCallError);
    }
  }, [dailyCallError]);

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

  const handleAcceptIncomingCall = useCallback(async () => {
    if (!incomingSession) {
      return;
    }

    await respondToCall(incomingSession.id, "accept");
  }, [incomingSession, respondToCall]);

  const handleDeclineIncomingCall = useCallback(async () => {
    if (!incomingSession) {
      return;
    }

    await respondToCall(incomingSession.id, "decline");
  }, [incomingSession, respondToCall]);

  const handleCancelOutgoingCall = useCallback(async () => {
    if (!outgoingSession) {
      return;
    }

    await endCall(outgoingSession.id, "cancelled");
  }, [endCall, outgoingSession]);

  const handleEndActiveCall = useCallback(async () => {
    if (!activeSession) {
      return;
    }

    await endCall(activeSession.id, "ended");
    await destroyCallObject();
  }, [activeSession, destroyCallObject, endCall]);

  if (!incomingSession && !outgoingSession && !activeSession) {
    return null;
  }

  return (
    <CallSessionLayer
      activeSession={activeSession}
      incomingSession={incomingSession}
      isJoined={isJoined}
      isLocalAudioEnabled={isLocalAudioEnabled}
      isLocalVideoEnabled={isLocalVideoEnabled}
      localParticipant={localParticipant}
      meetingState={meetingState}
      onAcceptIncoming={() => void handleAcceptIncomingCall()}
      onCancelOutgoing={() => void handleCancelOutgoingCall()}
      onDeclineIncoming={() => void handleDeclineIncomingCall()}
      onEndActive={() => void handleEndActiveCall()}
      onToggleAudio={toggleAudio}
      onToggleVideo={toggleVideo}
      outgoingSession={outgoingSession}
      remoteParticipant={remoteParticipant}
    />
  );
};
