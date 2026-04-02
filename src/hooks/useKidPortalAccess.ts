import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFamily } from "@/contexts/FamilyContext";
import { useChildAccount } from "@/hooks/useChildAccount";
import {
  DEFAULT_KID_PORTAL_REQUEST_STATE,
  type KidPortalRequestState,
} from "@/lib/kidsPortal";

export const useKidPortalAccess = () => {
  const { activeFamilyId } = useFamily();
  const { isChildAccount, loading: childLoading, portal_mode } = useChildAccount();
  const [requestState, setRequestState] = useState<KidPortalRequestState>(DEFAULT_KID_PORTAL_REQUEST_STATE);
  const [loading, setLoading] = useState(true);
  const [scopeError, setScopeError] = useState<string | null>(null);

  const fetchState = useCallback(async () => {
    if (childLoading) {
      return;
    }

    if (!isChildAccount || portal_mode !== "under_6") {
      setRequestState(DEFAULT_KID_PORTAL_REQUEST_STATE);
      setScopeError(null);
      setLoading(false);
      return;
    }

    if (!activeFamilyId) {
      setRequestState(DEFAULT_KID_PORTAL_REQUEST_STATE);
      setScopeError("An active family is required before loading the Kids Portal.");
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.rpc("get_kid_portal_request_state", {
      p_family_id: activeFamilyId,
    });

    if (error) {
      console.error("Error fetching kid portal access state:", error);
      setRequestState(DEFAULT_KID_PORTAL_REQUEST_STATE);
      setScopeError(error.message || "Unable to load the Kids Portal access state.");
      setLoading(false);
      return;
    }

    setRequestState({
      ...DEFAULT_KID_PORTAL_REQUEST_STATE,
      ...(data as Partial<KidPortalRequestState> | null),
    });
    setScopeError(null);
    setLoading(false);
  }, [activeFamilyId, childLoading, isChildAccount, portal_mode]);

  useEffect(() => {
    void fetchState();
  }, [fetchState]);

  const requestAccess = useCallback(async () => {
    if (!activeFamilyId) {
      setScopeError("An active family is required before requesting Kids Portal access.");
      return false;
    }

    const { data, error } = await supabase.rpc("rpc_request_kid_portal_access", {
      p_family_id: activeFamilyId,
    });

    if (error) {
      console.error("Error requesting kid portal access:", error);
      setScopeError(error.message || "Unable to request Kids Portal access.");
      return false;
    }

    setRequestState({
      ...DEFAULT_KID_PORTAL_REQUEST_STATE,
      ...(data as Partial<KidPortalRequestState> | null),
      dashboard_unlocked: false,
    });
    setScopeError(null);
    return true;
  }, [activeFamilyId]);

  return {
    loading: loading || childLoading,
    portalMode: portal_mode,
    refresh: fetchState,
    requestAccess,
    requestState,
    scopeError,
  };
};
