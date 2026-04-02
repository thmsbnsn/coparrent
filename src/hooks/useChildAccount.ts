import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamily } from "@/contexts/FamilyContext";
import {
  createClosedChildContext,
  DEFAULT_PARENT_CHILD_CONTEXT,
  type ChildAccountContext,
} from "@/lib/kidsPortal";

interface ProfileRow {
  account_role: string | null;
  linked_child_id: string | null;
  login_enabled: boolean | null;
}

export const useChildAccount = () => {
  const { user } = useAuth();
  const { activeFamilyId } = useFamily();
  const [context, setContext] = useState<ChildAccountContext>(DEFAULT_PARENT_CHILD_CONTEXT);
  const [loading, setLoading] = useState(true);
  const [scopeError, setScopeError] = useState<string | null>(null);

  const fetchChildAccountStatus = useCallback(async () => {
    if (!user) {
      setContext(DEFAULT_PARENT_CHILD_CONTEXT);
      setScopeError(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("account_role, linked_child_id, login_enabled")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      const profile = profileData as ProfileRow | null;

      const isChildAccount = profile?.account_role === "child";

      if (!profile || !isChildAccount) {
        setContext(DEFAULT_PARENT_CHILD_CONTEXT);
        setScopeError(null);
        return;
      }

      if (!activeFamilyId) {
        setContext(createClosedChildContext(profile.login_enabled ?? true));
        setScopeError("An active family is required before loading child account permissions.");
        return;
      }

      const { data, error } = await supabase.rpc("get_child_account_context", {
        p_family_id: activeFamilyId,
      });

      if (error) {
        console.error("Error fetching child account context:", error);
        setContext(createClosedChildContext(profile.login_enabled ?? true));
        setScopeError(error.message || "Unable to load child account context for the active family.");
        return;
      }

      setContext({
        ...createClosedChildContext(profile.login_enabled ?? true),
        ...(data as Partial<ChildAccountContext> | null),
        is_child: true,
        login_enabled: (data as Partial<ChildAccountContext> | null)?.login_enabled ?? (profile.login_enabled ?? true),
      });
      setScopeError(null);
    } catch (error) {
      console.error("Error fetching child account status:", error);
      setContext(createClosedChildContext(true));
      setScopeError("Unable to load child account permissions.");
    } finally {
      setLoading(false);
    }
  }, [activeFamilyId, user]);

  useEffect(() => {
    void fetchChildAccountStatus();
  }, [fetchChildAccountStatus]);

  return {
    ...context,
    isChildAccount: context.is_child,
    loading,
    permissions: context,
    linkedChildId: context.child_id,
    scopeError,
    refresh: fetchChildAccountStatus,
    canAccessSettings: !context.is_child,
    canAccessBilling: !context.is_child,
    canAccessLegalContent: !context.is_child,
    canAccessAuditLogs: !context.is_child,
    canSendMessages: context.allow_parent_messaging || context.allow_family_chat,
    canSeeFullCalendar: context.show_full_event_details,
  };
};
