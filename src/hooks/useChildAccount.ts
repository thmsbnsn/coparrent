import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ChildPermissions {
  is_child: boolean;
  allow_parent_messaging: boolean;
  allow_family_chat: boolean;
  allow_sibling_messaging: boolean;
  allow_push_notifications: boolean;
  allow_calendar_reminders: boolean;
  show_full_event_details: boolean;
  allow_mood_checkins: boolean;
  allow_notes_to_parents: boolean;
  login_enabled: boolean;
}

const DEFAULT_PARENT_PERMISSIONS: ChildPermissions = {
  is_child: false,
  allow_parent_messaging: true,
  allow_family_chat: true,
  allow_sibling_messaging: true,
  allow_push_notifications: true,
  allow_calendar_reminders: true,
  show_full_event_details: true,
  allow_mood_checkins: true,
  allow_notes_to_parents: true,
  login_enabled: true,
};

export const useChildAccount = () => {
  const { user } = useAuth();
  const [isChildAccount, setIsChildAccount] = useState(false);
  const [permissions, setPermissions] = useState<ChildPermissions>(DEFAULT_PARENT_PERMISSIONS);
  const [loading, setLoading] = useState(true);
  const [linkedChildId, setLinkedChildId] = useState<string | null>(null);

  useEffect(() => {
    const fetchChildAccountStatus = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Check if user is a child account
        const { data: profile } = await supabase
          .from("profiles")
          .select("account_role, linked_child_id, login_enabled")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profile) {
          const isChild = profile.account_role === "child";
          setIsChildAccount(isChild);
          setLinkedChildId(profile.linked_child_id);

          if (isChild) {
            // Fetch permissions for child account
            const { data: permData } = await supabase
              .rpc("get_child_permissions", { _user_id: user.id });
            
            if (permData) {
              setPermissions(permData as unknown as ChildPermissions);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching child account status:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchChildAccountStatus();
  }, [user]);

  return {
    isChildAccount,
    permissions,
    linkedChildId,
    loading,
    // Convenience methods
    canAccessSettings: !isChildAccount,
    canAccessBilling: !isChildAccount,
    canAccessLegalContent: !isChildAccount,
    canAccessAuditLogs: !isChildAccount,
    canSendMessages: permissions.allow_parent_messaging || permissions.allow_family_chat,
    canSeeFullCalendar: permissions.show_full_event_details,
  };
};
