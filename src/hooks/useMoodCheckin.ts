import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamily } from "@/contexts/FamilyContext";

interface MoodLog {
  created_at: string;
  emoji: string;
  id: string;
  mood: string;
  note: string | null;
}

interface UseMoodCheckinReturn {
  loading: boolean;
  recentMoods: MoodLog[];
  saveMood: (mood: string, emoji: string, note?: string) => Promise<boolean>;
  saving: boolean;
  todaysMood: MoodLog | null;
}

interface ChildProfileRow {
  id: string;
  linked_child_id: string | null;
}

export const useMoodCheckin = (linkedChildId: string | null): UseMoodCheckinReturn => {
  const { user } = useAuth();
  const { activeFamilyId } = useFamily();
  const [todaysMood, setTodaysMood] = useState<MoodLog | null>(null);
  const [recentMoods, setRecentMoods] = useState<MoodLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadChildProfile = useCallback(async () => {
    if (!user) {
      throw new Error("Authentication required.");
    }

    if (!activeFamilyId) {
      throw new Error("An active family is required before loading child mood check-ins.");
    }

    if (!linkedChildId) {
      throw new Error("The linked child is required before loading mood check-ins.");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, linked_child_id")
      .eq("user_id", user.id)
      .eq("account_role", "child")
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    const typedProfile = profile as ChildProfileRow | null;
    if (!typedProfile || typedProfile.linked_child_id !== linkedChildId) {
      throw new Error("The authenticated child account is not linked to the requested child.");
    }

    const { data: membership, error: membershipError } = await supabase
      .from("family_members")
      .select("id")
      .eq("family_id", activeFamilyId)
      .eq("user_id", user.id)
      .eq("role", "child")
      .eq("status", "active")
      .maybeSingle();

    if (membershipError) {
      throw membershipError;
    }

    if (!membership) {
      throw new Error("This child account is not an active child member of the requested family.");
    }

    const { data: child, error: childError } = await supabase
      .from("children")
      .select("id")
      .eq("id", linkedChildId)
      .eq("family_id", activeFamilyId)
      .maybeSingle();

    if (childError) {
      throw childError;
    }

    if (!child) {
      throw new Error("The linked child is not part of the active family.");
    }

    return typedProfile;
  }, [activeFamilyId, linkedChildId, user]);

  const fetchMoods = useCallback(async () => {
    if (!user || !linkedChildId) {
      setTodaysMood(null);
      setRecentMoods([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const profile = await loadChildProfile();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: moods, error } = await supabase
        .from("child_mood_logs")
        .select("*")
        .eq("child_profile_id", profile.id)
        .eq("linked_child_id", linkedChildId)
        .gte("created_at", sevenDaysAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        throw error;
      }

      const typedMoods = (moods as MoodLog[] | null) ?? [];
      setRecentMoods(typedMoods);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayMood = typedMoods.find((mood) => {
        const moodDate = new Date(mood.created_at);
        moodDate.setHours(0, 0, 0, 0);
        return moodDate.getTime() === today.getTime();
      });

      setTodaysMood(todayMood ?? null);
    } catch (error) {
      console.error("Error in useMoodCheckin:", error);
      setRecentMoods([]);
      setTodaysMood(null);
    } finally {
      setLoading(false);
    }
  }, [linkedChildId, loadChildProfile, user]);

  useEffect(() => {
    void fetchMoods();
  }, [fetchMoods]);

  const saveMood = async (mood: string, emoji: string, note?: string): Promise<boolean> => {
    if (!user) {
      return false;
    }

    setSaving(true);

    try {
      const profile = await loadChildProfile();

      const { data: newMood, error } = await supabase
        .from("child_mood_logs")
        .insert({
          child_profile_id: profile.id,
          linked_child_id: linkedChildId,
          mood,
          emoji,
          note: note || null,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      const typedMood = newMood as MoodLog;
      setTodaysMood(typedMood);
      setRecentMoods((previous) => [typedMood, ...previous.filter((entry) => entry.id !== typedMood.id)].slice(0, 10));

      return true;
    } catch (error) {
      console.error("Error saving mood:", error);
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    loading,
    recentMoods,
    saveMood,
    saving,
    todaysMood,
  };
};
