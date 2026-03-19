import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface DeviceInfo {
  deviceFingerprint: string;
  deviceName: string;
  browser: string;
  os: string;
}

const generateDeviceFingerprint = (): string => {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.fillText("fingerprint", 2, 2);
  }
  
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width + "x" + screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    !!window.sessionStorage,
    !!window.localStorage,
    navigator.hardwareConcurrency || "unknown",
  ].join("|");

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
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

      console.log("Checking login notification for device:", { deviceName, browser, os });

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

      console.log("Login notification result:", data);
      return { success: true, isNewDevice: data?.isNewDevice || false };
    } catch (error) {
      console.error("Error in login notification:", error);
      return { success: false, isNewDevice: false };
    }
  }, []);

  return { checkAndNotifyLogin };
};
