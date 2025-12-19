import { useState } from "react";
import { Mail, Send, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

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
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
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
      // Create invitation in database
      const { data: invitation, error: insertError } = await supabase
        .from("invitations")
        .insert({
          inviter_id: profileId,
          invitee_email: email.toLowerCase().trim(),
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
    } catch (error: any) {
      console.error("Error sending invitation:", error);
      toast({
        title: "Failed to send invitation",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
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

  const pendingInvitations = existingInvitations.filter(i => i.status === "pending");

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
              {existingInvitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div>
                    <p className="text-sm font-medium">{invitation.invitee_email}</p>
                    <p className="text-xs text-muted-foreground">
                      Sent {format(new Date(invitation.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                  {getStatusBadge(invitation.status)}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
