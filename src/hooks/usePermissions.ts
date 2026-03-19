/**
 * Unified permissions hook that consolidates role and account checks
 * into a single source of truth for UI rendering decisions.
 * 
 * This hook combines:
 * - useFamilyRole (parent/guardian/third_party)
 * - useChildAccount (child account status + specific permissions)
 * 
 * The goal is to make UI behavior predictable from role alone.
 */

import { useFamilyRole, FamilyRole } from "./useFamilyRole";
import { useChildAccount } from "./useChildAccount";

export type EffectiveRole = "parent" | "guardian" | "third_party" | "child" | "unknown";

export interface PermissionFlags {
  /** User can perform mutations (add/edit/delete) */
  canMutate: boolean;
  /** User can view calendar with full details */
  canViewFullCalendar: boolean;
  /** User can edit calendar/schedule */
  canEditCalendar: boolean;
  /** User can manage children profiles */
  canManageChildren: boolean;
  /** User can manage documents */
  canManageDocuments: boolean;
  /** User can manage expenses */
  canManageExpenses: boolean;
  /** User can access settings */
  canAccessSettings: boolean;
  /** User can access audit logs */
  canAccessAuditLogs: boolean;
  /** User can manage activities/sports */
  canManageActivities: boolean;
  /** User can send messages */
  canSendMessages: boolean;
  /** User should see view-only indicator */
  isViewOnly: boolean;
  /** Reason for view-only status */
  viewOnlyReason: string | null;
}

export interface UsePermissionsResult {
  /** The effective role for UI decisions */
  effectiveRole: EffectiveRole;
  /** Granular permission flags */
  permissions: PermissionFlags;
  /** True if any permission data is still loading */
  loading: boolean;
  /** True if user is a parent or guardian */
  isParent: boolean;
  /** True if user is a third-party member */
  isThirdParty: boolean;
  /** True if user is a child account */
  isChildAccount: boolean;
  /** Raw family role from useFamilyRole */
  familyRole: FamilyRole;
  /** Profile ID if available */
  profileId: string | null;
}

/**
 * Unified permissions hook for consistent UI behavior
 */
export const usePermissions = (): UsePermissionsResult => {
  const {
    role: familyRole,
    isParent,
    isThirdParty,
    profileId,
    loading: roleLoading,
  } = useFamilyRole();

  const {
    isChildAccount,
    permissions: childPermissions,
    loading: childLoading,
  } = useChildAccount();

  const loading = roleLoading || childLoading;

  // Determine effective role
  let effectiveRole: EffectiveRole = "unknown";
  if (isChildAccount) {
    effectiveRole = "child";
  } else if (familyRole === "parent") {
    effectiveRole = "parent";
  } else if (familyRole === "guardian") {
    effectiveRole = "guardian";
  } else if (familyRole === "third_party") {
    effectiveRole = "third_party";
  }

  // Calculate view-only status and reason
  const isViewOnly = isThirdParty || isChildAccount;
  let viewOnlyReason: string | null = null;
  if (isChildAccount) {
    viewOnlyReason = "Child accounts have limited access";
  } else if (isThirdParty) {
    viewOnlyReason = "Third-party members have view-only access";
  }

  // Calculate permission flags
  const permissions: PermissionFlags = {
    // Mutations require parent/guardian role and not being a child
    canMutate: isParent && !isChildAccount,
    
    // Calendar
    canViewFullCalendar: isParent || (isChildAccount && childPermissions.show_full_event_details),
    canEditCalendar: isParent && !isChildAccount,
    
    // Children management - parent only
    canManageChildren: isParent && !isChildAccount,
    
    // Documents - parent only
    canManageDocuments: isParent && !isChildAccount,
    
    // Expenses - parent only
    canManageExpenses: isParent && !isChildAccount,
    
    // Settings - parent only
    canAccessSettings: isParent && !isChildAccount,
    
    // Audit logs - parent only
    canAccessAuditLogs: isParent && !isChildAccount,
    
    // Activities/Sports - parent only
    canManageActivities: isParent && !isChildAccount,
    
    // Messages - depends on child permissions
    canSendMessages: isParent || 
      (isChildAccount && (childPermissions.allow_parent_messaging || childPermissions.allow_family_chat)),
    
    // View-only status
    isViewOnly,
    viewOnlyReason,
  };

  return {
    effectiveRole,
    permissions,
    loading,
    isParent,
    isThirdParty,
    isChildAccount,
    familyRole,
    profileId,
  };
};
