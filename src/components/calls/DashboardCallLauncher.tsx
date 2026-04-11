import { useMemo, useState } from "react";
import { Loader2, Phone, Video } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CALL_ROLE_LABELS } from "@/lib/calls";
import { canUseVideoCall } from "@/lib/kidsPortal";
import type { CallableFamilyMember } from "@/hooks/useCallableFamilyMembers";

interface DashboardCallLauncherProps {
  contacts: CallableFamilyMember[];
  disabled?: boolean;
  error?: string | null;
  loading?: boolean;
  onStartCall: (contact: CallableFamilyMember, callType: "audio" | "video") => Promise<void> | void;
}

const getInitials = (name: string | null, email: string | null) => {
  const rawName = name?.trim() || email?.trim() || "?";
  const parts = rawName.split(/\s+/);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export const DashboardCallLauncher = ({
  contacts,
  disabled = false,
  error = null,
  loading = false,
  onStartCall,
}: DashboardCallLauncherProps) => {
  const [open, setOpen] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const contactSummary = useMemo(() => {
    if (loading) return "Checking family calling access";
    if (contacts.length === 0) return "No family contacts";
    if (contacts.length === 1) return "1 callable contact";
    return `${contacts.length} callable contacts`;
  }, [contacts.length, loading]);

  const handleStartCall = async (contact: CallableFamilyMember, callType: "audio" | "video") => {
    const nextKey = `${contact.profileId}:${callType}`;
    setPendingKey(nextKey);

    try {
      await onStartCall(contact, callType);
      setOpen(false);
    } finally {
      setPendingKey(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-11 rounded-2xl border-primary/15 bg-background/80 px-3 shadow-[0_18px_32px_-28px_hsl(var(--primary)/0.55)] hover:border-primary/25 hover:bg-background"
          disabled={disabled}
          aria-label="Open family calling"
        >
          <Phone className="h-4 w-4 text-primary" />
          <span className="hidden sm:inline">Call</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="overflow-hidden rounded-[2rem] border border-border/70 bg-background/95 p-0 shadow-[0_36px_80px_-44px_rgba(8,21,47,0.6)] backdrop-blur-xl sm:max-w-[680px]">
        <div className="relative overflow-hidden border-b border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.16),transparent_28%),radial-gradient(circle_at_top_right,rgba(37,99,235,0.16),transparent_34%),linear-gradient(135deg,rgba(11,18,33,0.98),rgba(16,24,40,0.96))] px-6 pb-6 pt-7 text-white">
          <div className="absolute inset-x-0 top-0 h-px bg-white/10" />
          <div className="absolute left-6 top-3 h-20 w-20 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute right-6 top-2 h-20 w-20 rounded-full bg-accent/20 blur-3xl" />
          <DialogHeader className="relative space-y-3 text-left">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-100/85">
              <Phone className="h-3.5 w-3.5" />
              Family calling
            </div>
            <DialogTitle className="font-display text-2xl text-white">
              Start a family call
            </DialogTitle>
            <DialogDescription className="max-w-2xl text-sm leading-6 text-slate-200/78">
              Choose anyone in the current family who is explicitly available for calling. Messaging records still note who placed the call and how it ended.
            </DialogDescription>
          </DialogHeader>

          <div className="relative mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-xs text-slate-100/80">
            <span className="h-2 w-2 rounded-full bg-accent" />
            {disabled ? "A call is already active" : contactSummary}
          </div>
        </div>

        <div className="space-y-4 p-6">
          {loading ? (
            <div className="flex min-h-40 items-center justify-center rounded-[1.75rem] border border-dashed border-border/70 bg-muted/25">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading callable family members
              </div>
            </div>
          ) : error ? (
            <div className="rounded-[1.75rem] border border-destructive/30 bg-destructive/10 p-8 text-center">
              <p className="text-base font-semibold text-foreground">Callable family members did not load</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {error}
              </p>
            </div>
          ) : contacts.length > 0 ? (
            <div className="space-y-3">
              {contacts.map((contact) => {
                const audioKey = `${contact.profileId}:audio`;
                const videoKey = `${contact.profileId}:video`;
                const label = contact.fullName ?? contact.email ?? "Family member";

                return (
                  <div
                    key={contact.profileId}
                    className="rounded-[1.75rem] border border-border/70 bg-card/80 p-4 shadow-[0_20px_36px_-34px_rgba(8,21,47,0.55)]"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="h-14 w-14 border border-primary/15 bg-primary/10">
                          <AvatarImage src={contact.avatarUrl ?? undefined} alt={label} />
                          <AvatarFallback className="bg-primary/10 font-semibold text-primary">
                            {getInitials(contact.fullName, contact.email)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="min-w-0 space-y-2">
                          <p className="truncate text-base font-semibold text-foreground">{label}</p>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary" className="rounded-full">
                              {CALL_ROLE_LABELS[contact.role]}
                            </Badge>
                            {contact.relationshipLabel ? (
                              <Badge variant="outline" className="rounded-full border-border/70">
                                {contact.relationshipLabel}
                              </Badge>
                            ) : null}
                            {!canUseVideoCall(contact.allowedCallMode) ? (
                              <Badge variant="outline" className="rounded-full border-accent/25 bg-accent/10 text-accent-foreground">
                                Audio only
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:w-auto">
                        <Button
                          type="button"
                          className="h-11 rounded-2xl px-4"
                          disabled={Boolean(pendingKey)}
                          onClick={() => {
                            void handleStartCall(contact, "audio");
                          }}
                        >
                          {pendingKey === audioKey ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Phone className="h-4 w-4" />
                              Audio
                            </>
                          )}
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          className="h-11 rounded-2xl px-4"
                          disabled={Boolean(pendingKey) || !canUseVideoCall(contact.allowedCallMode)}
                          onClick={() => {
                            void handleStartCall(contact, "video");
                          }}
                        >
                          {pendingKey === videoKey ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Video className="h-4 w-4" />
                              Video
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[1.75rem] border border-dashed border-border/70 bg-muted/25 p-8 text-center">
              <p className="text-base font-semibold text-foreground">No callable family members yet</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Add or approve family contacts first. This launcher only shows people in the active family who are explicitly allowed for calling.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
