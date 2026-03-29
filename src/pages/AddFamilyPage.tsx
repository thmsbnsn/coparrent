import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Link2, PlusCircle, Users } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useFamily } from "@/contexts/FamilyContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { parseInviteLink } from "@/lib/inviteLinks";

interface CreateAdditionalFamilyResult {
  success?: boolean;
  error?: string;
  family_id?: string | null;
  display_name?: string | null;
}

const AddFamilyPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { memberships, refresh } = useFamily();
  const { toast } = useToast();
  const [familyName, setFamilyName] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  const nextFamilyLabel = useMemo(() => `Family ${memberships.length + 1}`, [memberships.length]);

  const handleCreateFamily = async () => {
    if (!user) return;

    setCreating(true);
    try {
      const { data, error } = await supabase.rpc("rpc_create_additional_family", {
        p_display_name: familyName.trim() || null,
      });

      if (error) {
        throw error;
      }

      const result = (data ?? {}) as CreateAdditionalFamilyResult;
      if (!result.success || !result.family_id) {
        throw new Error(result.error || "Unable to create a new family workspace.");
      }

      localStorage.setItem(`coparrent.activeFamily.${user.id}`, result.family_id);
      await refresh();

      toast({
        title: "Family workspace created",
        description: `${nextFamilyLabel} is ready. You can start adding children and records in this workspace.`,
      });

      navigate("/dashboard");
    } catch (error) {
      console.error("Error creating additional family:", error);
      toast({
        title: "Unable to create family",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleJoinFamily = async () => {
    setJoining(true);
    try {
      const parsed = parseInviteLink(inviteLink);

      if (!parsed) {
        throw new Error("Paste a valid invite link or invite token.");
      }

      const params = new URLSearchParams({ token: parsed.token });
      if (parsed.type) {
        params.set("type", parsed.type);
      }

      toast({
        title: "Invite detected",
        description: "Review the invitation details before joining the other family workspace.",
      });

      navigate(`/accept-invite?${params.toString()}`);
    } catch (error) {
      toast({
        title: "Invalid invite link",
        description: error instanceof Error ? error.message : "Please check the link and try again.",
        variant: "destructive",
      });
    } finally {
      setJoining(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
          <div>
            <h1 className="text-2xl font-display font-bold lg:text-3xl">Add Family or Connect Another</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Family workspaces stay separate. Switching families changes the records, schedules, messages, and access
              tied to that one family only.
            </p>
          </div>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-2">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <Card className="h-full rounded-2xl">
              <CardHeader>
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <PlusCircle className="h-6 w-6" />
                </div>
                <CardTitle>Create a new family workspace</CardTitle>
                <CardDescription>
                  Use this when you need a separate family workspace with different records and different people.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <p className="text-sm font-medium">{nextFamilyLabel}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    This will become a separate workspace under your account. Other families will not see its data.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="family-name">Family name (optional)</Label>
                  <Input
                    id="family-name"
                    placeholder="Example: Family with Morgan"
                    value={familyName}
                    onChange={(event) => setFamilyName(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    If you leave this blank, CoParrent will create the workspace and you can edit the family label later.
                  </p>
                </div>

                <Button className="w-full" onClick={handleCreateFamily} disabled={creating}>
                  {creating ? "Creating family..." : "Create family workspace"}
                  {!creating && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="h-full rounded-2xl">
              <CardHeader>
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Link2 className="h-6 w-6" />
                </div>
                <CardTitle>Connect with another family</CardTitle>
                <CardDescription>
                  If someone already invited you into a different family workspace, paste that invite link here and
                  continue through the existing acceptance flow.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-link">Invite link or token</Label>
                  <Input
                    id="invite-link"
                    placeholder="Paste the full invite link or just the token"
                    value={inviteLink}
                    onChange={(event) => setInviteLink(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    This is the safest way to join a family that another adult already started.
                  </p>
                </div>

                <Button className="w-full" variant="outline" onClick={handleJoinFamily} disabled={joining}>
                  {joining ? "Checking invite..." : "Open invitation"}
                  {!joining && <Users className="ml-2 h-4 w-4" />}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AddFamilyPage;
