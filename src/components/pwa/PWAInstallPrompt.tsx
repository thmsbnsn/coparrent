import { useState, useEffect } from "react";
import { Download, X, Smartphone } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type WindowWithMSStream = Window & {
  MSStream?: unknown;
};

export const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Check if already installed or dismissed
    const dismissed = localStorage.getItem("pwa-install-dismissed");
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    
    if (dismissed || isStandalone) {
      return;
    }

    // Detect iOS
    const isIOSDevice =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as WindowWithMSStream).MSStream;
    setIsIOS(isIOSDevice);

    // Show iOS prompt after a delay
    if (isIOSDevice && !isStandalone) {
      const timer = setTimeout(() => setShowIOSInstructions(true), 3000);
      return () => clearTimeout(timer);
    }

    // Handle beforeinstallprompt for Android/Desktop
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show prompt after a delay
      setTimeout(() => setShowPrompt(true), 2000);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setShowIOSInstructions(false);
    localStorage.setItem("pwa-install-dismissed", "true");
  };

  // iOS Instructions Modal
  if (isIOS && showIOSInstructions) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/50 flex items-end sm:items-center justify-center p-4"
        >
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="bg-card rounded-xl shadow-xl w-full max-w-md p-6 relative"
          >
            <button
              onClick={handleDismiss}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <Smartphone className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Install CoParrent</h3>
                <p className="text-sm text-muted-foreground">Add to your home screen</p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium flex-shrink-0">
                  1
                </div>
                <p className="text-sm">
                  Tap the <strong>Share</strong> button{" "}
                  <span className="inline-block w-5 h-5 align-middle">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-primary">
                      <path d="M12 2L8 6h3v8h2V6h3L12 2zm-7 9v11h14V11h-2v9H7v-9H5z"/>
                    </svg>
                  </span>{" "}
                  in Safari
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium flex-shrink-0">
                  2
                </div>
                <p className="text-sm">
                  Scroll down and tap <strong>"Add to Home Screen"</strong>
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium flex-shrink-0">
                  3
                </div>
                <p className="text-sm">
                  Tap <strong>"Add"</strong> to install CoParrent
                </p>
              </div>
            </div>

            <Button onClick={handleDismiss} variant="outline" className="w-full">
              Got it
            </Button>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Standard install prompt for Android/Desktop
  if (!showPrompt || !deferredPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-4 left-4 right-4 z-[100] sm:left-auto sm:right-4 sm:max-w-sm"
      >
        <div className="bg-card border border-border rounded-xl shadow-xl p-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <Download className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm mb-1">Install CoParrent</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Install our app for quick access and offline support.
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleInstall}>
                  Install
                </Button>
                <Button size="sm" variant="ghost" onClick={handleDismiss}>
                  Not now
                </Button>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
