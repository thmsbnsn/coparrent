import { useState, useEffect, useRef } from "react";
import { Camera, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChildAvatar } from "@/hooks/useChildAvatar";

interface ChildAvatarProps {
  childId: string;
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  editable?: boolean;
  onAvatarChange?: (url: string | null) => void;
  className?: string;
}

const sizeClasses = {
  sm: "w-10 h-10 text-sm",
  md: "w-12 h-12 text-base",
  lg: "w-16 h-16 text-xl",
  xl: "w-20 h-20 text-2xl",
};

const iconSizes = {
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-6 h-6",
  xl: "w-8 h-8",
};

export const ChildAvatar = ({
  childId,
  name,
  size = "md",
  editable = false,
  onAvatarChange,
  className,
}: ChildAvatarProps) => {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { getAvatarUrl, uploadAvatar, uploading } = useChildAvatar();

  // Fetch avatar URL on mount and when childId changes
  useEffect(() => {
    let isMounted = true;

    const fetchAvatar = async () => {
      setIsLoading(true);
      setImageError(false);
      const url = await getAvatarUrl(childId);
      if (isMounted) {
        setAvatarUrl(url);
        setIsLoading(false);
      }
    };

    if (childId) {
      fetchAvatar();
    } else {
      setIsLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [childId, getAvatarUrl]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const newUrl = await uploadAvatar(childId, file);
    if (newUrl) {
      setAvatarUrl(newUrl);
      setImageError(false);
      onAvatarChange?.(newUrl);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClick = () => {
    if (editable && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const showImage = avatarUrl && !imageError && !isLoading;

  return (
    <div className={cn("relative group", className)}>
      <button
        type="button"
        onClick={handleClick}
        disabled={!editable || uploading}
        className={cn(
          "rounded-full flex items-center justify-center overflow-hidden transition-all",
          "bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold",
          "border-2 border-transparent",
          sizeClasses[size],
          editable && "cursor-pointer hover:border-primary/50",
          uploading && "opacity-50 cursor-wait",
          !editable && "cursor-default"
        )}
      >
        {isLoading ? (
          <div className="animate-pulse bg-muted rounded-full w-full h-full" />
        ) : showImage ? (
          <img
            src={avatarUrl}
            alt={name}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <span>{initials || <User className={iconSizes[size]} />}</span>
        )}

        {/* Edit overlay */}
        {editable && !uploading && (
          <div
            className={cn(
              "absolute inset-0 bg-black/50 rounded-full flex items-center justify-center",
              "opacity-0 group-hover:opacity-100 transition-opacity"
            )}
          >
            <Camera className={cn("text-white", iconSizes[size])} />
          </div>
        )}

        {/* Uploading overlay */}
        {uploading && (
          <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </button>

      {/* Hidden file input */}
      {editable && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleFileSelect}
          className="hidden"
          aria-label="Upload profile photo"
        />
      )}
    </div>
  );
};
