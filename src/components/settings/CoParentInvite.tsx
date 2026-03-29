import { useState } from "react";
import { Mail, Send, Clock, CheckCircle, XCircle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ensureCurrentUserFamilyMembership } from "@/lib/familyMembership";
import { useFamily } from "@/contexts/FamilyContext";

interface Invitation {
  id: string;
  invitee_email: string;
  status: string;
  created_at: string;
  expires_at: string;
  token: string;
}

interface CoParentInviteProps {
  profileId: string;
  inviterName: string;
  existingInvitations: Invitation[];
  onInviteSent: () => void;
}

export const CoParentInvite = ({ 
  profileId, 
  inviterName, 
  existingInvitations, 
  onInviteSent 
}: CoParentInviteProps) => {
  const { activeFamilyId } = useFamily();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast({
        title: "Email required",
        description: "Please enter your co-parent's email address.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const ensuredFamily = activeFamilyId
        ? { familyId: activeFamilyId }
        : await ensureCurrentUserFamilyMembership(inviterName || null);

      if (!ensuredFamily.familyId) {
        throw new Error("Could not determine your family for this invitation.");
      }

      // Create invitation in database
      const { data: invitation, error: insertError } = await supabase
        .from("invitations")
        .insert({
          inviter_id: profileId,
          family_id: ensuredFamily.familyId,
          invitee_email: email.toLowerCase().trim(),
          invitation_type: "co_parent",
          role: "parent",
        })
        .select()
        .single();

      if (insertError) {
        if (insertError.code === "23505") {
          toast({
            title: "Invitation already sent",
            description: "You've already invited this email address.",
            variant: "destructive",
          });
        } else {
          throw insertError;
        }
        return;
      }

      // Send email via edge function
      const { error: emailError } = await supabase.functions.invoke("send-coparent-invite", {
        body: {
          inviteeEmail: email.toLowerCase().trim(),
          inviterName: inviterName || "Your co-parent",
          token: invitation.token,
        },
      });

      if (emailError) {
        console.error("Email error:", emailError);
        // Invitation was created but email failed - still consider it a partial success
        toast({
          title: "Invitation created",
          description: "The invitation was created but the email might not have been sent. You can share the invite link manually.",
        });
      } else {
        toast({
          title: "Invitation sent!",
          description: `An invitation has been sent to ${email}.`,
        });
      }

      setEmail("");
      onInviteSent();
    } catch (error: unknown) {
      console.error("Error sending invitation:", error);
      toast({
        title: "Failed to send invitation",
        description: "Unable to send invitation. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendInvite = async (invitation: Invitation) => {
    setResendingId(invitation.id);

    try {
      // Update the invitation to refresh expiration
      const { error: updateError } = await supabase
        .from("invitations")
        .update({
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
          updated_at: new Date().toISOString(),
        })
        .eq("id", invitation.id);

      if (updateError) throw updateError;

      // Resend email via edge function
      const { error: emailError } = await supabase.functions.invoke("send-coparent-invite", {
        body: {
          inviteeEmail: invitation.invitee_email,
          inviterName: inviterName || "Your co-parent",
          token: invitation.token,
        },
      });

      if (emailError) {
        console.error("Email error:", emailError);
        toast({
          title: "Email may not have been sent",
          description: "The invitation was refreshed but the email might not have been delivered.",
        });
      } else {
        toast({
          title: "Invitation resent!",
          description: `A new invitation email has been sent to ${invitation.invitee_email}.`,
        });
      }

      onInviteSent();
    } catch (error: unknown) {
      console.error("Error resending invitation:", error);
      toast({
        title: "Failed to resend invitation",
        description: "Unable to resend invitation. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setResendingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "accepted":
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Accepted</Badge>;
      case "expired":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Invite Co-Parent
        </CardTitle>
        <CardDescription>
          Send an invitation to your co-parent to start sharing custody schedules and messages.
          You'll both get a 7-day free trial once they accept.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSendInvite} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="coparent-email">Co-parent's email address</Label>
            <div className="flex gap-2">
              <Input
                id="coparent-email"
                type="email"
                placeholder="coparent@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>

        {existingInvitations.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Sent Invitations</h4>
            <div className="space-y-2">
              {existingInvitations.map((invitation) => {
                const expired = invitation.status === "expired" || isExpired(invitation.expires_at);
                const canResend = invitation.status === "pending" || expired;
                
                return (
                  <div
                    key={invitation.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{invitation.invitee_email}</p>
                      <p className="text-xs text-muted-foreground">
                        Sent {format(new Date(invitation.created_at), "MMM d, yyyy")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {canResend && invitation.status !== "accepted" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleResendInvite(invitation)}
                          disabled={resendingId === invitation.id}
                          title="Resend invitation email"
                        >
                          {resendingId === invitation.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                      {expired && invitation.status !== "accepted" ? (
                        <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Expired</Badge>
                      ) : (
                        getStatusBadge(invitation.status)
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
