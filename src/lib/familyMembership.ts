import { supabase } from "@/integrations/supabase/client";

type EnsureFamilyResult = {
  ok?: boolean;
  code?: string;
  message?: string;
  data?: {
    family_id?: string | null;
    role?: string | null;
    created?: boolean;
  };
};

export const hasPendingInviteToken = () =>
  !!(sessionStorage.getItem("pendingInviteToken") || localStorage.getItem("pendingInviteToken"));

export async function ensureCurrentUserFamilyMembership(displayName?: string | null) {
  const { data, error } = await supabase.rpc("rpc_ensure_family_membership", {
    p_display_name: displayName?.trim() || null,
  });

  if (error) {
    throw error;
  }

  const result = (data ?? {}) as EnsureFamilyResult;

  if (!result.ok) {
    throw new Error(result.message || "Unable to ensure family membership.");
  }

  return {
    familyId: result.data?.family_id ?? null,
    role: result.data?.role ?? null,
    created: !!result.data?.created,
  };
}
