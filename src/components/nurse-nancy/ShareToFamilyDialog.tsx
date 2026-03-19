import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Send, Users, MessageCircle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useFamilyRole } from "@/hooks/useFamilyRole";
import { sanitizeErrorForUser } from "@/lib/errorMessages";

interface FamilyMember {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

interface FamilyMemberRow {
  profile_id: string;
  profiles: FamilyMember | FamilyMember[] | null;
}

interface ShareToFamilyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messageContent: string;
  onSuccess?: () => void;
}

export function ShareToFamilyDialog({
  open,
  onOpenChange,
  messageContent,
  onSuccess,
}: ShareToFamilyDialogProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profileId, primaryParentId } = useFamilyRole();
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [customMessage, setCustomMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // Fetch family members when dialog opens
  useEffect(() => {
    const fetchFamilyMembers = async () => {
      if (!open || !profileId || !primaryParentId) return;

      setLoading(true);
      try {
        // Get co-parent
        const { data: myProfile } = await supabase
          .from("profiles")
          .select("co_parent_id")
          .eq("id", profileId)
          .single();

        const memberIds = new Set<string>();
        const members: FamilyMember[] = [];

        // Add co-parent if exists
        if (myProfile?.co_parent_id) {
          const { data: coParent } = await supabase
            .from("profiles")
            .select("id, full_name, email, avatar_url")
            .eq("id", myProfile.co_parent_id)
            .single();

          if (coParent && coParent.id !== profileId) {
            memberIds.add(coParent.id);
            members.push(coParent);
          }
        }

        // Get family members (step-parents, third-party)
        const { data: familyData } = await supabase
          .from("family_members")
          .select("profile_id, profiles:profile_id(id, full_name, email, avatar_url)")
          .eq("primary_parent_id", primaryParentId)
          .eq("status", "active");

        if (familyData) {
          for (const fm of familyData as FamilyMemberRow[]) {
            const profile = Array.isArray(fm.profiles) ? fm.profiles[0] ?? null : fm.profiles;
            if (profile && profile.id !== profileId && !memberIds.has(profile.id)) {
              memberIds.add(profile.id);
              members.push(profile);
            }
          }
        }

        setFamilyMembers(members);
        if (members.length > 0 && !selectedMemberId) {
          setSelectedMemberId(members[0].id);
        }
      } catch (error) {
        console.error("Error fetching family members:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFamilyMembers();
  }, [open, profileId, primaryParentId, selectedMemberId]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setCustomMessage("");
    }
  }, [open]);

  const handleShare = async () => {
    if (!selectedMemberId || !profileId) return;

    setSending(true);
    try {
      // Create or get DM thread via edge function
      const { data: threadData, error: threadError } = await supabase.functions.invoke(
        "create-message-thread",
        {
          body: {
            thread_type: "direct_message",
            other_profile_id: selectedMemberId,
          },
        }
      );

      if (threadError || !threadData?.success) {
        throw new Error(threadData?.error || "Failed to create conversation");
      }

      const threadId = threadData.thread.id;

      // Get role for the message
      const { data: roleData } = await supabase.rpc("get_user_family_role", {
        _user_id: (await supabase.auth.getUser()).data.user?.id,
      });

      const senderRole = roleData || "parent";

      // Compose the message
      const fullMessage = customMessage.trim()
        ? `${customMessage.trim()}\n\n---\n\n**From Nurse Nancy:**\n${messageContent}`
        : `**From Nurse Nancy:**\n${messageContent}`;

      // Send the message
      const { error: messageError } = await supabase.from("thread_messages").insert({
        thread_id: threadId,
        sender_id: profileId,
        sender_role: senderRole,
        content: fullMessage,
      });

      if (messageError) throw messageError;

      toast({
        title: "Shared successfully",
        description: "The Nurse Nancy response has been sent to your family member.",
      });

      onOpenChange(false);
      onSuccess?.();

      // Optionally navigate to the conversation
      const selectedMember = familyMembers.find(m => m.id === selectedMemberId);
      const goToChat = window.confirm(
        `Message sent to ${selectedMember?.full_name || "family member"}. Would you like to view the conversation?`
      );
      
      if (goToChat) {
        navigate("/dashboard/messages");
      }
    } catch (error) {
      console.error("Error sharing message:", error);
      toast({
        title: "Error",
        description: sanitizeErrorForUser(error),
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const getInitials = (name: string | null, email: string | null) => {
    if (name) {
      return name
        .split(" ")
        .map(n => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email?.[0]?.toUpperCase() || "?";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Share with Family
          </DialogTitle>
          <DialogDescription>
            Send this Nurse Nancy response to a family member
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : familyMembers.length === 0 ? (
          <div className="text-center py-8">
            <MessageCircle className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No family members found. Invite a co-parent or family member first.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Family member selection */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Send to:</Label>
              <ScrollArea className="h-32 border rounded-lg p-2">
                <RadioGroup
                  value={selectedMemberId}
                  onValueChange={setSelectedMemberId}
                  className="space-y-2"
                >
                  {familyMembers.map(member => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
                      onClick={() => setSelectedMemberId(member.id)}
                    >
                      <RadioGroupItem value={member.id} id={member.id} />
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {getInitials(member.full_name, member.email)}
                        </AvatarFallback>
                      </Avatar>
                      <Label htmlFor={member.id} className="cursor-pointer flex-1">
                        <span className="font-medium">
                          {member.full_name || member.email || "Family member"}
                        </span>
                        {member.full_name && member.email && (
                          <span className="text-xs text-muted-foreground block">
                            {member.email}
                          </span>
                        )}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </ScrollArea>
            </div>

            {/* Preview of what will be shared */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Message preview:</Label>
              <div className="border rounded-lg p-3 bg-muted/50 text-sm max-h-24 overflow-y-auto">
                <p className="text-muted-foreground whitespace-pre-wrap line-clamp-3">
                  {messageContent.slice(0, 150)}
                  {messageContent.length > 150 ? "..." : ""}
                </p>
              </div>
            </div>

            {/* Optional custom message */}
            <div>
              <Label htmlFor="custom-message" className="text-sm font-medium mb-2 block">
                Add a note (optional):
              </Label>
              <Textarea
                id="custom-message"
                value={customMessage}
                onChange={e => setCustomMessage(e.target.value)}
                placeholder="Add context or a personal note..."
                className="resize-none h-20"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button
            onClick={handleShare}
            disabled={!selectedMemberId || sending || familyMembers.length === 0}
            className="gap-2"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Share
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
