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

interface CallableMemberRpcRow {
  allowed_call_mode: ChildCallMode | null;
  avatar_url: string | null;
  email: string | null;
  full_name: string | null;
  membership_id: string;
  profile_id: string;
  relationship_label: string | null;
  role: MemberRole;
}

interface FallbackFamilyMemberRow {
  id: string;
  profile_id: string;
  profiles: {
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

const sortCallableMembers = (members: CallableFamilyMember[]) =>
  [...members].sort((left, right) => {
    const leftName = (left.fullName ?? left.email ?? "").toLowerCase();
    const rightName = (right.fullName ?? right.email ?? "").toLowerCase();
    return leftName.localeCompare(rightName);
  });

const mapRpcMember = (row: CallableMemberRpcRow): CallableFamilyMember => ({
  allowedCallMode: row.allowed_call_mode ?? "audio_video",
  avatarUrl: row.avatar_url,
  email: row.email,
  fullName: row.full_name ?? formatRelationshipLabel(row.relationship_label, row.role),
  membershipId: row.membership_id,
  profileId: row.profile_id,
  relationshipLabel: row.relationship_label ?? null,
  role: row.role,
});

const mapFallbackAdultMember = (row: FallbackFamilyMemberRow): CallableFamilyMember => ({
  allowedCallMode: "audio_video",
  avatarUrl: row.profiles?.avatar_url ?? null,
  email: row.profiles?.email ?? null,
  fullName: row.profiles?.full_name ?? formatRelationshipLabel(row.relationship_label, row.role),
  membershipId: row.id,
  profileId: row.profile_id,
  relationshipLabel: row.relationship_label ?? null,
  role: row.role,
});

export const useCallableFamilyMembers = () => {
  const { activeFamilyId, isChild, profileId } = useFamilyRole();
  const [members, setMembers] = useState<CallableFamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [scopeError, setScopeError] = useState<string | null>(null);

  const fetchAdultFallbackMembers = useCallback(async () => {
    if (!activeFamilyId || !profileId || isChild) {
      return [] as CallableFamilyMember[];
    }

    const { data, error } = await supabase
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
      .neq("profile_id", profileId)
      .in("role", ["parent", "guardian", "third_party"])
      .returns<FallbackFamilyMemberRow[]>();

    if (error) {
      throw error;
    }

    return sortCallableMembers(((data as FallbackFamilyMemberRow[] | null) ?? []).map(mapFallbackAdultMember));
  }, [activeFamilyId, isChild, profileId]);

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
      .returns<CallableMemberRpcRow[]>();

    if (error) {
      if (isChild) {
        console.error("Error fetching callable family members:", error);
        setMembers([]);
        setScopeError(error.message || "Unable to load callable family members for the active family.");
        setLoading(false);
        return;
      }

      try {
        const fallbackMembers = await fetchAdultFallbackMembers();
        setMembers(fallbackMembers);
        setScopeError(null);
      } catch (fallbackError) {
        console.error("Error fetching callable family members:", fallbackError);
        setMembers([]);
        setScopeError(
          fallbackError instanceof Error
            ? fallbackError.message
            : error.message || "Unable to load callable family members for the active family.",
        );
      } finally {
        setLoading(false);
      }
      return;
    }

    let nextMembers = sortCallableMembers(((data as CallableMemberRpcRow[] | null) ?? []).map(mapRpcMember));

    if (nextMembers.length === 0 && !isChild) {
      try {
        nextMembers = await fetchAdultFallbackMembers();
      } catch (fallbackError) {
        console.error("Error fetching fallback callable family members:", fallbackError);
      }
    }

    setMembers(nextMembers);
    setScopeError(null);
    setLoading(false);
  }, [activeFamilyId, fetchAdultFallbackMembers, isChild, profileId]);

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
