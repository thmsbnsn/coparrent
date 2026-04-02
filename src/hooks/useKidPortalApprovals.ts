import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFamily } from "@/contexts/FamilyContext";
import type { KidPortalMode, KidPortalRequestStatus } from "@/lib/kidsPortal";

export interface KidPortalApprovalRequest {
  child_id: string;
  child_name: string;
  id: string;
  portal_mode: KidPortalMode;
  requested_at: string;
  requested_by_name: string | null;
  requested_by_profile_id: string | null;
  status: KidPortalRequestStatus;
}

export const useKidPortalApprovals = () => {
  const { activeFamilyId, isParentInActiveFamily } = useFamily();
  const [requests, setRequests] = useState<KidPortalApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [scopeError, setScopeError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isParentInActiveFamily) {
      setRequests([]);
      setScopeError(null);
      setLoading(false);
      return;
    }

    if (!activeFamilyId) {
      setRequests([]);
      setScopeError("An active family is required before reviewing kid portal approvals.");
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.rpc("get_pending_family_kid_portal_requests", {
      p_family_id: activeFamilyId,
    });

    if (error) {
      console.error("Error loading kid portal approvals:", error);
      setRequests([]);
      setScopeError(error.message || "Unable to load pending kid portal approvals.");
      setLoading(false);
      return;
    }

    setRequests(((data as KidPortalApprovalRequest[] | null) ?? []).filter((request) => request.status === "pending"));
    setScopeError(null);
    setLoading(false);
  }, [activeFamilyId, isParentInActiveFamily]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const decideRequest = useCallback(
    async (requestId: string, decision: "approve" | "decline") => {
      if (!activeFamilyId) {
        setScopeError("An active family is required before deciding a kid portal approval.");
        return false;
      }

      const { error } = await supabase.rpc("rpc_decide_kid_portal_access_request", {
        p_decision: decision,
        p_family_id: activeFamilyId,
        p_request_id: requestId,
      });

      if (error) {
        console.error("Error deciding kid portal approval:", error);
        setScopeError(error.message || "Unable to update the kid portal approval.");
        return false;
      }

      setRequests((current) => current.filter((request) => request.id !== requestId));
      setScopeError(null);
      return true;
    },
    [activeFamilyId],
  );

  return {
    decideRequest,
    loading,
    refresh,
    requests,
    scopeError,
  };
};
