import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ensureCurrentUserFamilyMembership } from "@/lib/familyMembership";

const POST_AUTH_PATH_OVERRIDE_KEY = "postAuthPathOverride";

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

const isSafeInternalPath = (candidate: string | null) =>
  Boolean(candidate && candidate.startsWith("/") && !candidate.startsWith("//"));

export const stashPostAuthPathOverride = (path: string | null) => {
  if (typeof window === "undefined") {
    return;
  }

  if (!isSafeInternalPath(path)) {
    sessionStorage.removeItem(POST_AUTH_PATH_OVERRIDE_KEY);
    return;
  }

  sessionStorage.setItem(POST_AUTH_PATH_OVERRIDE_KEY, path!);
};

export const consumePostAuthPathOverride = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const nextPath = sessionStorage.getItem(POST_AUTH_PATH_OVERRIDE_KEY);
  sessionStorage.removeItem(POST_AUTH_PATH_OVERRIDE_KEY);

  return isSafeInternalPath(nextPath) ? nextPath : null;
};

export const resolvePostAuthPath = async (user: User) => {
  const pendingInvitePath = getPendingInvitePath();
  if (pendingInvitePath) {
    return pendingInvitePath;
  }

  const pathOverride = consumePostAuthPathOverride();
  if (pathOverride) {
    return pathOverride;
  }

  const rawAccountType = user.user_metadata?.account_type;
  const isLawOfficeMetadata =
    rawAccountType === "law_office" || rawAccountType === "lawoffice";

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, account_role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profile?.account_role === "law_office" || isLawOfficeMetadata) {
    return "/law-office/dashboard";
  }

  if (profile?.account_role === "child") {
    return "/kids";
  }

  await ensureCurrentUserFamilyMembership(user.user_metadata?.full_name || user.email || null);

  if (!profile) {
    return "/onboarding";
  }

  const { count } = await supabase
    .from("parent_children")
    .select("*", { count: "exact", head: true })
    .eq("parent_id", profile.id);

  return count && count > 0 ? "/dashboard" : "/onboarding";
};
