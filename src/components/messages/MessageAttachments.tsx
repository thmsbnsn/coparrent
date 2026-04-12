import { FileText, Play } from "lucide-react";
import type { MessageAttachment } from "@/hooks/useMessagingHub";
import { cn } from "@/lib/utils";

interface MessageAttachmentsProps {
  attachments: MessageAttachment[];
  onOpenAttachment: (attachment: MessageAttachment) => void;
}

const isImageAttachment = (fileType: string) => fileType.startsWith("image/");
const isVideoAttachment = (fileType: string) => fileType.startsWith("video/");

export const MessageAttachments = ({
  attachments,
  onOpenAttachment,
}: MessageAttachmentsProps) => {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {attachments.map((attachment) => (
        <button
          key={attachment.id}
          type="button"
          onClick={() => onOpenAttachment(attachment)}
          className="overflow-hidden rounded-2xl border border-border/70 bg-background/80 text-left transition hover:border-primary/30 hover:bg-background"
        >
          {isImageAttachment(attachment.file_type) && attachment.preview_url ? (
            <img
              src={attachment.preview_url}
              alt={attachment.title}
              className="h-32 w-full object-cover"
            />
          ) : isVideoAttachment(attachment.file_type) && attachment.preview_url ? (
            <div className="relative h-32 w-full overflow-hidden bg-black">
              <video
                className="h-full w-full object-cover opacity-80"
                muted
                preload="metadata"
                src={attachment.preview_url}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="rounded-full border border-white/20 bg-black/45 p-3 text-white">
                  <Play className="h-5 w-5" />
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex items-center gap-3 px-3 py-3">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-muted/40 text-muted-foreground",
                attachment.attachment_type === "image" && "text-primary",
                attachment.attachment_type === "video" && "text-primary",
              )}
            >
              {attachment.attachment_type === "video" ? (
                <Play className="h-4 w-4" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {attachment.title}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {attachment.attachment_type === "document"
                  ? "Document"
                  : attachment.attachment_type === "video"
                    ? "Video"
                    : "Photo"}
              </p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};
