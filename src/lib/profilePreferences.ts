import { supabase } from "@/integrations/supabase/client";

export type ProfilePreferences = Record<string, unknown>;

export const loadProfilePreferences = async (
  userId: string,
): Promise<ProfilePreferences> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data?.preferences as ProfilePreferences | null) ?? {};
};

export const saveProfilePreferencesPatch = async (
  userId: string,
  patch: ProfilePreferences,
): Promise<ProfilePreferences> => {
  const currentPreferences = await loadProfilePreferences(userId);
  const nextPreferences = JSON.parse(
    JSON.stringify({
      ...currentPreferences,
      ...patch,
    }),
  ) as ProfilePreferences;

  const { error } = await supabase
    .from("profiles")
    .update({ preferences: nextPreferences })
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  return nextPreferences;
};
