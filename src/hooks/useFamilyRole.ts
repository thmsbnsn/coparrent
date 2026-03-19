/**
 * useFamilyRole - Family-scoped role hook
 * 
 * CRITICAL: Role is a property of MEMBERSHIP, not the user globally.
 * A user may be a parent in one family and third-party in another.
 * 
 * This hook uses the FamilyContext to get the effective role in the
 * currently active family. It NEVER computes a global role.
 * 
 * @see src/contexts/FamilyContext.tsx for the source of truth
 */

import { useFamily } from "@/contexts/FamilyContext";
import type { Database } from "@/integrations/supabase/types";

type MemberRole = Database["public"]["Enums"]["member_role"];

// Legacy type alias for backward compatibility
export type FamilyRole = MemberRole | null;

interface FamilyMemberInfo {
  /** User's role in the ACTIVE family (NOT global) */
  role: FamilyRole;
  /** User's profile ID */
  profileId: string | null;
  /** Legacy compatibility - deprecated, use activeFamilyId instead */
  primaryParentId: string | null;
  /** Whether user is a parent/guardian in the ACTIVE family */
  isParent: boolean;
  /** Whether user is a third-party in the ACTIVE family */
  isThirdParty: boolean;
  /** Whether user is a child in the ACTIVE family */
  isChild: boolean;
  /** UI-only label (step_parent, grandparent, etc.) - NOT for permissions */
  relationshipLabel: string | null;
  /** Loading state */
  loading: boolean;
  /** Currently active family ID */
  activeFamilyId: string | null;
}

/**
 * Returns the user's role in the currently active family.
 * 
 * NEVER use this for global role assumptions. The same user can have
 * different roles in different families:
 * - Parent in Family A
 * - Third-party (step-parent) in Family B
 * 
 * Switching families changes permissions immediately.
 */
export const useFamilyRole = (): FamilyMemberInfo => {
  const {
    effectiveRole,
    profileId,
    isParentInActiveFamily,
    isThirdPartyInActiveFamily,
    isChildInActiveFamily,
    relationshipLabel,
    roleLoading,
    loading,
    activeFamilyId,
  } = useFamily();

  return {
    role: effectiveRole,
    profileId,
    primaryParentId: activeFamilyId, // Legacy compatibility - use activeFamilyId
    isParent: isParentInActiveFamily,
    isThirdParty: isThirdPartyInActiveFamily,
    isChild: isChildInActiveFamily,
    relationshipLabel,
    loading: loading || roleLoading,
    activeFamilyId,
  };
};

/**
 * Get role in a specific family (for UI comparisons)
 * Use when you need to check a user's role in a family other than the active one.
 */
export const useRoleInFamily = (familyId: string | null) => {
  const { memberships, loading, roleLoading } = useFamily();
  
  if (!familyId || loading || roleLoading) {
    return {
      role: null as FamilyRole,
      isParent: false,
      isThirdParty: false,
      isChild: false,
      loading: loading || roleLoading,
    };
  }
  
  const membership = memberships.find(m => m.familyId === familyId);
  const role = membership?.role || null;
  
  return {
    role,
    isParent: role === "parent" || role === "guardian",
    isThirdParty: role === "third_party",
    isChild: role === "child",
    loading: false,
  };
};
