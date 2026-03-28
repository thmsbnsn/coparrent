import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ensureCurrentUserFamilyMembership } from "@/lib/familyMembership";

export const getPendingInviteToken = () => {
  if (typeof window === "undefined") {
    return null;
  }

  return (
    sessionStorage.getItem("pendingInviteToken") ||
    localStorage.getItem("pendingInviteToken")
  );
};

export const getPendingInvitePath = () => {
  const token = getPendingInviteToken();
  if (!token) {
    return null;
  }

  return `/accept-invite?token=${encodeURIComponent(token)}`;
};

export const resolvePostAuthPath = async (user: User) => {
  const pendingInvitePath = getPendingInvitePath();
  if (pendingInvitePath) {
    return pendingInvitePath;
  }

  await ensureCurrentUserFamilyMembership(user.user_metadata?.full_name || user.email || null);

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    return "/onboarding";
  }

  const { count } = await supabase
    .from("parent_children")
    .select("*", { count: "exact", head: true })
    .eq("parent_id", profile.id);

  return count && count > 0 ? "/dashboard" : "/onboarding";
};
