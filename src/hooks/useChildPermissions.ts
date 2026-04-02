import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFamily } from "@/contexts/FamilyContext";
import { useToast } from "@/hooks/use-toast";
import {
  DEFAULT_CHILD_DEVICE_ACCESS_SETTINGS,
  type ChildAllowedSignInMode,
  type ChildDeviceAccessSettingsSnapshot,
} from "@/lib/childAccess";
import type { ChildCallMode, KidPortalMode } from "@/lib/kidsPortal";

export interface ChildPermissionData {
  allow_calendar_reminders: boolean;
  allow_family_chat: boolean;
  allow_mood_checkins: boolean;
  allow_notes_to_parents: boolean;
  allow_parent_messaging: boolean;
  allow_push_notifications: boolean;
  allow_sibling_messaging: boolean;
  show_full_event_details: boolean;
}

export interface ChildCallSettingsData {
  allowed_inbound_member_ids: string[];
  allowed_outbound_member_ids: string[];
  call_mode: ChildCallMode;
  calling_enabled: boolean;
}

export interface ChildDeviceAccessSettingsData extends ChildDeviceAccessSettingsSnapshot {
  updated_at: string | null;
}

export interface ChildAccountInfo {
  call_settings: ChildCallSettingsData;
  child_email: string | null;
  child_id: string;
  child_name: string;
  child_profile_id: string | null;
  child_username: string | null;
  date_of_birth: string | null;
  device_access: ChildDeviceAccessSettingsData;
  has_account: boolean;
  login_enabled: boolean;
  permissions: ChildPermissionData;
  portal_mode: KidPortalMode;
  reset_via_child_email: boolean;
}

export interface FamilyContactOption {
  avatar_url: string | null;
  full_name: string | null;
  membership_id: string;
  profile_id: string;
  relationship_label: string | null;
  role: "parent" | "guardian" | "third_party";
}

interface FamilyMemberRow {
  id: string;
  profile_id: string;
  profiles: {
    avatar_url: string | null;
    full_name: string | null;
  } | {
    avatar_url: string | null;
    full_name: string | null;
  }[] | null;
  relationship_label: string | null;
  role: "parent" | "guardian" | "third_party";
}

type OverviewRow = {
  call_settings: ChildCallSettingsData;
  child_email: string | null;
  child_id: string;
  child_name: string;
  child_profile_id: string | null;
  child_username: string | null;
  date_of_birth: string | null;
  device_access: Partial<ChildDeviceAccessSettingsData> | null;
  has_account: boolean;
  login_enabled: boolean;
  permissions: ChildPermissionData;
  portal_mode: KidPortalMode;
  reset_via_child_email: boolean;
};

export const useChildPermissions = () => {
  const { activeFamilyId, isParentInActiveFamily, loading: familyLoading } = useFamily();
  const { toast } = useToast();
  const [childAccounts, setChildAccounts] = useState<ChildAccountInfo[]>([]);
  const [familyContacts, setFamilyContacts] = useState<FamilyContactOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [scopeError, setScopeError] = useState<string | null>(null);

  const fetchChildAccounts = useCallback(async () => {
    if (familyLoading) {
      return;
    }

    if (!isParentInActiveFamily) {
      setChildAccounts([]);
      setFamilyContacts([]);
      setScopeError(null);
      setLoading(false);
      return;
    }

    if (!activeFamilyId) {
      setChildAccounts([]);
      setFamilyContacts([]);
      setScopeError("Select an active family before managing child accounts.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setScopeError(null);

    try {
      const [{ data: overview, error: overviewError }, { data: memberRows, error: memberError }] = await Promise.all([
        supabase.rpc("get_family_child_portal_overview", {
          p_family_id: activeFamilyId,
        }),
        supabase
          .from("family_members")
          .select(`
            id,
            profile_id,
            relationship_label,
            role,
            profiles!family_members_profile_id_fkey (
              full_name,
              avatar_url
            )
          `)
          .eq("family_id", activeFamilyId)
          .eq("status", "active")
          .in("role", ["parent", "guardian", "third_party"]),
      ]);

      if (overviewError) {
        throw overviewError;
      }

      if (memberError) {
        throw memberError;
      }

      const typedOverview = ((overview as OverviewRow[] | null) ?? []).map((child) => ({
        ...child,
        call_settings: {
          allowed_inbound_member_ids: child.call_settings?.allowed_inbound_member_ids ?? [],
          allowed_outbound_member_ids: child.call_settings?.allowed_outbound_member_ids ?? [],
          call_mode: child.call_settings?.call_mode ?? "audio_only",
          calling_enabled: child.call_settings?.calling_enabled ?? false,
        },
        device_access: {
          allowed_game_slugs:
            child.device_access?.allowed_game_slugs ?? DEFAULT_CHILD_DEVICE_ACCESS_SETTINGS.allowed_game_slugs,
          allowed_sign_in_mode:
            child.device_access?.allowed_sign_in_mode ?? DEFAULT_CHILD_DEVICE_ACCESS_SETTINGS.allowed_sign_in_mode,
          child_email_reset_enabled:
            child.device_access?.child_email_reset_enabled ?? Boolean(child.reset_via_child_email),
          communication_enabled:
            child.device_access?.communication_enabled ?? DEFAULT_CHILD_DEVICE_ACCESS_SETTINGS.communication_enabled,
          games_enabled:
            child.device_access?.games_enabled ?? DEFAULT_CHILD_DEVICE_ACCESS_SETTINGS.games_enabled,
          multiplayer_enabled:
            child.device_access?.multiplayer_enabled ?? DEFAULT_CHILD_DEVICE_ACCESS_SETTINGS.multiplayer_enabled,
          quick_unlock_enabled:
            child.device_access?.quick_unlock_enabled ?? DEFAULT_CHILD_DEVICE_ACCESS_SETTINGS.quick_unlock_enabled,
          screen_time_daily_minutes:
            child.device_access?.screen_time_daily_minutes ??
            DEFAULT_CHILD_DEVICE_ACCESS_SETTINGS.screen_time_daily_minutes,
          screen_time_enabled:
            child.device_access?.screen_time_enabled ?? DEFAULT_CHILD_DEVICE_ACCESS_SETTINGS.screen_time_enabled,
          updated_at: child.device_access?.updated_at ?? null,
        },
      }));

      const typedContacts = ((memberRows as FamilyMemberRow[] | null) ?? [])
        .map((member) => {
          const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
          return {
            avatar_url: profile?.avatar_url ?? null,
            full_name: profile?.full_name ?? null,
            membership_id: member.id,
            profile_id: member.profile_id,
            relationship_label: member.relationship_label ?? null,
            role: member.role,
          };
        })
        .sort((left, right) => (left.full_name ?? "").localeCompare(right.full_name ?? ""));

      setChildAccounts(typedOverview);
      setFamilyContacts(typedContacts);
    } catch (error) {
      console.error("Error fetching child accounts:", error);
      setChildAccounts([]);
      setFamilyContacts([]);
      setScopeError("Unable to load child accounts for the active family.");
    } finally {
      setLoading(false);
    }
  }, [activeFamilyId, familyLoading, isParentInActiveFamily]);

  useEffect(() => {
    void fetchChildAccounts();
  }, [fetchChildAccounts]);

  const updatePermission = async (
    childProfileId: string,
    permission: keyof ChildPermissionData,
    value: boolean,
  ) => {
    if (!activeFamilyId) {
      toast({
        title: "Family scope required",
        description: "Select an active family before updating child permissions.",
        variant: "destructive",
      });
      return false;
    }

    const targetAccount = childAccounts.find((account) => account.child_profile_id === childProfileId);
    if (!targetAccount) {
      toast({
        title: "Child account unavailable",
        description: "That child account is not part of the active family.",
        variant: "destructive",
      });
      return false;
    }

    const { error } = await supabase.rpc("rpc_upsert_child_permissions", {
      p_child_profile_id: childProfileId,
      p_family_id: activeFamilyId,
      p_permissions: {
        [permission]: value,
      },
    });

    if (error) {
      console.error("Error updating permission:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update the child permission.",
        variant: "destructive",
      });
      return false;
    }

    setChildAccounts((current) =>
      current.map((account) =>
        account.child_profile_id === childProfileId
          ? {
              ...account,
              permissions: {
                ...account.permissions,
                [permission]: value,
              },
            }
          : account,
      ),
    );

    toast({
      title: "Permission updated",
      description: "Child permission has been updated successfully.",
    });
    return true;
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

    const { error } = await supabase.rpc("rpc_set_child_login_enabled", {
      p_child_profile_id: childProfileId,
      p_enabled: enabled,
      p_family_id: activeFamilyId,
    });

    if (error) {
      console.error("Error toggling login:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update child login access.",
        variant: "destructive",
      });
      return false;
    }

    setChildAccounts((current) =>
      current.map((account) =>
        account.child_profile_id === childProfileId
          ? { ...account, login_enabled: enabled }
          : account,
      ),
    );

    toast({
      title: enabled ? "Login enabled" : "Login disabled",
      description: enabled
        ? "Child credentials are active again."
        : "Child credentials are disabled for now.",
    });
    return true;
  };

  const updatePortalSettings = async (
    childId: string,
    payload: {
      child_email?: string | null;
      child_username?: string | null;
      portal_mode?: KidPortalMode;
      reset_via_child_email?: boolean | null;
    },
  ) => {
    if (!activeFamilyId) {
      toast({
        title: "Family scope required",
        description: "Select an active family before changing kid portal settings.",
        variant: "destructive",
      });
      return false;
    }

    const { error } = await supabase.rpc("rpc_upsert_child_portal_settings", {
      p_child_email: payload.child_email ?? null,
      p_child_id: childId,
      p_child_username: payload.child_username ?? null,
      p_family_id: activeFamilyId,
      p_portal_mode: payload.portal_mode ?? null,
      p_reset_via_child_email: payload.reset_via_child_email ?? null,
    });

    if (error) {
      console.error("Error updating child portal settings:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update kid portal settings.",
        variant: "destructive",
      });
      return false;
    }

    await fetchChildAccounts();
    toast({
      title: "Kid portal updated",
      description: "Child portal settings were saved.",
    });
    return true;
  };

  const updateCallSettings = async (
    childId: string,
    payload: {
      additional_information?: string;
      allowed_inbound_member_ids: string[];
      allowed_outbound_member_ids: string[];
      call_mode: ChildCallMode;
      calling_enabled: boolean;
    },
  ) => {
    if (!activeFamilyId) {
      toast({
        title: "Family scope required",
        description: "Select an active family before changing child calling settings.",
        variant: "destructive",
      });
      return false;
    }

    const { error } = await supabase.rpc("rpc_upsert_child_call_settings", {
      p_additional_information: payload.additional_information ?? null,
      p_allowed_inbound_member_ids: payload.allowed_inbound_member_ids,
      p_allowed_outbound_member_ids: payload.allowed_outbound_member_ids,
      p_call_mode: payload.call_mode,
      p_calling_enabled: payload.calling_enabled,
      p_child_id: childId,
      p_family_id: activeFamilyId,
    });

    if (error) {
      console.error("Error updating child call settings:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update child calling settings.",
        variant: "destructive",
      });
      return false;
    }

    await fetchChildAccounts();
    toast({
      title: "Calling settings updated",
      description: "Child calling permissions were saved and logged.",
    });
    return true;
  };

  const updateDeviceAccessSettings = async (
    childId: string,
    payload: {
      allowed_game_slugs?: string[] | null;
      allowed_sign_in_mode?: ChildAllowedSignInMode | null;
      communication_enabled?: boolean | null;
      games_enabled?: boolean | null;
      multiplayer_enabled?: boolean | null;
      quick_unlock_enabled?: boolean | null;
      screen_time_daily_minutes?: number | null;
      screen_time_enabled?: boolean | null;
    },
  ) => {
    if (!activeFamilyId) {
      toast({
        title: "Family scope required",
        description: "Select an active family before changing child access settings.",
        variant: "destructive",
      });
      return false;
    }

    const { error } = await supabase.rpc("rpc_upsert_child_device_access_settings", {
      p_allowed_game_slugs: payload.allowed_game_slugs ?? null,
      p_allowed_sign_in_mode: payload.allowed_sign_in_mode ?? null,
      p_child_id: childId,
      p_communication_enabled: payload.communication_enabled ?? null,
      p_family_id: activeFamilyId,
      p_games_enabled: payload.games_enabled ?? null,
      p_multiplayer_enabled: payload.multiplayer_enabled ?? null,
      p_quick_unlock_enabled: payload.quick_unlock_enabled ?? null,
      p_screen_time_daily_minutes:
        payload.screen_time_enabled === false ? null : payload.screen_time_daily_minutes ?? null,
      p_screen_time_enabled: payload.screen_time_enabled ?? null,
    });

    if (error) {
      console.error("Error updating child device access settings:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update child device access settings.",
        variant: "destructive",
      });
      return false;
    }

    await fetchChildAccounts();
    toast({
      title: "Child access updated",
      description: "Child sign-in and restriction settings were saved.",
    });
    return true;
  };

  const getCallHistory = useCallback(
    async (childId: string) => {
      if (!activeFamilyId) {
        throw new Error("An active family is required before loading child calling history.");
      }

      const { data, error } = await supabase.rpc("get_child_call_settings_history", {
        p_child_id: childId,
        p_family_id: activeFamilyId,
      });

      if (error) {
        throw error;
      }

      return (data as Array<Record<string, unknown>> | null) ?? [];
    },
    [activeFamilyId],
  );

  return {
    childAccounts,
    familyContacts,
    getCallHistory,
    loading,
    refetch: fetchChildAccounts,
    scopeError,
    toggleLoginEnabled,
    updateCallSettings,
    updateDeviceAccessSettings,
    updatePermission,
    updatePortalSettings,
  };
};
