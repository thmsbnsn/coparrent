import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface MoodLog {
  id: string;
  mood: string;
  emoji: string;
  note: string | null;
  created_at: string;
}

interface UseMoodCheckinReturn {
  todaysMood: MoodLog | null;
  recentMoods: MoodLog[];
  loading: boolean;
  saving: boolean;
  saveMood: (mood: string, emoji: string, note?: string) => Promise<boolean>;
}

/**
 * Hook to manage mood check-ins for child accounts.
 * Fetches today's mood and allows saving new mood entries.
 */
export const useMoodCheckin = (linkedChildId: string | null): UseMoodCheckinReturn => {
  const { user } = useAuth();
  const [todaysMood, setTodaysMood] = useState<MoodLog | null>(null);
  const [recentMoods, setRecentMoods] = useState<MoodLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchMoods = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Get user's profile id
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (!profile) {
          setLoading(false);
          return;
        }

        // Fetch recent moods (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data: moods, error } = await supabase
          .from("child_mood_logs")
          .select("*")
          .eq("child_profile_id", profile.id)
          .gte("created_at", sevenDaysAgo.toISOString())
          .order("created_at", { ascending: false })
          .limit(10);

        if (error) {
          console.error("Error fetching moods:", error);
          setLoading(false);
          return;
        }

        setRecentMoods(moods || []);

        // Check if there's a mood logged today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todayMood = moods?.find(mood => {
          const moodDate = new Date(mood.created_at);
          moodDate.setHours(0, 0, 0, 0);
          return moodDate.getTime() === today.getTime();
        });

        setTodaysMood(todayMood || null);
      } catch (err) {
        console.error("Error in useMoodCheckin:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMoods();
  }, [user]);

  const saveMood = async (mood: string, emoji: string, note?: string): Promise<boolean> => {
    if (!user) return false;

    setSaving(true);

    try {
      // Get user's profile id
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) {
        throw new Error("Profile not found");
      }

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

      // Update local state
      setTodaysMood(newMood);
      setRecentMoods(prev => [newMood, ...prev.slice(0, 9)]);

      return true;
    } catch (err) {
      console.error("Error saving mood:", err);
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    todaysMood,
    recentMoods,
    loading,
    saving,
    saveMood,
  };
};