import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
  const { toast } = useToast();
  const [childAccounts, setChildAccounts] = useState<ChildAccountInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChildAccounts = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Get parent's profile
      const { data: parentProfile } = await supabase
        .from("profiles")
        .select("id, co_parent_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!parentProfile) {
        setLoading(false);
        return;
      }

      // Get child accounts linked to this family
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
        .not("linked_child_id", "is", null);

      if (childProfiles) {
        // Filter to only children in this parent's family
        const { data: parentChildren } = await supabase
          .from("parent_children")
          .select("child_id")
          .eq("parent_id", parentProfile.id);

        const childIds = parentChildren?.map((pc) => pc.child_id) || [];

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
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchChildAccounts();
  }, [fetchChildAccounts]);

  const updatePermission = async (
    childProfileId: string,
    permission: keyof Omit<ChildPermissionData, "id" | "child_profile_id" | "parent_profile_id">,
    value: boolean
  ) => {
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
    updatePermission,
    toggleLoginEnabled,
    refetch: fetchChildAccounts,
  };
};
