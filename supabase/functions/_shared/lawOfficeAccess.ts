import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { HttpError, type AuthenticatedProfile } from "./callHelpers.ts";

export type LawOfficeFamilyAccessRecord = {
  family_id: string;
  id: string;
  law_office_user_id: string;
  revoked_at: string | null;
};

export const isLawOfficeProfile = (
  profile: Pick<AuthenticatedProfile, "account_role">,
) => profile.account_role === "law_office";

export async function assertLawOfficeFamilyAccess(
  options: {
    familyId: string;
    supabaseAdmin: SupabaseClient;
    userId: string;
  },
): Promise<LawOfficeFamilyAccessRecord> {
  if (!options.familyId) {
    throw new HttpError(400, "family_id is required.");
  }

  const { data, error } = await options.supabaseAdmin
    .from("law_office_family_access")
    .select("id, law_office_user_id, family_id, revoked_at")
    .eq("law_office_user_id", options.userId)
    .eq("family_id", options.familyId)
    .is("revoked_at", null)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, "Unable to verify law office family access.");
  }

  if (!data || data.revoked_at) {
    throw new HttpError(403, "You do not have access to that family.");
  }

  return data as LawOfficeFamilyAccessRecord;
}
