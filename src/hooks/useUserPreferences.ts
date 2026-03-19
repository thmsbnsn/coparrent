import { useState, useEffect, useCallback } from "react";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface UserPreferences {
  theme: "light" | "dark" | "system";
}

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "system",
};

export function useUserPreferences() {
  const { user } = useAuth();
  const { setTheme } = useTheme();
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);

  // Load preferences from database
  useEffect(() => {
    async function loadPreferences() {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("preferences")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profile?.preferences) {
          const rawPrefs = profile.preferences as Record<string, unknown>;
          const prefs: UserPreferences = {
            theme: (rawPrefs.theme as UserPreferences["theme"]) || "system",
          };
          setPreferences(prefs);
          // Apply theme from saved preferences
          if (prefs.theme) {
            setTheme(prefs.theme);
          }
        }
      } catch (error) {
        console.error("Failed to load preferences:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadPreferences();
  }, [user, setTheme]);

  // Update preferences in database
  const updatePreferences = useCallback(
    async (updates: Partial<UserPreferences>) => {
      const newPreferences = { ...preferences, ...updates };
      setPreferences(newPreferences);

      // Apply theme immediately
      if (updates.theme) {
        setTheme(updates.theme);
      }

      if (!user) return;

      try {
        await supabase
          .from("profiles")
          .update({ preferences: newPreferences })
          .eq("user_id", user.id);
      } catch (error) {
        console.error("Failed to save preferences:", error);
      }
    },
    [preferences, user, setTheme]
  );

  // Cycle through themes
  const cycleTheme = useCallback(() => {
    const themes: Array<"light" | "dark" | "system"> = ["light", "dark", "system"];
    const currentIndex = themes.indexOf(preferences.theme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    updatePreferences({ theme: nextTheme });
  }, [preferences.theme, updatePreferences]);

  return {
    preferences,
    updatePreferences,
    cycleTheme,
    isLoading,
  };
}
