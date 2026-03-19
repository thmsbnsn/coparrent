import { useOnboardingTooltips, ONBOARDING_TOOLTIPS } from "@/hooks/useOnboardingTooltips";
import { OnboardingTooltip } from "./OnboardingTooltip";

export function OnboardingOverlay() {
  const {
    currentTooltip,
    dismissedTooltips,
    isOnboardingComplete,
    isLoading,
    dismissTooltip,
    dismissAll,
  } = useOnboardingTooltips();

  // Don't render anything if loading or onboarding is complete
  if (isLoading || isOnboardingComplete || !currentTooltip) {
    return null;
  }

  const currentIndex = ONBOARDING_TOOLTIPS.findIndex(
    (t) => t.id === currentTooltip.id
  );

  return (
    <>
      {/* Semi-transparent backdrop */}
      <div 
        className="fixed inset-0 bg-background/40 backdrop-blur-[2px] z-[9998] pointer-events-none"
        aria-hidden="true"
      />
      
      {/* Tooltip */}
      <OnboardingTooltip
        tooltip={currentTooltip}
        totalCount={ONBOARDING_TOOLTIPS.length}
        currentIndex={currentIndex}
        onDismiss={dismissTooltip}
        onSkipAll={dismissAll}
      />
    </>
  );
}
