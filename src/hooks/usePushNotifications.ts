import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface PushSubscriptionState {
  isSupported: boolean;
  isSubscribed: boolean;
  subscription: PushSubscription | null;
  permission: NotificationPermission;
  isiOS: boolean;
  isiOSPWA: boolean;
  isPWA: boolean;
}

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

const getNavigatorWithStandalone = (): NavigatorWithStandalone =>
  window.navigator as NavigatorWithStandalone;

const getErrorName = (error: unknown): string =>
  error instanceof Error ? error.name : "";

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "";

// Feature detection utilities
const detectiOS = (): boolean => {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
};

const detectiOSPWA = (): boolean => {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  // Check if running as installed PWA on iOS
  return detectiOS() && getNavigatorWithStandalone().standalone === true;
};

const detectPWA = (): boolean => {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches ||
    getNavigatorWithStandalone().standalone === true ||
    document.referrer.includes("android-app://");
};

const checkPushSupport = (): { supported: boolean; reason?: string } => {
  if (typeof window === "undefined") {
    return { supported: false, reason: "Not in browser environment" };
  }

  if (!("serviceWorker" in navigator)) {
    return { supported: false, reason: "Service Workers not supported" };
  }

  if (!("Notification" in window)) {
    return { supported: false, reason: "Notifications not supported" };
  }

  // iOS Safari 16.4+ supports Web Push in PWA mode
  const isiOS = detectiOS();
  const isPWA = detectPWA();
  
  if (isiOS && !isPWA) {
    return { 
      supported: false, 
      reason: "On iOS, add this app to your Home Screen first to enable notifications" 
    };
  }

  if (!("PushManager" in window)) {
    // iOS Safari without PushManager - check for Notification API as fallback
    if ("Notification" in window) {
      return { supported: true, reason: "Using Notification API fallback" };
    }
    return { supported: false, reason: "Push notifications not supported" };
  }

  return { supported: true };
};

export const usePushNotifications = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [state, setState] = useState<PushSubscriptionState>({
    isSupported: false,
    isSubscribed: false,
    subscription: null,
    permission: "default",
    isiOS: false,
    isiOSPWA: false,
    isPWA: false,
  });
  const [loading, setLoading] = useState(true);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [unsupportedReason, setUnsupportedReason] = useState<string>();

  // Check if push notifications are supported
  useEffect(() => {
    const checkSupport = () => {
      const isiOS = detectiOS();
      const isiOSPWA = detectiOSPWA();
      const isPWA = detectPWA();
      const { supported, reason } = checkPushSupport();

      setState((prev) => ({
        ...prev,
        isSupported: supported,
        permission: "Notification" in window ? Notification.permission : "denied",
        isiOS,
        isiOSPWA,
        isPWA,
      }));

      if (!supported && reason) {
        setUnsupportedReason(reason);
      }
    };

    checkSupport();

    // Re-check when display mode changes (user installs PWA)
    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const handleDisplayModeChange = () => checkSupport();
    mediaQuery.addEventListener("change", handleDisplayModeChange);

    return () => {
      mediaQuery.removeEventListener("change", handleDisplayModeChange);
    };
  }, []);

  // Get profile ID
  useEffect(() => {
    const fetchProfileId = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile) {
        setProfileId(profile.id);
      }
      setLoading(false);
    };

    fetchProfileId();
  }, [user]);

  // Check existing subscription
  useEffect(() => {
    const checkSubscription = async () => {
      if (!state.isSupported) return;

      try {
        // Check if PushManager is available
        if ("PushManager" in window && "serviceWorker" in navigator) {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();

          setState((prev) => ({
            ...prev,
            isSubscribed: !!subscription,
            subscription,
          }));
        } else {
          // Fallback: check localStorage for notification preference
          const localPref = localStorage.getItem("coparrent-notifications-enabled");
          if (localPref === "true") {
            setState((prev) => ({ ...prev, isSubscribed: true }));
          }
        }
      } catch (error) {
        console.error("Error checking push subscription:", error);
      }
    };

    checkSubscription();
  }, [state.isSupported]);

  // Register service worker
  const registerServiceWorker = useCallback(async () => {
    if (!("serviceWorker" in navigator)) {
      throw new Error("Service workers are not supported");
    }

    try {
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });
      console.log("Service Worker registered:", registration.scope);
      
      // Wait for the service worker to be ready
      await navigator.serviceWorker.ready;
      
      return registration;
    } catch (error) {
      console.error("Service Worker registration failed:", error);
      throw error;
    }
  }, []);

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!("Notification" in window)) {
      toast({
        title: "Not Supported",
        description: "Notifications are not supported in this browser.",
        variant: "destructive",
      });
      return false;
    }

    // iOS PWA-specific prompt
    if (state.isiOS && !state.isPWA) {
      toast({
        title: "Install Required",
        description: "Add CoParrent to your Home Screen to enable push notifications.",
      });
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setState((prev) => ({ ...prev, permission }));

      if (permission === "granted") {
        return true;
      } else if (permission === "denied") {
        toast({
          title: "Notifications Blocked",
          description: state.isiOS 
            ? "Open Settings → CoParrent → Notifications to enable."
            : "Enable notifications in your browser settings.",
          variant: "destructive",
        });
      }
      return false;
    } catch (error) {
      console.error("Error requesting permission:", error);
      return false;
    }
  }, [state.isiOS, state.isPWA, toast]);

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!profileId) {
      toast({
        title: "Not Ready",
        description: "Please wait while we load your profile.",
        variant: "destructive",
      });
      return false;
    }

    if (!state.isSupported) {
      toast({
        title: "Not Supported",
        description: unsupportedReason || "Push notifications are not available.",
        variant: "destructive",
      });
      return false;
    }

    try {
      // Request permission if not granted
      if (Notification.permission !== "granted") {
        const granted = await requestPermission();
        if (!granted) return false;
      }

      // Try Web Push API first (works on iOS 16.4+ PWA and other browsers)
      if ("PushManager" in window) {
        try {
          const registration = await registerServiceWorker();
          
          // Subscribe without VAPID key (will use browser's built-in push)
          // In production, you'd use a VAPID key here
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
          });

          setState((prev) => ({
            ...prev,
            isSubscribed: true,
            subscription,
          }));

          // Store subscription state
          localStorage.setItem("coparrent-notifications-enabled", "true");

          toast({
            title: "Notifications Enabled",
            description: "You'll now receive push notifications.",
          });

          return true;
        } catch (pushError: unknown) {
          console.warn("PushManager subscribe failed, using fallback:", pushError);
          const pushErrorMessage = getErrorMessage(pushError);
          const pushErrorName = getErrorName(pushError);

          // Check if it's a VAPID key issue - still enable local notifications
          if (pushErrorMessage.includes("applicationServerKey") || pushErrorName === "InvalidStateError") {
            localStorage.setItem("coparrent-notifications-enabled", "true");
            setState((prev) => ({ ...prev, isSubscribed: true }));
            
            toast({
              title: "Notifications Enabled",
              description: "Browser notifications are now active.",
            });
            return true;
          }
          
          throw pushError instanceof Error
            ? pushError
            : new Error("Push notification subscription failed.");
        }
      } else {
        // Fallback for browsers without PushManager but with Notification API
        localStorage.setItem("coparrent-notifications-enabled", "true");
        setState((prev) => ({ ...prev, isSubscribed: true }));
        
        toast({
          title: "Notifications Enabled",
          description: "You'll receive in-app notifications.",
        });
        return true;
      }
    } catch (error: unknown) {
      console.error("Error subscribing to push:", error);
      const errorName = getErrorName(error);

      if (errorName === "NotAllowedError") {
        toast({
          title: "Permission Denied",
          description: "Please allow notifications in your settings.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Subscription Failed",
          description: "Could not enable push notifications. Try again later.",
          variant: "destructive",
        });
      }
      return false;
    }
  }, [state.isSupported, profileId, requestPermission, registerServiceWorker, toast, unsupportedReason]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    try {
      if (state.subscription) {
        await state.subscription.unsubscribe();
      }

      localStorage.removeItem("coparrent-notifications-enabled");

      setState((prev) => ({
        ...prev,
        isSubscribed: false,
        subscription: null,
      }));

      toast({
        title: "Notifications Disabled",
        description: "You will no longer receive push notifications.",
      });

      return true;
    } catch (error) {
      console.error("Error unsubscribing:", error);
      toast({
        title: "Error",
        description: "Could not disable notifications. Try again later.",
        variant: "destructive",
      });
      return false;
    }
  }, [state.subscription, toast]);

  // Send a local notification (for testing or immediate feedback)
  const sendLocalNotification = useCallback(
    async (title: string, options?: NotificationOptions) => {
      if (Notification.permission !== "granted") {
        const granted = await requestPermission();
        if (!granted) return false;
      }

      try {
        // Try using service worker first (required for iOS PWA)
        if ("serviceWorker" in navigator) {
          const registration = await navigator.serviceWorker.ready;
          
          // Use postMessage to trigger notification from SW (iOS compatible)
          if (registration.active) {
            registration.active.postMessage({
              type: "SHOW_NOTIFICATION",
              title,
              options: {
                body: options?.body,
                tag: options?.tag || "coparrent-local",
                data: options?.data,
                silent: options?.silent,
              },
            });
            return true;
          }
          
          // Fallback to showNotification
          await registration.showNotification(title, {
            icon: "/pwa-192x192.png",
            badge: "/pwa-192x192.png",
            ...options,
          });
          return true;
        }
        
        // Final fallback: regular Notification API
        new Notification(title, {
          icon: "/pwa-192x192.png",
          ...options,
        });
        return true;
      } catch (error) {
        console.error("Error showing notification:", error);
        return false;
      }
    },
    [requestPermission]
  );

  return {
    ...state,
    loading,
    unsupportedReason,
    subscribe,
    unsubscribe,
    requestPermission,
    sendLocalNotification,
  };
};
