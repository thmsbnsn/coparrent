import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamily } from "@/contexts/FamilyContext";
import { ensureFamilyChildLinksSynced, fetchFamilyChildIds } from "@/lib/familyScope";
import { useToast } from "@/hooks/use-toast";

export interface ChildPermissionData {
  id: string;
  child_profile_id: string;
  parent_profile_id: string;
  allow_parent_messaging: boolean;
  allow_family_chat: boolean;
  allow_sibling_messaging: boolean;
  allow_push_notifications: boolean;
  allow_calendar_reminders: boolean;
  show_full_event_details: boolean;
  allow_mood_checkins: boolean;
  allow_notes_to_parents: boolean;
}

export interface ChildAccountInfo {
  profile_id: string;
  user_id: string;
  child_id: string;
  child_name: string;
  login_enabled: boolean;
  permissions: ChildPermissionData | null;
}

interface ChildProfileRow {
  id: string;
  user_id: string;
  linked_child_id: string | null;
  login_enabled: boolean | null;
  children: { name: string } | { name: string }[] | null;
}

export const useChildPermissions = () => {
  const { user } = useAuth();
  const { activeFamilyId, loading: familyLoading } = useFamily();
  const { toast } = useToast();
  const [childAccounts, setChildAccounts] = useState<ChildAccountInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [scopeError, setScopeError] = useState<string | null>(null);

  const fetchChildAccounts = useCallback(async () => {
    if (!user) {
      setChildAccounts([]);
      setScopeError(null);
      setLoading(false);
      return;
    }

    if (familyLoading) {
      return;
    }

    if (!activeFamilyId) {
      setChildAccounts([]);
      setScopeError("Select an active family before managing child accounts.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setScopeError(null);

    try {
      await ensureFamilyChildLinksSynced(activeFamilyId);
      const childIds = await fetchFamilyChildIds(activeFamilyId);

      if (childIds.length === 0) {
        setChildAccounts([]);
        return;
      }

      const { data: childProfiles } = await supabase
        .from("profiles")
        .select(`
          id,
          user_id,
          linked_child_id,
          login_enabled,
          children!profiles_linked_child_id_fkey (
            id,
            name
          )
        `)
        .eq("account_role", "child")
        .in("linked_child_id", childIds);

      if (childProfiles) {
        const familyChildAccounts = (childProfiles as ChildProfileRow[])
          .filter((cp) => cp.linked_child_id && childIds.includes(cp.linked_child_id))
          .map((cp) => ({
            profile_id: cp.id,
            user_id: cp.user_id,
            child_id: cp.linked_child_id!,
            child_name: Array.isArray(cp.children)
              ? (cp.children[0]?.name ?? "Unknown")
              : (cp.children?.name ?? "Unknown"),
            login_enabled: cp.login_enabled ?? true,
            permissions: null as ChildPermissionData | null,
          }));

        // Fetch permissions for each child account
        const { data: permissions } = await supabase
          .from("child_permissions")
          .select("*")
          .in("child_profile_id", familyChildAccounts.map((ca) => ca.profile_id));

        // Map permissions to child accounts
        const accountsWithPermissions = familyChildAccounts.map((account) => ({
          ...account,
          permissions: permissions?.find((p) => p.child_profile_id === account.profile_id) || null,
        }));

        setChildAccounts(accountsWithPermissions);
      }
    } catch (error) {
      console.error("Error fetching child accounts:", error);
      setScopeError("Unable to load child accounts for the active family.");
    } finally {
      setLoading(false);
    }
  }, [activeFamilyId, familyLoading, user]);

  useEffect(() => {
    void fetchChildAccounts();
  }, [fetchChildAccounts]);

  const updatePermission = async (
    childProfileId: string,
    permission: keyof Omit<ChildPermissionData, "id" | "child_profile_id" | "parent_profile_id">,
    value: boolean
  ) => {
    if (!activeFamilyId) {
      toast({
        title: "Family scope required",
        description: "Select an active family before updating child permissions.",
        variant: "destructive",
      });
      return false;
    }

    if (!childAccounts.some((account) => account.profile_id === childProfileId)) {
      toast({
        title: "Child account unavailable",
        description: "That child account is not part of the active family.",
        variant: "destructive",
      });
      return false;
    }

    try {
      const { error } = await supabase
        .from("child_permissions")
        .update({ [permission]: value })
        .eq("child_profile_id", childProfileId);

      if (error) throw error;

      // Update local state
      setChildAccounts((prev) =>
        prev.map((account) =>
          account.profile_id === childProfileId
            ? {
                ...account,
                permissions: account.permissions
                  ? { ...account.permissions, [permission]: value }
                  : null,
              }
            : account
        )
      );

      toast({
        title: "Permission updated",
        description: "Child permission has been updated successfully.",
      });

      return true;
    } catch (error) {
      console.error("Error updating permission:", error);
      toast({
        title: "Error",
        description: "Failed to update permission.",
        variant: "destructive",
      });
      return false;
    }
  };

  const toggleLoginEnabled = async (childProfileId: string, enabled: boolean) => {
    if (!activeFamilyId) {
      toast({
        title: "Family scope required",
        description: "Select an active family before changing child login access.",
        variant: "destructive",
      });
      return false;
    }

    if (!childAccounts.some((account) => account.profile_id === childProfileId)) {
      toast({
        title: "Child account unavailable",
        description: "That child account is not part of the active family.",
        variant: "destructive",
      });
      return false;
    }

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ login_enabled: enabled })
        .eq("id", childProfileId);

      if (error) throw error;

      // Update local state
      setChildAccounts((prev) =>
        prev.map((account) =>
          account.profile_id === childProfileId
            ? { ...account, login_enabled: enabled }
            : account
        )
      );

      toast({
        title: enabled ? "Login enabled" : "Login disabled",
        description: enabled
          ? "Child can now log in to their account."
          : "Child login has been disabled. Active sessions will be invalidated.",
      });

      return true;
    } catch (error) {
      console.error("Error toggling login:", error);
      toast({
        title: "Error",
        description: "Failed to update login status.",
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    childAccounts,
    loading,
    scopeError,
    updatePermission,
    toggleLoginEnabled,
    refetch: fetchChildAccounts,
  };
};
