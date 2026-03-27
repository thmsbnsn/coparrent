import { Loader2, Phone, Video } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CallActionButtonsProps {
  disabled?: boolean;
  loading?: boolean;
  onStartAudio: () => void;
  onStartVideo: () => void;
}

export const CallActionButtons = ({
  disabled = false,
  loading = false,
  onStartAudio,
  onStartVideo,
}: CallActionButtonsProps) => {
  const isDisabled = disabled || loading;

  return (
    <div className="ml-auto flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        aria-label="Start audio call"
        disabled={isDisabled}
        onClick={onStartAudio}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label="Start video call"
        disabled={isDisabled}
        onClick={onStartVideo}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
      </Button>
    </div>
  );
};
