import { FormEvent, useMemo, useRef, useState } from "react";
import { FileText, ImagePlus, Loader2, Send, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MessageToneAssistant } from "@/components/messages/MessageToneAssistant";

export interface ComposerAttachmentDraft {
  id: string;
  kind: "document" | "image" | "video";
  name: string;
  previewUrl?: string | null;
  sourceLabel?: string;
}

interface DeliberateComposerProps {
  onSend: (message: string) => Promise<void> | void;
  onTyping?: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  helperText?: string;
  submitLabel?: string;
  attachments?: ComposerAttachmentDraft[];
  onOpenDocumentVault?: () => void;
  onRemoveAttachment?: (attachmentId: string) => void;
  onSelectMediaFiles?: (files: File[]) => void;
  onSelectUploadFiles?: (files: File[]) => void;
  showAttachmentTools?: boolean;
}

const COMPOSER_HINTS = [
  "Keep updates clear and direct.",
  "Add a photo, video, or document when that helps the other parent.",
  "Use Ctrl or Cmd + Enter to send.",
];

export const DeliberateComposer = ({
  onSend,
  onTyping,
  placeholder = "Compose your message...",
  className,
  disabled = false,
  helperText,
  submitLabel = "Send message",
  attachments = [],
  onOpenDocumentVault,
  onRemoveAttachment,
  onSelectMediaFiles,
  onSelectUploadFiles,
  showAttachmentTools = false,
}: DeliberateComposerProps) => {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const trimmed = value.trim();
  const characterCount = value.length;
  const hasDraftContent = trimmed.length > 0 || attachments.length > 0;

  const autoHelperText = useMemo(() => {
    if (characterCount === 0) return COMPOSER_HINTS[0];
    if (attachments.length > 0) return COMPOSER_HINTS[1];
    return COMPOSER_HINTS[2];
  }, [attachments.length, characterCount]);

  const handleSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!hasDraftContent || sending || disabled) return;

    setSending(true);
    try {
      await onSend(trimmed);
      setValue("");
    } finally {
      setSending(false);
    }
  };

  return (
    <form className={cn("border-t border-border bg-muted/20 p-4", className)} onSubmit={handleSubmit}>
      <div className="rounded-xl border border-border bg-background p-3">
        {showAttachmentTools ? (
          <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-border pb-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              disabled={disabled}
              onClick={onOpenDocumentVault}
            >
              <FileText className="mr-2 h-4 w-4" />
              Vault
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              disabled={disabled}
              onClick={() => mediaInputRef.current?.click()}
            >
              <ImagePlus className="mr-2 h-4 w-4" />
              Photos
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              disabled={disabled}
              onClick={() => uploadInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload
            </Button>
            <input
              ref={mediaInputRef}
              multiple
              accept="image/*,video/*"
              className="hidden"
              type="file"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                if (files.length > 0) {
                  onSelectMediaFiles?.(files);
                }
                event.target.value = "";
              }}
            />
            <input
              ref={uploadInputRef}
              multiple
              className="hidden"
              type="file"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                if (files.length > 0) {
                  onSelectUploadFiles?.(files);
                }
                event.target.value = "";
              }}
            />
          </div>
        ) : null}

        {attachments.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center gap-2 rounded-2xl border border-border/70 bg-muted/30 px-3 py-2"
              >
                {attachment.previewUrl ? (
                  <img
                    src={attachment.previewUrl}
                    alt={attachment.name}
                    className="h-9 w-9 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="max-w-[12rem] truncate text-xs font-medium text-foreground">
                    {attachment.name}
                  </p>
                  {attachment.sourceLabel ? (
                    <p className="text-[11px] text-muted-foreground">{attachment.sourceLabel}</p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full"
                  disabled={disabled}
                  onClick={() => onRemoveAttachment?.(attachment.id)}
                >
                  <X className="h-3.5 w-3.5" />
                  <span className="sr-only">Remove attachment</span>
                </Button>
              </div>
            ))}
          </div>
        ) : null}

        <Textarea
          disabled={disabled}
          value={value}
          onChange={(event) => {
            if (disabled) {
              return;
            }
            setValue(event.target.value);
            onTyping?.();
          }}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              void handleSubmit();
            }
          }}
          placeholder={placeholder}
          rows={4}
          maxLength={4000}
          className="min-h-[110px] resize-none border-0 px-0 shadow-none focus-visible:ring-0"
        />

        {!disabled && (
          <MessageToneAssistant
            message={value}
            onRephrase={setValue}
            className="mt-3"
          />
        )}

        <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">{helperText ?? autoHelperText}</p>
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <span className="text-xs text-muted-foreground">
              {characterCount}/4000
            </span>
            <Button type="submit" disabled={disabled || !hasDraftContent || sending}>
              {sending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {submitLabel}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
};
