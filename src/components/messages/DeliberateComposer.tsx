import { FormEvent, useMemo, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface DeliberateComposerProps {
  onSend: (message: string) => Promise<void> | void;
  onTyping?: () => void;
  placeholder?: string;
  className?: string;
}

const COURT_FRIENDLY_HINTS = [
  "State facts, dates, and requested actions.",
  "Keep tone neutral and child-focused.",
  "Avoid rapid-fire replies when emotions are elevated.",
];

export const DeliberateComposer = ({
  onSend,
  onTyping,
  placeholder = "Compose your message...",
  className,
}: DeliberateComposerProps) => {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);

  const trimmed = value.trim();
  const characterCount = value.length;

  const helperText = useMemo(() => {
    if (characterCount === 0) return COURT_FRIENDLY_HINTS[0];
    if (characterCount < 80) return COURT_FRIENDLY_HINTS[1];
    return COURT_FRIENDLY_HINTS[2];
  }, [characterCount]);

  const handleSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!trimmed || sending) return;

    setSending(true);
    try {
      await onSend(trimmed);
      setValue("");
    } finally {
      setSending(false);
    }
  };

  return (
    <form
      className={cn("border-t border-border bg-muted/20 p-4", className)}
      onSubmit={handleSubmit}
    >
      <div className="rounded-xl border border-border bg-background p-3">
        <Textarea
          value={value}
          onChange={(event) => {
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

        <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium text-foreground">Deliberate composer</p>
            <p className="text-xs text-muted-foreground">{helperText}</p>
          </div>
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <span className="text-xs text-muted-foreground">
              {characterCount}/4000
            </span>
            <Button type="submit" disabled={!trimmed || sending}>
              {sending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Send message
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
};
