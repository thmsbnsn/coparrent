import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface DeviceInfo {
  deviceFingerprint: string;
  deviceName: string;
  browser: string;
  os: string;
}

const DEVICE_FINGERPRINT_STORAGE_KEY = "coparrent_device_fingerprint";

const hashFingerprint = (value: string): string => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  return Math.abs(hash).toString(36);
};

const buildDeviceFingerprintSeed = (): string => {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown";
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    userAgentData?: { platform?: string; brands?: Array<{ brand: string }> };
  };

  const brandList = nav.userAgentData?.brands?.map((brand) => brand.brand).join(",") || "";
  const platform = nav.userAgentData?.platform || navigator.platform || "unknown";

  return [
    navigator.userAgent,
    platform,
    navigator.language,
    timezone,
    navigator.hardwareConcurrency || "unknown",
    navigator.maxTouchPoints || 0,
    nav.deviceMemory || "unknown",
    brandList,
  ].join("|");
};

const generateDeviceFingerprint = (): string => {
  try {
    const storedFingerprint = window.localStorage.getItem(DEVICE_FINGERPRINT_STORAGE_KEY);
    if (storedFingerprint) {
      return storedFingerprint;
    }
  } catch {
    // Ignore storage access issues and fall back to a computed fingerprint.
  }

  const fingerprint = hashFingerprint(buildDeviceFingerprintSeed());

  try {
    window.localStorage.setItem(DEVICE_FINGERPRINT_STORAGE_KEY, fingerprint);
  } catch {
    // Ignore storage access issues and return the computed fingerprint.
  }

  return fingerprint;
};

const parseUserAgent = (): { browser: string; os: string; deviceName: string } => {
  const ua = navigator.userAgent;
  
  // Detect browser
  let browser = "Unknown Browser";
  if (ua.includes("Firefox")) {
    browser = "Firefox";
  } else if (ua.includes("Edg")) {
    browser = "Microsoft Edge";
  } else if (ua.includes("Chrome")) {
    browser = "Chrome";
  } else if (ua.includes("Safari")) {
    browser = "Safari";
  } else if (ua.includes("Opera") || ua.includes("OPR")) {
    browser = "Opera";
  }

  // Detect OS
  let os = "Unknown OS";
  if (ua.includes("Windows")) {
    os = "Windows";
  } else if (ua.includes("Mac OS")) {
    os = "macOS";
  } else if (ua.includes("Linux")) {
    os = "Linux";
  } else if (ua.includes("Android")) {
    os = "Android";
  } else if (ua.includes("iOS") || ua.includes("iPhone") || ua.includes("iPad")) {
    os = "iOS";
  }

  // Generate device name
  let deviceType = "Desktop";
  if (/Mobile|Android|iPhone/i.test(ua)) {
    deviceType = "Mobile";
  } else if (/iPad|Tablet/i.test(ua)) {
    deviceType = "Tablet";
  }

  const deviceName = `${deviceType} - ${os}`;

  return { browser, os, deviceName };
};

export const useLoginNotification = () => {
  const checkAndNotifyLogin = useCallback(async (userId: string, userEmail: string) => {
    try {
      const { browser, os, deviceName } = parseUserAgent();
      const deviceFingerprint = generateDeviceFingerprint();

      const { data, error } = await supabase.functions.invoke("login-notification", {
        body: {
          userId,
          userEmail,
          deviceFingerprint,
          deviceName,
          browser,
          os,
        },
      });

      if (error) {
        console.error("Error checking login notification:", error);
        return { success: false, isNewDevice: false };
      }

      return { success: true, isNewDevice: data?.isNewDevice || false };
    } catch (error) {
      console.error("Error in login notification:", error);
      return { success: false, isNewDevice: false };
    }
  }, []);

  return { checkAndNotifyLogin };
};
