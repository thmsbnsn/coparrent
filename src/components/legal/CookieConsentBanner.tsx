import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie, X, Settings, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link } from "react-router-dom";

const CONSENT_KEY = "coparrent_cookie_consent";
const CONSENT_VERSION = "1.0";

interface CookiePreferences {
  essential: boolean; // Always true, cannot be disabled
  functional: boolean;
  analytics: boolean;
  version: string;
  timestamp: string;
}

const defaultPreferences: CookiePreferences = {
  essential: true,
  functional: true,
  analytics: false,
  version: CONSENT_VERSION,
  timestamp: new Date().toISOString(),
};

export const CookieConsentBanner = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>(defaultPreferences);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as CookiePreferences;
        // Show banner again if consent version changed
        if (parsed.version !== CONSENT_VERSION) {
          setShowBanner(true);
        }
        setPreferences(parsed);
      } catch {
        setShowBanner(true);
      }
    } else {
      // Small delay before showing to not interrupt initial load
      const timer = setTimeout(() => setShowBanner(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const savePreferences = (prefs: CookiePreferences) => {
    const updated = {
      ...prefs,
      version: CONSENT_VERSION,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(CONSENT_KEY, JSON.stringify(updated));
    setPreferences(updated);
    setShowBanner(false);
    setShowSettings(false);
  };

  const acceptAll = () => {
    savePreferences({
      ...defaultPreferences,
      functional: true,
      analytics: true,
    });
  };

  const acceptEssential = () => {
    savePreferences({
      ...defaultPreferences,
      functional: false,
      analytics: false,
    });
  };

  const saveCustom = () => {
    savePreferences(preferences);
  };

  return (
    <>
      <AnimatePresence>
        {showBanner && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6"
          >
            <div className="mx-auto max-w-4xl">
              <div className="bg-card border border-border rounded-xl shadow-xl p-4 md:p-6">
                <div className="flex items-start gap-4">
                  <div className="hidden sm:flex w-10 h-10 rounded-full bg-primary/10 items-center justify-center shrink-0">
                    <Cookie className="w-5 h-5 text-primary" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground mb-1">
                      Cookie Preferences
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      We use cookies to provide essential functionality and improve your experience. 
                      You can customize your preferences or accept all cookies.{" "}
                      <Link to="/privacy" className="text-primary hover:underline">
                        Learn more
                      </Link>
                    </p>
                    
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={acceptAll}
                        size="sm"
                        className="gap-1.5"
                      >
                        <Check className="w-4 h-4" />
                        Accept All
                      </Button>
                      <Button
                        onClick={acceptEssential}
                        variant="outline"
                        size="sm"
                      >
                        Essential Only
                      </Button>
                      <Button
                        onClick={() => setShowSettings(true)}
                        variant="ghost"
                        size="sm"
                        className="gap-1.5"
                      >
                        <Settings className="w-4 h-4" />
                        Customize
                      </Button>
                    </div>
                  </div>

                  <Button
                    onClick={acceptEssential}
                    variant="ghost"
                    size="icon"
                    className="shrink-0 -mt-1 -mr-1"
                    aria-label="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cookie className="w-5 h-5" />
              Cookie Settings
            </DialogTitle>
            <DialogDescription>
              Manage your cookie preferences. Essential cookies are required for the app to function.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Essential Cookies */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="space-y-0.5">
                <Label className="font-medium">Essential Cookies</Label>
                <p className="text-xs text-muted-foreground">
                  Required for authentication, security, and basic functionality.
                </p>
              </div>
              <Switch checked disabled aria-label="Essential cookies (always enabled)" />
            </div>

            {/* Functional Cookies */}
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="space-y-0.5">
                <Label className="font-medium">Functional Cookies</Label>
                <p className="text-xs text-muted-foreground">
                  Remember your preferences like theme and language settings.
                </p>
              </div>
              <Switch
                checked={preferences.functional}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, functional: checked })
                }
                aria-label="Functional cookies"
              />
            </div>

            {/* Analytics Cookies */}
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="space-y-0.5">
                <Label className="font-medium">Analytics Cookies</Label>
                <p className="text-xs text-muted-foreground">
                  Help us understand how you use CoParrent to improve the experience.
                </p>
              </div>
              <Switch
                checked={preferences.analytics}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, analytics: checked })
                }
                aria-label="Analytics cookies"
              />
            </div>

            {/* Privacy Note */}
            <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded-lg">
              <strong>Privacy First:</strong> CoParrent never sells your data. 
              Analytics data is anonymized and used only to improve app functionality. 
              Child accounts have no analytics tracking.
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowSettings(false)}>
              Cancel
            </Button>
            <Button onClick={saveCustom}>
              Save Preferences
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// Hook to check cookie consent status
export const useCookieConsent = () => {
  const [consent, setConsent] = useState<CookiePreferences | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (stored) {
      try {
        setConsent(JSON.parse(stored));
      } catch {
        setConsent(null);
      }
    }
  }, []);

  return {
    hasConsent: consent !== null,
    preferences: consent,
    canUseAnalytics: consent?.analytics ?? false,
    canUseFunctional: consent?.functional ?? false,
  };
};
