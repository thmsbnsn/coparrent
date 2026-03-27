import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFamilyRole } from "@/hooks/useFamilyRole";
import { CALLABLE_MEMBER_ROLES, type MemberRole } from "@/lib/calls";

export interface CallableFamilyMember {
  avatarUrl: string | null;
  email: string | null;
  fullName: string | null;
  membershipId: string;
  profileId: string;
  relationshipLabel: string | null;
  role: MemberRole;
}

interface FamilyMemberRow {
  avatar_url?: string | null;
  email?: string | null;
  full_name?: string | null;
  id?: string;
  membership_id?: string;
  profile_id: string;
  profiles?: {
    avatar_url: string | null;
    email: string | null;
    full_name: string | null;
  } | null;
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

  const fetchMembers = useCallback(async () => {
    if (!activeFamilyId || !profileId) {
      setMembers([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .rpc("get_callable_family_members", {
        p_family_id: activeFamilyId,
      })
      .returns<FamilyMemberRow[]>();

    let sourceRows = (data as FamilyMemberRow[] | null) ?? [];

    if (error) {
      console.warn("RPC callable family member lookup failed, falling back to direct family_members query:", error);

      const fallbackResult = await supabase
        .from("family_members")
        .select(`
          id,
          profile_id,
          relationship_label,
          role,
          profiles!family_members_profile_id_fkey (
            full_name,
            email,
            avatar_url
          )
        `)
        .eq("family_id", activeFamilyId)
        .eq("status", "active")
        .in("role", [...CALLABLE_MEMBER_ROLES])
        .neq("profile_id", profileId);

      if (fallbackResult.error) {
        console.error("Error fetching callable family members:", fallbackResult.error);
        setMembers([]);
        setLoading(false);
        return;
      }

      sourceRows = (fallbackResult.data as FamilyMemberRow[] | null) ?? [];
    }

    const nextMembers = sourceRows
      .map((row) => ({
        avatarUrl: row.avatar_url ?? row.profiles?.avatar_url ?? null,
        email: row.email ?? row.profiles?.email ?? null,
        fullName:
          row.full_name ??
          row.profiles?.full_name ??
          formatRelationshipLabel(row.relationship_label, row.role),
        membershipId: row.membership_id ?? row.id ?? row.profile_id,
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
    setLoading(false);
  }, [activeFamilyId, profileId]);

  useEffect(() => {
    void fetchMembers();
  }, [fetchMembers]);

  return {
    loading,
    members,
    refresh: fetchMembers,
  };
};
