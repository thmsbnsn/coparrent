import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Plan usage and limits from server
 * Matches the shape returned by get_plan_usage RPC
 */
export interface PlanUsage {
  tier: "free" | "power";
  kids_used: number;
  kids_remaining: number;
  max_kids: number;
  third_party_used: number;
  third_party_remaining: number;
  max_third_party: number;
  can_add_kid: boolean;
  can_invite_third_party: boolean;
}

/**
 * Error codes returned by RPC functions
 */
export type RpcErrorCode =
  | "NOT_AUTHENTICATED"
  | "NOT_PARENT"
  | "LIMIT_REACHED"
  | "VALIDATION_ERROR"
  | "UNKNOWN_ERROR";

export interface RpcResult<T = unknown> {
  ok: boolean;
  code?: RpcErrorCode;
  message?: string;
  data?: T;
  meta?: {
    tier?: string;
    current?: string;
    max?: string;
  };
}

const DEFAULT_USAGE: PlanUsage = {
  tier: "free",
  kids_used: 0,
  kids_remaining: 4,
  max_kids: 4,
  third_party_used: 0,
  third_party_remaining: 4,
  max_third_party: 4,
  can_add_kid: true,
  can_invite_third_party: true,
};

/**
 * Hook to fetch plan usage and limits from the server
 * Uses the get_plan_usage RPC function for server-side truth
 */
export const usePlanLimits = () => {
  const { user } = useAuth();
  const [usage, setUsage] = useState<PlanUsage>(DEFAULT_USAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

  const fetchUsage = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // First get profile ID
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile) {
        setLoading(false);
        return;
      }

      setProfileId(profile.id);

      // Call RPC to get usage
      const { data, error: rpcError } = await supabase.rpc("get_plan_usage", {
        p_profile_id: profile.id,
      });

      if (rpcError) {
        console.error("Error fetching plan usage:", rpcError);
        setError(rpcError.message);
      } else if (data) {
        setUsage(data as unknown as PlanUsage);
      }
    } catch (err) {
      console.error("Error in usePlanLimits:", err);
      setError("Failed to fetch plan limits");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  // Refresh function for after mutations
  const refresh = useCallback(() => {
    setLoading(true);
    fetchUsage();
  }, [fetchUsage]);

  return {
    ...usage,
    loading,
    error,
    profileId,
    refresh,
    // Convenience booleans
    canAddChild: usage.can_add_kid,
    canInviteThirdParty: usage.can_invite_third_party,
    isAtChildLimit: !usage.can_add_kid,
    isAtThirdPartyLimit: !usage.can_invite_third_party,
  };
};

/**
 * Helper to parse RPC results with proper typing
 */
export function parseRpcResult<T>(data: unknown): RpcResult<T> {
  if (!data || typeof data !== "object") {
    return { ok: false, code: "UNKNOWN_ERROR", message: "Invalid response" };
  }
  return data as RpcResult<T>;
}

/**
 * Get user-friendly message for error codes
 */
export function getErrorMessage(result: RpcResult): string {
  if (result.ok) return "";
  
  switch (result.code) {
    case "NOT_AUTHENTICATED":
      return "Please log in to continue.";
    case "NOT_PARENT":
      return "Only parents or guardians can perform this action.";
    case "LIMIT_REACHED":
      return result.message || "You've reached your plan limit. Upgrade to add more.";
    case "VALIDATION_ERROR":
      return result.message || "Please check your input and try again.";
    default:
      return result.message || "An unexpected error occurred.";
  }
}
