import { motion } from "framer-motion";
import { Palette, Moon, Sun, Monitor, RotateCcw } from "lucide-react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useOnboardingTooltips } from "@/hooks/useOnboardingTooltips";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

export function PreferencesSettings() {
  const { preferences, updatePreferences, isLoading } = useUserPreferences();
  const { resetOnboarding, isOnboardingComplete } = useOnboardingTooltips();
  const { toast } = useToast();

  const handleRestartTour = () => {
    resetOnboarding();
    toast({
      title: "Tour restarted",
      description: "The onboarding tour will show on your next dashboard visit.",
    });
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="w-5 h-5 rounded" />
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card p-6"
    >
      <div className="flex items-center gap-3 mb-6">
        <Palette className="w-5 h-5 text-primary" />
        <h2 className="font-display font-semibold">Preferences</h2>
      </div>

      <div className="space-y-6">
        {/* Theme Selection */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Appearance</Label>
          <p className="text-sm text-muted-foreground">
            Choose how the app looks on your device
          </p>
          
          <RadioGroup
            value={preferences.theme}
            onValueChange={(value) => updatePreferences({ theme: value as "light" | "dark" | "system" })}
            className="grid grid-cols-3 gap-3 pt-2"
          >
            <Label
              htmlFor="theme-light"
              className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                preferences.theme === "light"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <RadioGroupItem value="light" id="theme-light" className="sr-only" />
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <Sun className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-sm font-medium">Light</span>
            </Label>

            <Label
              htmlFor="theme-dark"
              className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                preferences.theme === "dark"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <RadioGroupItem value="dark" id="theme-dark" className="sr-only" />
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
                <Moon className="w-5 h-5 text-slate-200" />
              </div>
              <span className="text-sm font-medium">Dark</span>
            </Label>

            <Label
              htmlFor="theme-system"
              className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                preferences.theme === "system"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <RadioGroupItem value="system" id="theme-system" className="sr-only" />
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-100 to-slate-800 flex items-center justify-center">
                <Monitor className="w-5 h-5 text-foreground" />
              </div>
              <span className="text-sm font-medium">System</span>
            </Label>
          </RadioGroup>
        </div>

        <Separator />

        {/* Onboarding Tour */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Guided Tour</Label>
          <p className="text-sm text-muted-foreground">
            {isOnboardingComplete 
              ? "You've completed the onboarding tour. Restart it to see feature tips again."
              : "The onboarding tour is active and will show feature tips."}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRestartTour}
            className="gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Restart Tour
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
