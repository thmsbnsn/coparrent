import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "coparrent_onboarding_dismissed";

export interface OnboardingTooltip {
  id: string;
  targetId: string;
  title: string;
  description: string;
  position?: "top" | "bottom" | "left" | "right";
  order: number;
}

export const ONBOARDING_TOOLTIPS: OnboardingTooltip[] = [
  {
    id: "calendar",
    targetId: "nav-calendar",
    title: "Custody Calendar",
    description: "View and manage your shared custody schedule. Set up exchange times and track parenting days.",
    position: "right",
    order: 1,
  },
  {
    id: "messages",
    targetId: "nav-messages",
    title: "Messaging Hub",
    description: "Communicate with your co-parent in a documented, respectful way. All messages are saved.",
    position: "right",
    order: 2,
  },
  {
    id: "children",
    targetId: "nav-children",
    title: "Children Profiles",
    description: "Store important info about your kids - medical records, school contacts, and more.",
    position: "right",
    order: 3,
  },
  {
    id: "expenses",
    targetId: "nav-expenses",
    title: "Expense Tracking",
    description: "Track and split child-related expenses fairly. Request reimbursements with receipts.",
    position: "right",
    order: 4,
  },
  {
    id: "journal",
    targetId: "nav-journal",
    title: "Private Journal",
    description: "Keep private notes about exchanges, moods, and observations. Only you can see these.",
    position: "right",
    order: 5,
  },
];

interface OnboardingState {
  dismissed: string[];
  completedAt?: string;
}

export function useOnboardingTooltips() {
  const { user } = useAuth();
  const [currentTooltipIndex, setCurrentTooltipIndex] = useState(0);
  const [dismissedTooltips, setDismissedTooltips] = useState<string[]>([]);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Load dismissed state from localStorage (synced with profile preferences)
  useEffect(() => {
    const loadState = async () => {
      setIsLoading(true);
      
      // First check localStorage for quick loading
      const localState = localStorage.getItem(STORAGE_KEY);
      let localParsed: OnboardingState | null = null;
      
      if (localState) {
        try {
          localParsed = JSON.parse(localState);
          if (localParsed) {
            setDismissedTooltips(localParsed.dismissed || []);
            setIsOnboardingComplete(!!localParsed.completedAt);
          }
        } catch {
          // Invalid JSON, reset
          localStorage.removeItem(STORAGE_KEY);
        }
      }

      // If user is logged in, sync with database
      if (user) {
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("preferences")
            .eq("user_id", user.id)
            .maybeSingle();

          if (profile?.preferences) {
            const prefs = profile.preferences as Record<string, unknown>;
            const onboarding = prefs.onboarding_tooltips as OnboardingState | undefined;
            
            if (onboarding) {
              setDismissedTooltips(onboarding.dismissed || []);
              setIsOnboardingComplete(!!onboarding.completedAt);
              // Sync to localStorage
              localStorage.setItem(STORAGE_KEY, JSON.stringify(onboarding));
            } else {
              // New user - show onboarding
              setIsOnboardingComplete(false);
              setDismissedTooltips([]);
            }
          } else {
            // New user - show onboarding
            setIsOnboardingComplete(false);
            setDismissedTooltips([]);
          }
        } catch (error) {
          console.error("Failed to load onboarding state:", error);
        }
      }
      
      setIsLoading(false);
    };

    loadState();
  }, [user]);

  // Persist state changes
  const persistState = useCallback(async (state: OnboardingState) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    if (user) {
      try {
        // Get current preferences
        const { data: profile } = await supabase
          .from("profiles")
          .select("preferences")
          .eq("user_id", user.id)
          .maybeSingle();

        const currentPrefs = (profile?.preferences as Record<string, unknown>) || {};
        
        // Convert state to JSON-compatible format
        const onboardingState: Record<string, unknown> = {
          dismissed: state.dismissed,
        };
        if (state.completedAt) {
          onboardingState.completedAt = state.completedAt;
        }
        
        await supabase
          .from("profiles")
          .update({
            preferences: JSON.parse(JSON.stringify({
              ...currentPrefs,
              onboarding_tooltips: onboardingState,
            })),
          })
          .eq("user_id", user.id);
      } catch (error) {
        console.error("Failed to persist onboarding state:", error);
      }
    }
  }, [user]);

  const dismissTooltip = useCallback((tooltipId: string) => {
    setDismissedTooltips((prev) => {
      const updated = [...prev, tooltipId];
      const allDismissed = ONBOARDING_TOOLTIPS.every((t) => updated.includes(t.id));
      
      const newState: OnboardingState = {
        dismissed: updated,
        completedAt: allDismissed ? new Date().toISOString() : undefined,
      };
      
      persistState(newState);
      
      if (allDismissed) {
        setIsOnboardingComplete(true);
      }
      
      return updated;
    });
    
    // Move to next tooltip
    setCurrentTooltipIndex((prev) => prev + 1);
  }, [persistState]);

  const dismissAll = useCallback(() => {
    const allIds = ONBOARDING_TOOLTIPS.map((t) => t.id);
    setDismissedTooltips(allIds);
    setIsOnboardingComplete(true);
    
    persistState({
      dismissed: allIds,
      completedAt: new Date().toISOString(),
    });
  }, [persistState]);

  const resetOnboarding = useCallback(() => {
    setDismissedTooltips([]);
    setIsOnboardingComplete(false);
    setCurrentTooltipIndex(0);
    
    persistState({
      dismissed: [],
    });
  }, [persistState]);

  const activeTooltips = ONBOARDING_TOOLTIPS.filter(
    (t) => !dismissedTooltips.includes(t.id)
  );

  const currentTooltip = activeTooltips[0] || null;

  return {
    tooltips: ONBOARDING_TOOLTIPS,
    activeTooltips,
    currentTooltip,
    currentTooltipIndex,
    dismissedTooltips,
    isOnboardingComplete,
    isLoading,
    dismissTooltip,
    dismissAll,
    resetOnboarding,
  };
}
