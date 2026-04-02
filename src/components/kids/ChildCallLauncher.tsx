import { useState } from "react";
import { Loader2, Phone, Video } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { canUseVideoCall } from "@/lib/kidsPortal";
import type { CallableFamilyMember } from "@/hooks/useCallableFamilyMembers";

interface ChildCallLauncherProps {
  contacts: CallableFamilyMember[];
  loading?: boolean;
  onStartCall: (contact: CallableFamilyMember, callType: "audio" | "video") => Promise<void> | void;
}

const getInitials = (name: string | null, fallback: string | null) => {
  const value = name?.trim() || fallback?.trim() || "?";
  const parts = value.split(/\s+/);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export const ChildCallLauncher = ({
  contacts,
  loading = false,
  onStartCall,
}: ChildCallLauncherProps) => {
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="rounded-[2rem] border border-border bg-white/80 p-5 shadow-sm">
        <h3 className="text-xl font-display font-semibold">Call someone</h3>
        <div className="mt-4 flex items-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading approved contacts...
        </div>
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <div className="rounded-[2rem] border border-border bg-white/80 p-5 shadow-sm">
        <h3 className="text-xl font-display font-semibold">Calls</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          A parent can add approved calling people from the child settings screen.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[2rem] border border-border bg-white/80 p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-display font-semibold">Call someone</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Tap a face. Only approved family members show up here.
          </p>
        </div>
        <div className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700">
          Safe list
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {contacts.map((contact) => {
          const audioKey = `${contact.profileId}:audio`;
          const videoKey = `${contact.profileId}:video`;

          return (
            <div
              key={contact.profileId}
              className="rounded-[1.75rem] border border-border bg-gradient-to-br from-sky-50 via-white to-emerald-50 p-4"
            >
              <div className="flex flex-col items-center text-center">
                <Avatar className="h-24 w-24 border-4 border-white shadow-sm">
                  <AvatarImage src={contact.avatarUrl ?? undefined} alt={contact.fullName ?? "Family member"} />
                  <AvatarFallback className="bg-slate-900 text-xl text-white">
                    {getInitials(contact.fullName, contact.email)}
                  </AvatarFallback>
                </Avatar>

                <h4 className="mt-4 text-lg font-display font-semibold">
                  {contact.fullName ?? contact.email ?? "Family member"}
                </h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  {contact.relationshipLabel ?? (contact.role === "guardian" ? "Guardian" : contact.role === "third_party" ? "Family helper" : "Parent")}
                </p>

                <div className="mt-4 grid w-full gap-3">
                  <Button
                    type="button"
                    className="h-12 rounded-2xl bg-emerald-500 text-white hover:bg-emerald-400"
                    disabled={loading || Boolean(pendingKey)}
                    onClick={async () => {
                      setPendingKey(audioKey);
                      try {
                        await onStartCall(contact, "audio");
                      } finally {
                        setPendingKey(null);
                      }
                    }}
                  >
                    {pendingKey === audioKey ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Phone className="mr-2 h-4 w-4" />}
                    Audio call
                  </Button>

                  {canUseVideoCall(contact.allowedCallMode) ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 rounded-2xl"
                      disabled={loading || Boolean(pendingKey)}
                      onClick={async () => {
                        setPendingKey(videoKey);
                        try {
                          await onStartCall(contact, "video");
                        } finally {
                          setPendingKey(null);
                        }
                      }}
                    >
                      {pendingKey === videoKey ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Video className="mr-2 h-4 w-4" />}
                      Video call
                    </Button>
                  ) : (
                    <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
                      Audio only
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
