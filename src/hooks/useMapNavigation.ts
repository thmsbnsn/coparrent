import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type MapProvider = "google" | "apple" | "waze" | "system";

interface MapPreferences {
  preferred_map_provider: MapProvider;
  remember_choice: boolean;
}

export const useMapNavigation = () => {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<MapPreferences>({
    preferred_map_provider: "system",
    remember_choice: false,
  });
  const [loading, setLoading] = useState(true);

  // Detect if user is on iOS
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  useEffect(() => {
    const fetchPreferences = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        const { data } = await supabase
          .from("user_map_preferences")
          .select("preferred_map_provider, remember_choice")
          .eq("user_id", user.id)
          .single();

        if (data) {
          setPreferences({
            preferred_map_provider: data.preferred_map_provider as MapProvider,
            remember_choice: data.remember_choice,
          });
        }
      } catch (error) {
        // No preferences saved yet, use defaults
      } finally {
        setLoading(false);
      }
    };

    fetchPreferences();
  }, [user?.id]);

  const savePreferences = useCallback(async (
    provider: MapProvider,
    remember: boolean
  ): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const { error } = await supabase
        .from("user_map_preferences")
        .upsert({
          user_id: user.id,
          preferred_map_provider: provider,
          remember_choice: remember,
        }, { onConflict: "user_id" });

      if (error) throw error;

      setPreferences({
        preferred_map_provider: provider,
        remember_choice: remember,
      });

      return true;
    } catch (error) {
      console.error("Error saving map preferences:", error);
      return false;
    }
  }, [user?.id]);

  const getMapUrl = useCallback((address: string, provider?: MapProvider): string => {
    const encodedAddress = encodeURIComponent(address);
    const useProvider = provider || preferences.preferred_map_provider;

    switch (useProvider) {
      case "google":
        return `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;
      case "apple":
        return `https://maps.apple.com/?daddr=${encodedAddress}`;
      case "waze":
        return `https://waze.com/ul?q=${encodedAddress}&navigate=yes`;
      case "system":
      default:
        // On iOS, prefer Apple Maps; otherwise, Google Maps
        if (isIOS) {
          return `https://maps.apple.com/?daddr=${encodedAddress}`;
        }
        return `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;
    }
  }, [preferences.preferred_map_provider, isIOS]);

  const openDirections = useCallback((
    address: string,
    provider?: MapProvider
  ) => {
    const url = getMapUrl(address, provider);
    window.open(url, "_blank");
  }, [getMapUrl]);

  return {
    preferences,
    loading,
    isIOS,
    savePreferences,
    getMapUrl,
    openDirections,
  };
};

export const MAP_PROVIDERS: { value: MapProvider; label: string; icon: string }[] = [
  { value: "google", label: "Google Maps", icon: "🗺️" },
  { value: "apple", label: "Apple Maps", icon: "🍎" },
  { value: "waze", label: "Waze", icon: "🚗" },
  { value: "system", label: "System Default", icon: "📍" },
];
