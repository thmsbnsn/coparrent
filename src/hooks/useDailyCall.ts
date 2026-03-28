import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DailyIframe, {
  type DailyCall,
  type DailyEventObject,
  type DailyMeetingState,
  type DailyParticipant,
  type DailyParticipantsObject,
} from "@daily-co/daily-js";
import { supabase } from "@/integrations/supabase/client";
import type { CallSessionRow } from "@/lib/calls";

const CALL_EVENTS = [
  "joined-meeting",
  "left-meeting",
  "error",
  "participant-joined",
  "participant-updated",
  "participant-left",
] as const;

export const useDailyCall = () => {
  const callObjectRef = useRef<DailyCall | null>(null);
  const pendingJoinSessionIdRef = useRef<string | null>(null);
  const [callObject, setCallObject] = useState<DailyCall | null>(null);
  const [currentCallSessionId, setCurrentCallSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [meetingState, setMeetingState] = useState<DailyMeetingState>("new");
  const [participants, setParticipants] = useState<DailyParticipantsObject>({});

  const syncState = useCallback((target: DailyCall) => {
    setMeetingState(target.meetingState());
    setParticipants({ ...target.participants() });
  }, []);

  const destroyCallObject = useCallback(async () => {
    const current = callObjectRef.current;
    if (!current) {
      setCurrentCallSessionId(null);
      setCallObject(null);
      setParticipants({});
      setMeetingState("left-meeting");
      return;
    }

    callObjectRef.current = null;

    try {
      const state = current.meetingState();
      if (state === "joined-meeting" || state === "joining-meeting") {
        await current.leave();
      }
    } catch (leaveError) {
      console.error("Error leaving Daily call:", leaveError);
    }

    try {
      if (!current.isDestroyed()) {
        await current.destroy();
      }
    } catch (destroyError) {
      console.error("Error destroying Daily call object:", destroyError);
    }

    setCallObject(null);
    setCurrentCallSessionId(null);
    setParticipants({});
    setMeetingState("left-meeting");
  }, []);

  useEffect(() => {
    if (!callObject) {
      return;
    }

    const handleStateChange = (event?: DailyEventObject) => {
      if (event?.action === "error") {
        setError(event?.errorMsg ?? "Daily call error");
      }
      syncState(callObject);
    };

    for (const eventName of CALL_EVENTS) {
      callObject.on(eventName, handleStateChange);
    }

    syncState(callObject);

    return () => {
      for (const eventName of CALL_EVENTS) {
        callObject.off(eventName, handleStateChange);
      }
    };
  }, [callObject, syncState]);

  useEffect(() => {
    return () => {
      void destroyCallObject();
    };
  }, [destroyCallObject]);

  const joinCall = useCallback(
    async (session: CallSessionRow) => {
      setError(null);

      if (pendingJoinSessionIdRef.current === session.id) {
        return;
      }

      const sameSessionCallObject = callObjectRef.current;
      const sameSessionMeetingState =
        currentCallSessionId === session.id
          ? sameSessionCallObject?.meetingState() ?? meetingState
          : null;

      if (
        currentCallSessionId === session.id &&
        (sameSessionMeetingState === "joining-meeting" ||
          sameSessionMeetingState === "joined-meeting")
      ) {
        return;
      }

      if (callObjectRef.current && currentCallSessionId !== session.id) {
        await destroyCallObject();
      }

      pendingJoinSessionIdRef.current = session.id;
      setCurrentCallSessionId(session.id);

      try {
        const { data, error: joinError } = await supabase.functions.invoke("join-call-session", {
          body: {
            call_session_id: session.id,
          },
        });

        if (joinError || !data?.success) {
          throw new Error(data?.error ?? joinError?.message ?? "Unable to join the call.");
        }

        const current = callObjectRef.current ?? DailyIframe.createCallObject();
        callObjectRef.current = current;
        setCallObject(current);

        await current.join({
          token: data.token as string,
          url: data.room_url as string,
          userName: data.user_name as string,
        });

        syncState(current);
      } catch (error) {
        setCurrentCallSessionId((current) => (current === session.id ? null : current));
        throw error;
      } finally {
        if (pendingJoinSessionIdRef.current === session.id) {
          pendingJoinSessionIdRef.current = null;
        }
      }
    },
    [currentCallSessionId, destroyCallObject, meetingState, syncState],
  );

  const toggleAudio = useCallback(() => {
    if (!callObjectRef.current) {
      return;
    }

    const nextEnabled = !callObjectRef.current.localAudio();
    callObjectRef.current.setLocalAudio(nextEnabled);
    syncState(callObjectRef.current);
  }, [syncState]);

  const toggleVideo = useCallback(() => {
    if (!callObjectRef.current) {
      return;
    }

    const nextEnabled = !callObjectRef.current.localVideo();
    callObjectRef.current.setLocalVideo(nextEnabled);
    syncState(callObjectRef.current);
  }, [syncState]);

  const localParticipant = useMemo(
    () => participants.local ?? Object.values(participants).find((participant) => participant.local) ?? null,
    [participants],
  );

  const remoteParticipant = useMemo(
    () => Object.values(participants).find((participant) => !participant.local) ?? null,
    [participants],
  );

  return {
    callObject,
    currentCallSessionId,
    destroyCallObject,
    error,
    isJoined: meetingState === "joined-meeting",
    isLocalAudioEnabled: callObject?.localAudio() ?? false,
    isLocalVideoEnabled: callObject?.localVideo() ?? false,
    joinCall,
    localParticipant: localParticipant as DailyParticipant | null,
    meetingState,
    remoteParticipant: remoteParticipant as DailyParticipant | null,
    toggleAudio,
    toggleVideo,
  };
};
