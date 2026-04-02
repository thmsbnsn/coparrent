import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFamilyRole } from "@/hooks/useFamilyRole";
import type { ChildCallMode } from "@/lib/kidsPortal";
import type { MemberRole } from "@/lib/calls";

export interface CallableFamilyMember {
  allowedCallMode: ChildCallMode;
  avatarUrl: string | null;
  email: string | null;
  fullName: string | null;
  membershipId: string;
  profileId: string;
  relationshipLabel: string | null;
  role: MemberRole;
}

interface FamilyMemberRow {
  allowed_call_mode: ChildCallMode | null;
  avatar_url: string | null;
  email: string | null;
  full_name: string | null;
  membership_id: string;
  profile_id: string;
  relationship_label: string | null;
  role: MemberRole;
}

const formatRelationshipLabel = (relationshipLabel: string | null, role: MemberRole) => {
  const cleaned = relationshipLabel?.trim();
  if (cleaned) {
    return cleaned
      .split(/[_\-\s]+/)
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" ");
  }

  switch (role) {
    case "child":
      return "Child";
    case "guardian":
      return "Guardian";
    case "third_party":
      return "Third-Party Member";
    default:
      return "Parent";
  }
};

export const useCallableFamilyMembers = () => {
  const { activeFamilyId, profileId } = useFamilyRole();
  const [members, setMembers] = useState<CallableFamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [scopeError, setScopeError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!activeFamilyId || !profileId) {
      setMembers([]);
      setScopeError("An active family is required before loading callable family members.");
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .rpc("get_callable_family_members", {
        p_family_id: activeFamilyId,
      })
      .returns<FamilyMemberRow[]>();

    if (error) {
      console.error("Error fetching callable family members:", error);
      setMembers([]);
      setScopeError(error.message || "Unable to load callable family members for the active family.");
      setLoading(false);
      return;
    }

    const nextMembers = ((data as FamilyMemberRow[] | null) ?? [])
      .map((row) => ({
        allowedCallMode: row.allowed_call_mode ?? "audio_video",
        avatarUrl: row.avatar_url,
        email: row.email,
        fullName: row.full_name ?? formatRelationshipLabel(row.relationship_label, row.role),
        membershipId: row.membership_id,
        profileId: row.profile_id,
        relationshipLabel: row.relationship_label ?? null,
        role: row.role,
      }))
      .sort((left, right) => {
        const leftName = (left.fullName ?? left.email ?? "").toLowerCase();
        const rightName = (right.fullName ?? right.email ?? "").toLowerCase();
        return leftName.localeCompare(rightName);
      });

    setMembers(nextMembers);
    setScopeError(null);
    setLoading(false);
  }, [activeFamilyId, profileId]);

  useEffect(() => {
    void fetchMembers();
  }, [fetchMembers]);

  return {
    loading,
    members,
    refresh: fetchMembers,
    scopeError,
  };
};
