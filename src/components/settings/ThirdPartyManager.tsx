import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { UserPlus, Check, X, Clock, Lock, Crown, Mail, Users2, ChevronDown } from "lucide-react";
import type { Database } from "@/integrations-supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useFamily } from "@/contexts/FamilyContext";
import { fetchFamilyChildIds, ensureFamilyChildLinksSynced } from "@/lib/familyScope";
import { useNavigate } from "react-router-dom";

type MemberRole = Database["public"]["Enums"]["member_role"];

interface ThirdPartyMemberRow {
  id: string;
  family_id: string;
  profile_id: string | null;
  relationship_label: string | null;
  role: MemberRole;
  status: string;
  created_at: string;
  profiles?: {
    full_name: string | null;
    email: string | null;
  } | {
    full_name: string | null;
    email: string | null;
  }[] | null;
}

interface ThirdPartyInvitationRow {
  id: string;
  family_id: string | null;
  invitee_email: string;
  relationship: string | null;
  status: string;
  created_at: string;
}

interface ThirdPartyListItem {
  id: string;
  createdAt: string;
  displayName: string | null;
  email: string | null;
  relationshipLabel: string | null;
  source: "membership" | "invitation";
  status: "active" | "invited";
}

interface Child {
  id: string;
  name: string;
}

interface ThirdPartyInviteRpcResult {
  ok: boolean;
  code?: string;
  message?: string;
  data?: {
    token?: string | null;
  } | null;
}

interface InviterProfile {
  email: string | null;
  full_name: string | null;
}

interface ThirdPartyManagerProps {
  subscriptionTier: string;
  isTrialActive: boolean;
}

const RELATIONSHIP_OPTIONS = [
  { value: "step_parent", label: "Step-Parent" },
  { value: "grandparent", label: "Grandparent" },
  { value: "aunt_uncle", label: "Aunt/Uncle" },
  { value: "sibling", label: "Sibling" },
  { value: "babysitter", label: "Babysitter/Nanny" },
  { value: "family_friend", label: "Family Friend" },
  { value: "therapist", label: "Therapist/Counselor" },
  { value: "other", label: "Other" },
];

const PLAN_LIMITS: Record<string, number> = {
  free: 4,
  power: 6,
  premium: 6,
  mvp: 6,
};

const getProfileRecord = (profiles: ThirdPartyMemberRow["profiles"]) =>
  Array.isArray(profiles) ? profiles[0] ?? null : profiles ?? null;

const buildThirdPartyList = (
  members: ThirdPartyMemberRow[],
  invitations: ThirdPartyInvitationRow[],
): ThirdPartyListItem[] => [
  ...members.map((member) => {
    const profileRecord = getProfileRecord(member.profiles);

    return {
      id: member.id,
      createdAt: member.created_at,
      displayName: profileRecord?.full_name ?? profileRecord?.email ?? null,
      email: profileRecord?.email ?? null,
      relationshipLabel: member.relationship_label ?? null,
      source: "membership" as const,
      status: "active" as const,
    };
  }),
  ...invitations.map((invitation) => ({
    id: invitation.id,
    createdAt: invitation.created_at,
    displayName: invitation.invitee_email,
    email: invitation.invitee_email,
    relationshipLabel: invitation.relationship ?? null,
    source: "invitation" as const,
    status: "invited" as const,
  })),
].sort((left, right) => right.createdAt.localeCompare(left.createdAt));

export const ThirdPartyManager = ({ subscriptionTier, isTrialActive }: ThirdPartyManagerProps) => {
  const { activeFamilyId, profileId, loading: familyLoading } = useFamily();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [relationship, setRelationship] = useState("");
  const [selectedChildren, setSelectedChildren] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<ThirdPartyListItem[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const tier = subscriptionTier || "free";
  const limit = PLAN_LIMITS[tier] || 0;
  const currentCount = members.length;
  const canAddMore = Boolean(activeFamilyId) && (isTrialActive || currentCount < limit);
  const isFeatureAvailable = isTrialActive || tier !== "free";

  const refreshFamilyScopedData = useCallback(async () => {
    if (familyLoading) {
      return;
    }

    if (!activeFamilyId || !profileId) {
      setMembers([]);
      setChildren([]);
      setSelectedChildren([]);
      return;
    }

    try {
      await ensureFamilyChildLinksSynced(activeFamilyId);

      const [memberResult, invitationResult, childIds] = await Promise.all([
        supabase
          .from("family_members")
          .select(`
            id,
            family_id,
            profile_id,
            relationship_label,
            role,
            status,
            created_at,
            profiles:profile_id(full_name, email)
          `)
          .eq("family_id", activeFamilyId)
          .eq("role", "third_party")
          .eq("status", "active")
          .order("created_at", { ascending: false }),
        supabase
          .from("invitations")
          .select("id, family_id, invitee_email, relationship, status, created_at")
          .eq("family_id", activeFamilyId)
          .eq("inviter_id", profileId)
          .eq("invitation_type", "third_party")
          .eq("status", "pending")
          .order("created_at", { ascending: false }),
        fetchFamilyChildIds(activeFamilyId),
      ]);

      if (memberResult.error) {
        throw memberResult.error;
      }

      if (invitationResult.error) {
        throw invitationResult.error;
      }

      let nextChildren: Child[] = [];
      if (childIds.length > 0) {
        const { data: childData, error: childError } = await supabase
          .from("children")
          .select("id, name")
          .in("id", childIds)
          .order("name");

        if (childError) {
          throw childError;
        }

        nextChildren = (childData as Child[] | null) ?? [];
      }

      setMembers(
        buildThirdPartyList(
          (memberResult.data as ThirdPartyMemberRow[] | null) ?? [],
          (invitationResult.data as ThirdPartyInvitationRow[] | null) ?? [],
        ),
      );
      setChildren(nextChildren);
      setSelectedChildren(nextChildren.map((child) => child.id));
    } catch (error) {
      console.error("Error loading third-party access:", error);
      setMembers([]);
      setChildren([]);
      setSelectedChildren([]);
      toast({
        title: "Error",
        description: "Failed to load third-party access for the active family.",
        variant: "destructive",
      });
    }
  }, [activeFamilyId, familyLoading, profileId, toast]);

  useEffect(() => {
    void refreshFamilyScopedData();
  }, [refreshFamilyScopedData]);

  const toggleChild = (childId: string) => {
    setSelectedChildren((prev) =>
      prev.includes(childId)
        ? prev.filter((id) => id !== childId)
        : [...prev, childId],
    );
  };

  const handleInviteThirdParty = async () => {
    if (!profileId || !activeFamilyId || !email.trim()) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    if (!relationship) {
      toast({
        title: "Relationship required",
        description: "Please select the relationship to your family",
        variant: "destructive",
      });
      return;
    }

    if (selectedChildren.length === 0) {
      toast({
        title: "Select children",
        description: "Please select at least one child this person will have access to",
        variant: "destructive",
      });
      return;
    }

    if (!canAddMore) {
      toast({
        title: "Limit reached",
        description: `Your ${tier} plan allows up to ${limit} third-party members. Upgrade to add more.`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: rpcResult, error: rpcError } = await supabase.rpc("rpc_create_third_party_invite", {
        p_family_id: activeFamilyId,
        p_invitee_email: email.trim().toLowerCase(),
        p_relationship: relationship,
        p_child_ids: selectedChildren,
      });

      if (rpcError) throw rpcError;

      const result = rpcResult as ThirdPartyInviteRpcResult;

      if (!result.ok) {
        if (result.code === "LIMIT_REACHED") {
          toast({
            title: "Plan Limit Reached",
            description: result.message || "Upgrade to Power to invite more members.",
            variant: "destructive",
          });
          return;
        }
        throw new Error(result.message || "Failed to create invitation");
      }

      const invitationToken = result.data?.token;
      if (!invitationToken) {
        throw new Error("Invitation created without a token.");
      }

      const { data: inviterProfile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", profileId)
        .single();

      const inviterRecord = inviterProfile as InviterProfile | null;
      const inviterName = inviterRecord?.full_name || inviterRecord?.email || "A family member";

      const { error: emailError } = await supabase.functions.invoke("send-third-party-invite", {
        body: {
          inviteeEmail: email.trim().toLowerCase(),
          inviterName,
          token: invitationToken,
          relationship: RELATIONSHIP_OPTIONS.find((option) => option.value === relationship)?.label || relationship,
        },
      });

      if (emailError) {
        console.error("Email error:", emailError);
      }

      toast({
        title: "Invitation sent",
        description: `An invitation has been sent to ${email}`,
      });

      setEmail("");
      setRelationship("");
      setShowAdvanced(false);
      await refreshFamilyScopedData();
    } catch (error: unknown) {
      console.error("Error inviting third-party:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send invitation",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (member: ThirdPartyListItem) => {
    if (!activeFamilyId) return;
    if (member.source === "invitation" && !profileId) return;

    const updateResult = member.source === "membership"
      ? await supabase
          .from("family_members")
          .update({ status: "removed" })
          .eq("id", member.id)
          .eq("family_id", activeFamilyId)
          .eq("role", "third_party")
      : await supabase
          .from("invitations")
          .update({
            status: "cancelled",
            updated_at: new Date().toISOString(),
          })
          .eq("id", member.id)
          .eq("family_id", activeFamilyId)
          .eq("inviter_id", profileId)
          .eq("invitation_type", "third_party");

    if (updateResult.error) {
      toast({
        title: "Error",
        description: member.source === "membership" ? "Failed to remove member" : "Failed to cancel invitation",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: member.source === "membership" ? "Member removed" : "Invitation cancelled",
      description: member.source === "membership"
        ? "The family member has been removed"
        : "The pending invitation has been cancelled",
    });

    await refreshFamilyScopedData();
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
              <h3 className="font-semibold">Third-Party Access</h3>
              <Badge variant="secondary" className="gap-1">
                <Crown className="w-3 h-3" />
                Pro
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Invite step-parents, grandparents, babysitters, or other trusted adults to your family group.
              They get access to the messaging hub and can view the child calendar.
            </p>
            <Button variant="outline" size="sm" onClick={() => navigate("/pricing")}>
              Upgrade to Pro
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-full bg-primary/10">
            <Users2 className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Third-Party Access</h3>
              <Badge variant="outline">
                {currentCount} / {isTrialActive ? "∞" : limit} members
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Invite step-parents, grandparents, babysitters, or other trusted adults.
              They can message the family and view the child calendar (read-only).
            </p>

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1">
                  <Label htmlFor="thirdparty-email" className="sr-only">
                    Email address
                  </Label>
                  <Input
                    id="thirdparty-email"
                    type="email"
                    placeholder="Enter email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={!canAddMore}
                  />
                </div>
                <Select value={relationship} onValueChange={setRelationship} disabled={!canAddMore}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Relationship" />
                  </SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIP_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
                    <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
                    {showAdvanced ? "Hide options" : "Show child access options"}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                    <Label className="text-sm font-medium">Grant access to:</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {children.map((child) => (
                        <div key={child.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`child-${child.id}`}
                            checked={selectedChildren.includes(child.id)}
                            onCheckedChange={() => toggleChild(child.id)}
                            disabled={!canAddMore}
                          />
                          <label
                            htmlFor={`child-${child.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {child.name}
                          </label>
                        </div>
                      ))}
                    </div>
                    {children.length === 0 && (
                      <p className="text-sm text-muted-foreground">No children added yet.</p>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Button
                onClick={handleInviteThirdParty}
                disabled={loading || !email.trim() || !relationship || !canAddMore}
                className="w-full sm:w-auto"
              >
                <Mail className="w-4 h-4 mr-2" />
                {loading ? "Sending..." : "Send Invitation"}
              </Button>
            </div>

            {!canAddMore && !isTrialActive && (
              <p className="text-sm text-warning mt-2">
                You've reached your plan limit.
                <Button variant="link" className="px-1 h-auto" onClick={() => navigate("/pricing")}>
                  Upgrade
                </Button>
                to add more members.
              </p>
            )}
          </div>
        </div>
      </div>

      {members.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold mb-4">Family Members</h3>
          <div className="space-y-3">
            {members.map((member) => (
              <motion.div
                key={`${member.source}-${member.id}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                    <UserPlus className="w-5 h-5 text-secondary-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">
                      {member.displayName || member.email || "Invited member"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {member.status === "invited" ? "Invitation pending" : "Active member"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={member.status === "active" ? "default" : "secondary"}>
                    {member.status === "active" && <Check className="w-3 h-3 mr-1" />}
                    {member.status === "invited" && <Clock className="w-3 h-3 mr-1" />}
                    {member.status === "active" ? "Active" : "Pending"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      void handleRemoveMember(member);
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
