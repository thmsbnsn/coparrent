import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, Loader2, UserPlus } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getInvitationViewStatus, hasInviteEmailMismatch } from "@/lib/invitations";

interface InvitationData {
  id: string;
  inviter_id: string;
  invitee_email: string;
  status: string;
  expires_at: string;
  created_at: string;
  inviter_name: string | null;
  inviter_email: string | null;
  family_id?: string | null;
  invitation_type?: string;
  role?: string;
}

interface InviteAcceptResult {
  success: boolean;
  error?: string;
  code?: string;
}

const AcceptInvite = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<"loading" | "valid" | "invalid" | "expired" | "accepted" | "wrong_email">("loading");
  const [inviterName, setInviterName] = useState<string>("");
  const [inviteeEmail, setInviteeEmail] = useState<string>("");
  const [invitationType, setInvitationType] = useState<"co_parent" | "third_party">("co_parent");
  const [lookupDegraded, setLookupDegraded] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);

  const token = searchParams.get("token");
  const typeParam = searchParams.get("type");

  const checkInvitation = useCallback(async () => {
    const fallbackToDeferredValidation = () => {
      setInviterName("A family member");
      setInviteeEmail(user?.email || "");
      setInvitationType(typeParam === "third_party" ? "third_party" : "co_parent");
      setLookupDegraded(true);
      setStatus("valid");
    };

    try {
      // Use secure RPC function instead of direct table query
      const { data, error } = await supabase.rpc("get_invitation_by_token", {
        _token: token,
      });

      if (error) {
        console.error("Error checking invitation:", error);
        fallbackToDeferredValidation();
        return;
      }

      if (!data || data.length === 0) {
        setStatus("invalid");
        return;
      }

      const invitation = data[0] as InvitationData;
      const nextStatus = getInvitationViewStatus(
        {
          status: invitation.status,
          expiresAt: invitation.expires_at,
        },
        new Date(),
      );

      if (nextStatus !== "valid") {
        setStatus(nextStatus);
        return;
      }

      setInviterName(invitation.inviter_name || invitation.inviter_email || "A family member");
      setInviteeEmail(invitation.invitee_email);
      setInvitationType(typeParam === "third_party" ? "third_party" : "co_parent");
      setLookupDegraded(false);
      setStatus("valid");
    } catch (error) {
      console.error("Error checking invitation:", error);
      fallbackToDeferredValidation();
    }
  }, [token, typeParam, user?.email]);

  useEffect(() => {
    if (token) {
      void checkInvitation();
    } else {
      setStatus("invalid");
    }
  }, [checkInvitation, token]);

  const handleInviteAcceptanceFailure = (result: InviteAcceptResult) => {
    if (result.code === "EMAIL_MISMATCH") {
      setStatus("wrong_email");
      toast({
        title: "Email mismatch",
        description: result.error || "This invitation was sent to a different email address",
        variant: "destructive",
      });
      return true;
    }

    if (result.code === "FAMILY_ID_REQUIRED") {
      toast({
        title: "Invitation setup incomplete",
        description: "This invitation is missing its family scope. Ask the sender to create a new invitation.",
        variant: "destructive",
      });
      return true;
    }

    return false;
  };

  const handleAcceptInvitation = async () => {
    if (!user) {
      // Store token in sessionStorage (more secure than localStorage, clears on tab close)
      sessionStorage.setItem("pendingInviteToken", token || "");
      navigate("/signup");
      return;
    }

    setIsAccepting(true);

    try {
      if (invitationType === "third_party") {
        const { data, error } = await supabase.rpc("accept_third_party_invitation", {
          _token: token,
          _acceptor_user_id: user.id,
        });

        if (error) {
          throw new Error("Failed to accept invitation");
        }

        const result = data as InviteAcceptResult;

        if (!result.success) {
          if (handleInviteAcceptanceFailure(result)) {
            return;
          }

          throw new Error(result.error || "Failed to join family");
        }

        const { data: invitationData } = await supabase.rpc("get_invitation_by_token", {
          _token: token,
        });
        const invitation = invitationData?.[0] as InvitationData | undefined;

        if (invitation && hasInviteEmailMismatch(invitation.invitee_email, user.email)) {
          setStatus("wrong_email");
          toast({
            title: "Email mismatch",
            description: "This invitation was sent to a different email address",
            variant: "destructive",
          });
          return;
        }

        sessionStorage.removeItem("pendingInviteToken");
        localStorage.removeItem("pendingInviteToken");

        toast({
          title: "Successfully joined!",
          description: "You're now part of the family group.",
        });

        navigate("/dashboard");
      } else {
        // Handle co-parent invitation (existing logic)
        const { data, error } = await supabase.rpc("accept_coparent_invitation", {
          _token: token,
          _acceptor_user_id: user.id,
        });

        if (error) {
          throw new Error("Failed to accept invitation");
        }

        const result = data as InviteAcceptResult;

        if (!result.success) {
          if (handleInviteAcceptanceFailure(result)) {
            return;
          }

          throw new Error(result.error || "Failed to accept invitation");
        }

        sessionStorage.removeItem("pendingInviteToken");
        localStorage.removeItem("pendingInviteToken");

        toast({
          title: "Successfully linked!",
          description: "You're now connected with your co-parent. Your 7-day free trial has started!",
        });

        navigate("/dashboard");
      }
    } catch (error: unknown) {
      console.error("Error accepting invitation:", error);
      toast({
        title: "Failed to accept invitation",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAccepting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Logo size="lg" className="justify-center" />
        </div>

        <Card>
          <CardHeader className="text-center">
            {status === "loading" && (
              <>
                <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
                <CardTitle>Checking invitation...</CardTitle>
              </>
            )}

            {status === "valid" && (
              <>
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <UserPlus className="w-8 h-8 text-primary" />
                </div>
                <CardTitle>
                  {invitationType === "third_party" ? "Family Invitation" : "Co-Parent Invitation"}
                </CardTitle>
                <CardDescription>
                  {inviterName} has invited you to {invitationType === "third_party" ? "join their family on" : "co-parent on"} CoParrent
                </CardDescription>
                {lookupDegraded ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Invite details could not be loaded up front. Sign in to validate and continue.
                  </p>
                ) : null}
              </>
            )}

            {status === "invalid" && (
              <>
                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                  <XCircle className="w-8 h-8 text-destructive" />
                </div>
                <CardTitle>Invalid Invitation</CardTitle>
                <CardDescription>
                  This invitation link is invalid or has already been used.
                </CardDescription>
              </>
            )}

            {status === "expired" && (
              <>
                <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-4">
                  <XCircle className="w-8 h-8 text-warning" />
                </div>
                <CardTitle>Invitation Expired</CardTitle>
                <CardDescription>
                  This invitation has expired. Please ask your co-parent to send a new one.
                </CardDescription>
              </>
            )}

            {status === "accepted" && (
              <>
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
                <CardTitle>Already Accepted</CardTitle>
                <CardDescription>
                  This invitation has already been accepted.
                </CardDescription>
              </>
            )}

            {status === "wrong_email" && (
              <>
                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                  <XCircle className="w-8 h-8 text-destructive" />
                </div>
                <CardTitle>Wrong Account</CardTitle>
                <CardDescription>
                  This invitation was sent to {inviteeEmail}. Please sign in with that email address to accept.
                </CardDescription>
              </>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            {status === "valid" && (
              <>
                <div className="p-4 rounded-lg bg-muted text-center">
                  <p className="text-sm text-muted-foreground mb-2">
                    {invitationType === "third_party" 
                      ? "As a family member, you'll get:"
                      : "By accepting, you'll get:"}
                  </p>
                  <ul className="text-sm space-y-1">
                    {invitationType === "third_party" ? (
                      <>
                        <li>✓ Family messaging hub access</li>
                        <li>✓ View children's calendar (read-only)</li>
                        <li>✓ Private journaling</li>
                        <li>✓ Law library & blog access</li>
                      </>
                    ) : (
                      <>
                        <li>✓ Shared custody calendar</li>
                        <li>✓ Court-friendly messaging</li>
                        <li>✓ Child information hub</li>
                        <li>✓ 7-day free trial</li>
                      </>
                    )}
                  </ul>
                </div>

                <Button 
                  onClick={handleAcceptInvitation} 
                  className="w-full"
                  disabled={isAccepting}
                >
                  {isAccepting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  {user 
                    ? (invitationType === "third_party" ? "Accept & Join Family" : "Accept & Link Accounts")
                    : "Create Account to Accept"}
                </Button>

                {!user && (
                  <p className="text-xs text-center text-muted-foreground">
                    Already have an account?{" "}
                    <Button 
                      variant="link" 
                      className="p-0 h-auto"
                      onClick={() => {
                        sessionStorage.setItem("pendingInviteToken", token || "");
                        navigate("/login");
                      }}
                    >
                      Sign in
                    </Button>
                  </p>
                )}
              </>
            )}

            {status === "wrong_email" && (
              <Button 
                onClick={() => {
                  sessionStorage.setItem("pendingInviteToken", token || "");
                  navigate("/login");
                }}
                className="w-full"
              >
                Sign in with different account
              </Button>
            )}

            {(status === "invalid" || status === "expired" || status === "accepted") && (
              <Button 
                onClick={() => navigate("/")} 
                variant="outline"
                className="w-full"
              >
                Go to Homepage
              </Button>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default AcceptInvite;
