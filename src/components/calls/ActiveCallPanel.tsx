import { useEffect, useMemo, useRef } from "react";
import { Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";
import type { DailyParticipant } from "@daily-co/daily-js";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ActiveCallPanelProps {
  callType: "audio" | "video";
  isLocalAudioEnabled: boolean;
  isLocalVideoEnabled: boolean;
  localParticipant: DailyParticipant | null;
  onEnd: () => void;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  remoteParticipant: DailyParticipant | null;
}

const getDisplayName = (participant: DailyParticipant | null, fallback: string) =>
  participant?.user_name?.trim() || fallback;

const MediaTile = ({
  className,
  label,
  muted,
  participant,
}: {
  className?: string;
  label: string;
  muted: boolean;
  participant: DailyParticipant | null;
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoTrack = participant?.tracks.video.state === "playable" ? participant.tracks.video.track : null;
  const audioTrack = participant?.tracks.audio.state === "playable" ? participant.tracks.audio.track : null;
  const hasVideo = Boolean(videoTrack);

  useEffect(() => {
    if (videoRef.current) {
      if (videoTrack) {
        const stream = new MediaStream([videoTrack]);
        videoRef.current.srcObject = stream;
      } else {
        videoRef.current.srcObject = null;
      }
    }

    if (audioRef.current) {
      if (audioTrack) {
        const stream = new MediaStream([audioTrack]);
        audioRef.current.srcObject = stream;
      } else {
        audioRef.current.srcObject = null;
      }
    }
  }, [audioTrack, videoTrack]);

  const initials = useMemo(() => {
    const rawName = participant?.user_name?.trim() || label;
    const parts = rawName.split(/\s+/);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }, [label, participant?.user_name]);

  return (
    <div className={cn("relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900", className)}>
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full min-h-56 items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/5 text-2xl font-semibold text-white">
            {initials}
          </div>
        </div>
      )}

      {!muted && <audio ref={audioRef} autoPlay playsInline />}

      <div className="absolute left-3 top-3">
        <Badge variant="secondary" className="bg-black/45 text-white backdrop-blur-sm">
          {label}
        </Badge>
      </div>
    </div>
  );
};

export const ActiveCallPanel = ({
  callType,
  isLocalAudioEnabled,
  isLocalVideoEnabled,
  localParticipant,
  onEnd,
  onToggleAudio,
  onToggleVideo,
  remoteParticipant,
}: ActiveCallPanelProps) => {
  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/95 text-white backdrop-blur-md">
      <div className="mx-auto flex h-full w-full max-w-6xl min-h-0 flex-col gap-4 overflow-y-auto px-4 py-4 pb-32 sm:px-6 sm:py-6 sm:pb-36">
        <div className="flex shrink-0 items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Live call</p>
            <h2 className="mt-1 text-2xl font-semibold">
              {callType === "video" ? "Video call in progress" : "Audio call in progress"}
            </h2>
          </div>
          <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-200">
            Connected
          </Badge>
        </div>

        <div
          className={cn(
            "grid min-h-0 flex-1 gap-4",
            callType === "video" ? "grid-cols-1 lg:grid-cols-[1.2fr_0.8fr]" : "grid-cols-1",
          )}
        >
          <MediaTile
            className={cn("min-h-[16rem] sm:min-h-[18rem]", callType === "video" && "lg:min-h-[28rem]")}
            label={getDisplayName(remoteParticipant, "Other participant")}
            muted={false}
            participant={remoteParticipant}
          />
          <MediaTile
            className={cn(
              "min-h-[10rem] sm:min-h-[14rem]",
              callType === "video" ? "lg:min-h-[28rem]" : "hidden",
            )}
            label="You"
            muted
            participant={localParticipant}
          />
        </div>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[121] p-4 pt-0 sm:p-6 sm:pt-0">
        <div className="pointer-events-auto mx-auto max-w-4xl rounded-3xl border border-white/10 bg-slate-900/90 p-3 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-center gap-3 pb-[max(env(safe-area-inset-bottom),0px)]">
            <Button
              type="button"
              variant="outline"
              className="min-w-[10rem] flex-1 border-white/15 bg-white/5 text-white hover:bg-white/10 sm:flex-initial"
              onClick={onToggleAudio}
            >
              {isLocalAudioEnabled ? <Mic className="mr-2 h-4 w-4" /> : <MicOff className="mr-2 h-4 w-4" />}
              {isLocalAudioEnabled ? "Mute mic" : "Unmute mic"}
            </Button>
            {callType === "video" && (
              <Button
                type="button"
                variant="outline"
                className="min-w-[10rem] flex-1 border-white/15 bg-white/5 text-white hover:bg-white/10 sm:flex-initial"
                onClick={onToggleVideo}
              >
                {isLocalVideoEnabled ? <Video className="mr-2 h-4 w-4" /> : <VideoOff className="mr-2 h-4 w-4" />}
                {isLocalVideoEnabled ? "Camera off" : "Camera on"}
              </Button>
            )}
            <Button
              type="button"
              className="min-w-[10rem] flex-1 bg-red-500 text-white hover:bg-red-400 sm:flex-initial"
              onClick={onEnd}
            >
              <PhoneOff className="mr-2 h-4 w-4" />
              End call
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
