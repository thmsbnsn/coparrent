import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Phone, Video } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CALL_ROLE_LABELS } from "@/lib/calls";
import type { CallableFamilyMember } from "@/hooks/useCallableFamilyMembers";
import { canUseVideoCall } from "@/lib/kidsPortal";

interface DashboardCallWidgetProps {
  contacts: CallableFamilyMember[];
  disabled?: boolean;
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

export const DashboardCallWidget = ({
  contacts,
  disabled = false,
  loading = false,
  onStartCall,
}: DashboardCallWidgetProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.profileId === selectedProfileId) ?? null,
    [contacts, selectedProfileId],
  );

  const handleStartCall = async (contact: CallableFamilyMember, callType: "audio" | "video") => {
    const key = `${contact.profileId}:${callType}`;
    setPendingKey(key);

    try {
      await onStartCall(contact, callType);
      setIsOpen(false);
      setSelectedProfileId(null);
    } finally {
      setPendingKey(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 }}
      className="rounded-3xl border border-border bg-card p-5 sm:p-6"
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="inline-flex rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              Start a call
            </div>
            <div>
              <h2 className="text-xl font-display font-semibold">Call a family member</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Calls are limited to direct one-to-one conversations. When a call starts, the Messaging Hub records who placed it and how it ended.
              </p>
            </div>
          </div>

          <Button
            type="button"
            className="rounded-full bg-emerald-500 px-5 text-white hover:bg-emerald-400"
            disabled={disabled || contacts.length === 0}
            onClick={() => setIsOpen((current) => !current)}
          >
            <Phone className="mr-2 h-4 w-4" />
            {isOpen ? "Close caller" : "Open caller"}
          </Button>
        </div>

        {isOpen ? (
          contacts.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {contacts.map((contact) => {
                const isSelected = selectedProfileId === contact.profileId;
                const audioKey = `${contact.profileId}:audio`;
                const videoKey = `${contact.profileId}:video`;

                return (
                  <div
                    key={contact.profileId}
                    className={cn(
                      "group text-left",
                      disabled || loading ? "pointer-events-none opacity-70" : "",
                    )}
                  >
                    <div className="relative h-56 [perspective:1200px]">
                      <motion.div
                        animate={{ rotateY: isSelected ? 180 : 0 }}
                        transition={{ duration: 0.45, ease: "easeInOut" }}
                        style={{ transformStyle: "preserve-3d" }}
                        className="relative h-full w-full"
                      >
                        <button
                          type="button"
                          aria-label={`Choose ${contact.fullName ?? contact.email ?? "this contact"} to call`}
                          className={cn(
                            "absolute inset-0 rounded-3xl border bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-5 text-left text-white shadow-sm transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-2",
                            isSelected ? "border-emerald-400/60 shadow-emerald-500/20" : "border-white/10 group-hover:-translate-y-1",
                          )}
                          disabled={disabled || loading}
                          onClick={() => {
                            setSelectedProfileId((current) => (current === contact.profileId ? null : contact.profileId));
                          }}
                          style={{
                            backfaceVisibility: "hidden",
                            pointerEvents: isSelected ? "none" : "auto",
                          }}
                        >
                          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                            <Avatar className="h-20 w-20 border border-white/10">
                              <AvatarImage src={contact.avatarUrl ?? undefined} alt={contact.fullName ?? contact.email ?? "Family member"} />
                              <AvatarFallback className="bg-white/10 text-lg text-white">
                                {getInitials(contact.fullName, contact.email)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="space-y-2">
                              <p className="text-lg font-semibold">{contact.fullName ?? contact.email ?? "Family member"}</p>
                              <div className="flex flex-wrap items-center justify-center gap-2">
                                <Badge variant="secondary" className="bg-white/10 text-slate-200">
                                  {CALL_ROLE_LABELS[contact.role]}
                                </Badge>
                                {contact.relationshipLabel && (
                                  <Badge variant="secondary" className="bg-white/10 text-slate-200">
                                    {contact.relationshipLabel}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <p className="text-xs text-slate-300">Tap to choose {contact.fullName?.split(" ")[0] ?? "this contact"}.</p>
                          </div>
                        </button>

                        <div
                          className="absolute inset-0 rounded-3xl border border-emerald-400/60 bg-gradient-to-br from-emerald-600 to-emerald-500 p-5 text-white shadow-lg shadow-emerald-500/20"
                          style={{
                            backfaceVisibility: "hidden",
                            pointerEvents: isSelected ? "auto" : "none",
                            transform: "rotateY(180deg)",
                          }}
                        >
                          <div className="flex h-full flex-col items-center justify-between text-center">
                            <div className="space-y-2">
                              <p className="text-xs uppercase tracking-[0.3em] text-emerald-50/80">Ready to call</p>
                              <p className="text-xl font-semibold">{contact.fullName ?? contact.email ?? "Family member"}</p>
                              <p className="text-sm text-emerald-50/90">
                                Pick audio or video. The thread record will note who started the call.
                              </p>
                            </div>

                            <div className="grid w-full grid-cols-2 gap-3">
                              <Button
                                type="button"
                                className="h-12 rounded-2xl border border-white/20 bg-white/15 text-white hover:bg-white/20"
                                disabled={disabled || loading || Boolean(pendingKey)}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleStartCall(contact, "audio");
                                }}
                              >
                                {pendingKey === audioKey ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <Phone className="mr-2 h-4 w-4" />
                                    Audio
                                  </>
                                )}
                              </Button>
                              {canUseVideoCall(contact.allowedCallMode) ? (
                                <Button
                                  type="button"
                                  className="h-12 rounded-2xl border border-white/20 bg-slate-950/25 text-white hover:bg-slate-950/35"
                                  disabled={disabled || loading || Boolean(pendingKey)}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleStartCall(contact, "video");
                                  }}
                                >
                                  {pendingKey === videoKey ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <Video className="mr-2 h-4 w-4" />
                                      Video
                                    </>
                                  )}
                                </Button>
                              ) : (
                                <div className="flex items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-sm text-white/90">
                                  Audio only
                                </div>
                              )}
                            </div>

                            <Button
                              type="button"
                              variant="ghost"
                              className="rounded-full px-3 text-emerald-50 hover:bg-white/10 hover:text-white"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedProfileId(null);
                              }}
                            >
                              Back to contacts
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center">
              <p className="text-sm font-medium text-foreground">No callable family members available yet.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Link your co-parent or approved third-party members first, then come back here to start a call.
              </p>
            </div>
          )
        ) : (
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <p className="text-sm text-muted-foreground">
              Open the caller to choose from everyone in the current family who can receive an audio or video call.
            </p>
            {selectedContact && (
              <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-100">
                Last selected: <span className="font-medium">{selectedContact.fullName ?? selectedContact.email ?? "Family member"}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};
