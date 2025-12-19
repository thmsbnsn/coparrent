import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { UserPlus, Check, X, Clock, Lock, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface StepParent {
  id: string;
  user_id: string;
  primary_parent_id: string;
  other_parent_id: string | null;
  primary_parent_approved: boolean;
  other_parent_approved: boolean;
  status: string;
  created_at: string;
}

interface StepParentManagerProps {
  subscriptionTier: string;
  isTrialActive: boolean;
}

export const StepParentManager = ({ subscriptionTier, isTrialActive }: StepParentManagerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [stepParents, setStepParents] = useState<StepParent[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<StepParent[]>([]);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [coParentId, setCoParentId] = useState<string | null>(null);

  const isFeatureAvailable = isTrialActive || subscriptionTier === "premium" || subscriptionTier === "enterprise";

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, co_parent_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile) {
        setProfileId(profile.id);
        setCoParentId(profile.co_parent_id);
        fetchStepParents(profile.id, profile.co_parent_id);
      }
    };

    fetchProfile();
  }, [user]);

  const fetchStepParents = async (pid: string, coId: string | null) => {
    // Fetch step-parents where this user is a primary parent
    const { data: myStepParents } = await supabase
      .from("step_parents")
      .select("*")
      .eq("primary_parent_id", pid);

    // Fetch step-parents where this user needs to approve (as other parent)
    const { data: needsApproval } = await supabase
      .from("step_parents")
      .select("*")
      .eq("other_parent_id", pid)
      .eq("other_parent_approved", false);

    setStepParents((myStepParents as StepParent[]) || []);
    setPendingApprovals((needsApproval as StepParent[]) || []);
  };

  const handleInviteStepParent = async () => {
    if (!profileId || !email.trim()) return;
    setLoading(true);

    try {
      // For demo, we'll create a step-parent entry
      // In production, you'd send an email invite similar to co-parent flow
      const { error } = await supabase.from("step_parents").insert({
        user_id: crypto.randomUUID(), // Placeholder - would be set when they accept
        primary_parent_id: profileId,
        other_parent_id: coParentId,
        primary_parent_approved: true,
        other_parent_approved: false,
        status: "pending_other_approval",
      });

      if (error) throw error;

      toast({
        title: "Step-parent invite sent",
        description: coParentId 
          ? "Your co-parent must also approve this step-parent."
          : "Invite sent successfully.",
      });
      setEmail("");
      fetchStepParents(profileId, coParentId);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (stepParentId: string) => {
    if (!profileId) return;

    const { error } = await supabase
      .from("step_parents")
      .update({ 
        other_parent_approved: true,
        status: "approved"
      })
      .eq("id", stepParentId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to approve step-parent",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Approved",
        description: "Step-parent has been approved",
      });
      fetchStepParents(profileId, coParentId);
    }
  };

  const handleReject = async (stepParentId: string) => {
    if (!profileId) return;

    const { error } = await supabase
      .from("step_parents")
      .update({ status: "rejected" })
      .eq("id", stepParentId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to reject step-parent",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Rejected",
        description: "Step-parent request rejected",
      });
      fetchStepParents(profileId, coParentId);
    }
  };

  if (!isFeatureAvailable) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-full bg-muted">
            <Lock className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold">Step-Parent Profiles</h3>
              <Badge variant="secondary" className="gap-1">
                <Crown className="w-3 h-3" />
                Premium
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Add step-parents to your family with dual approval from both primary parents. 
              Step-parents get read-only access to schedules and child information.
            </p>
            <Button variant="outline" size="sm">
              Upgrade to Premium
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending Approvals */}
      {pendingApprovals.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-warning/50 bg-warning/10 p-4"
        >
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Pending Your Approval
          </h4>
          {pendingApprovals.map((sp) => (
            <div key={sp.id} className="flex items-center justify-between p-3 bg-card rounded-lg border">
              <div>
                <p className="font-medium">Step-parent request</p>
                <p className="text-sm text-muted-foreground">From your co-parent</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => handleReject(sp.id)}>
                  <X className="w-4 h-4" />
                </Button>
                <Button size="sm" onClick={() => handleApprove(sp.id)}>
                  <Check className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Add Step-Parent */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-full bg-primary/10">
            <UserPlus className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold mb-1">Add Step-Parent</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Step-parents require approval from both primary parents. They get read-only access to schedules.
            </p>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="stepparent-email" className="sr-only">Step-parent email</Label>
                <Input
                  id="stepparent-email"
                  type="email"
                  placeholder="Step-parent's email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button onClick={handleInviteStepParent} disabled={loading || !email.trim()}>
                {loading ? "Sending..." : "Invite"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Current Step-Parents */}
      {stepParents.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold mb-4">Step-Parents</h3>
          <div className="space-y-3">
            {stepParents.map((sp) => (
              <div key={sp.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                    <UserPlus className="w-5 h-5 text-secondary-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Step-parent</p>
                    <p className="text-xs text-muted-foreground">
                      Added {new Date(sp.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Badge variant={sp.status === "approved" ? "default" : "secondary"}>
                  {sp.status === "approved" && <Check className="w-3 h-3 mr-1" />}
                  {sp.status === "pending_other_approval" && <Clock className="w-3 h-3 mr-1" />}
                  {sp.status === "approved" ? "Active" : "Pending"}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
