import { useState, useEffect } from "react";
import { RefreshCw, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useRegisterSW } from "virtual:pwa-register/react";

export const PWAUpdatePrompt = () => {
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      console.log("SW registered:", swUrl);
      // Check for updates every hour
      if (registration) {
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error("SW registration error:", error);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      setShowUpdatePrompt(true);
    }
  }, [needRefresh]);

  const handleUpdate = () => {
    updateServiceWorker(true);
  };

  const handleDismiss = () => {
    setShowUpdatePrompt(false);
    setNeedRefresh(false);
  };

  if (!showUpdatePrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        className="fixed top-4 left-4 right-4 z-[100] sm:left-auto sm:right-4 sm:max-w-sm"
      >
        <div className="bg-card border border-border rounded-xl shadow-xl p-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-info/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <RefreshCw className="h-5 w-5 text-info" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm mb-1">Update Available</h3>
              <p className="text-xs text-muted-foreground mb-3">
                A new version of CoParrent is ready. Refresh to get the latest features.
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleUpdate}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Refresh
                </Button>
                <Button size="sm" variant="ghost" onClick={handleDismiss}>
                  Later
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
