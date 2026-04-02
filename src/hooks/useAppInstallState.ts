import { useCallback, useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type WindowWithMSStream = Window & {
  MSStream?: unknown;
};

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

export type AppInstallState = "installed" | "promptable" | "ios_manual" | "browser_manual";

const isIosDevice = () =>
  typeof navigator !== "undefined" &&
  /iPad|iPhone|iPod/.test(navigator.userAgent) &&
  !(window as WindowWithMSStream).MSStream;

const isStandaloneDisplayMode = () => {
  if (typeof window === "undefined") {
    return false;
  }

  if (typeof window.matchMedia !== "function") {
    return Boolean((navigator as NavigatorWithStandalone).standalone);
  }

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as NavigatorWithStandalone).standalone)
  );
};

export const useAppInstallState = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(display-mode: standalone)")
        : null;
    const handleDisplayModeChange = () => {
      setIsInstalled(isStandaloneDisplayMode());
    };
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
    };

    setIsIOS(isIosDevice());
    setIsInstalled(isStandaloneDisplayMode());

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    mediaQuery?.addEventListener?.("change", handleDisplayModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      mediaQuery?.removeEventListener?.("change", handleDisplayModeChange);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) {
      return null;
    }

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    setDeferredPrompt(null);
    if (outcome === "accepted") {
      setIsInstalled(true);
    }

    return outcome;
  }, [deferredPrompt]);

  const installState: AppInstallState = isInstalled
    ? "installed"
    : deferredPrompt
      ? "promptable"
      : isIOS
        ? "ios_manual"
        : "browser_manual";

  return {
    installState,
    isIOS,
    isInstalled,
    canPromptInstall: Boolean(deferredPrompt),
    promptInstall,
  };
};
