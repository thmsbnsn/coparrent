import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface NotificationPreferences {
  enabled: boolean;
  schedule_changes: boolean;
  new_messages: boolean;
  upcoming_exchanges: boolean;
  exchange_reminder_24h: boolean;
  exchange_reminder_2h: boolean;
  exchange_reminder_30min: boolean;
  document_uploads: boolean;
  child_info_updates: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: true,
  schedule_changes: true,
  new_messages: true,
  upcoming_exchanges: true,
  exchange_reminder_24h: true,
  exchange_reminder_2h: true,
  exchange_reminder_30min: true,
  document_uploads: true,
  child_info_updates: true,
};

export const useNotifications = () => {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [permissionState, setPermissionState] = useState<NotificationPermission>("default");
  const [loading, setLoading] = useState(true);

  // Check browser notification permission
  useEffect(() => {
    if ("Notification" in window) {
      setPermissionState(Notification.permission);
    }
  }, []);

  // Fetch preferences from database
  useEffect(() => {
    const fetchPreferences = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("notification_preferences")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profile?.notification_preferences) {
          setPreferences({
            ...DEFAULT_PREFERENCES,
            ...(profile.notification_preferences as unknown as NotificationPreferences)
          });
        }
      } catch (error) {
        console.error("Error fetching notification preferences:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPreferences();
  }, [user]);

  // Request notification permission
  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) {
      console.log("This browser does not support notifications");
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setPermissionState(permission);
      return permission === "granted";
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      return false;
    }
  }, []);

  // Update preferences in database
  const updatePreferences = useCallback(async (newPreferences: Partial<NotificationPreferences>) => {
    if (!user) return false;

    const updatedPreferences = { ...preferences, ...newPreferences };
    
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ notification_preferences: updatedPreferences })
        .eq("user_id", user.id);

      if (error) throw error;

      setPreferences(updatedPreferences);
      return true;
    } catch (error) {
      console.error("Error updating notification preferences:", error);
      return false;
    }
  }, [user, preferences]);

  // Toggle all notifications
  const toggleAllNotifications = useCallback(async (enabled: boolean) => {
    return updatePreferences({
      enabled,
      schedule_changes: enabled,
      new_messages: enabled,
      upcoming_exchanges: enabled,
      exchange_reminder_24h: enabled,
      exchange_reminder_2h: enabled,
      exchange_reminder_30min: enabled,
      document_uploads: enabled,
      child_info_updates: enabled,
    });
  }, [updatePreferences]);

  // Send a notification
  const sendNotification = useCallback(async (
    type: keyof Omit<NotificationPreferences, 'enabled'>,
    title: string,
    body: string,
    options?: NotificationOptions
  ) => {
    // Check if notifications are enabled globally and for this type
    if (!preferences.enabled || !preferences[type]) {
      console.log(`Notification blocked: enabled=${preferences.enabled}, ${type}=${preferences[type]}`);
      return false;
    }

    // Check browser permission
    if (permissionState !== "granted") {
      console.log("Browser notifications not permitted");
      return false;
    }

    try {
      const notification = new Notification(title, {
        body,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        ...options,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      return true;
    } catch (error) {
      console.error("Error sending notification:", error);
      return false;
    }
  }, [preferences, permissionState]);

  return {
    preferences,
    permissionState,
    loading,
    requestPermission,
    updatePreferences,
    toggleAllNotifications,
    sendNotification,
  };
};
