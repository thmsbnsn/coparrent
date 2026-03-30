import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Bug } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MotionPermissionPrompt } from "@/components/feedback/MotionPermissionPrompt";
import {
  ReportProblemModal,
  type ReportProblemFormValues,
} from "@/components/feedback/ReportProblemModal";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useShakeDetection } from "@/hooks/useShakeDetection";
import { useToast } from "@/hooks/use-toast";
import {
  getMotionPermissionStateFromSupport,
  getMotionSupportSnapshot,
} from "@/lib/problem-report/deviceMotion";
import {
  buildProblemReportPayload,
  type ProblemReportSource,
} from "@/lib/problem-report/payload";
import {
  getProblemReportPreferences,
  updateProblemReportPreferences,
} from "@/lib/problem-report/preferences";
import { submitProblemReport } from "@/lib/problem-report/submitProblemReport";
import { ProblemReportContext } from "@/components/feedback/ProblemReportSharedContext";

export const ProblemReportProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { pathname, search, hash } = useLocation();
  const { toast } = useToast();
  const isMobileViewport = useIsMobile();
  const [modalOpen, setModalOpen] = useState(false);
  const [preferences, setPreferences] = useState(() =>
    getProblemReportPreferences(),
  );
  const [source, setSource] = useState<ProblemReportSource>("manual");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const motionSupport = useMemo(() => {
    const snapshot = getMotionSupportSnapshot();

    return {
      ...snapshot,
      likelyMobile: snapshot.likelyMobile || isMobileViewport,
    };
  }, [isMobileViewport]);
  const routePath = `${pathname}${search}${hash}`;

  useEffect(() => {
    const nextPermissionState = getMotionPermissionStateFromSupport(
      motionSupport,
      preferences.motionPermissionState,
    );

    if (nextPermissionState !== preferences.motionPermissionState) {
      setPreferences((current) => {
        const updated = updateProblemReportPreferences({
          motionPermissionState: nextPermissionState,
          shakeEnabled:
            nextPermissionState === "unsupported" ? false : current.shakeEnabled,
        });
        return updated;
      });
    }
  }, [motionSupport, preferences.motionPermissionState]);

  const openReportModal = useCallback((nextSource: ProblemReportSource = "manual") => {
    setSource(nextSource);
    setSubmitError(null);
    setModalOpen(true);
  }, []);

  const disableShakeReporting = useCallback(() => {
    const next = updateProblemReportPreferences({ shakeEnabled: false });
    setPreferences(next);
    toast({
      title: "Shake reporting turned off",
      description: "You can still use the manual report button anytime.",
    });
  }, [toast]);

  const enableShakeReporting = useCallback(async () => {
    if (
      !motionSupport.supported ||
      !motionSupport.likelyMobile ||
      !motionSupport.secure
    ) {
      return false;
    }

    try {
      if (motionSupport.permissionRequired) {
        const motionEvent = window.DeviceMotionEvent as typeof DeviceMotionEvent & {
          requestPermission?: () => Promise<"granted" | "denied">;
        };
        const permission = await motionEvent.requestPermission?.();

        if (permission !== "granted") {
          const next = updateProblemReportPreferences({
            motionPermissionState: "denied",
          });
          setPreferences(next);
          toast({
            title: "Motion access was not granted",
            description: "You can still report problems with the manual button.",
            variant: "destructive",
          });
          return false;
        }
      }

      const next = updateProblemReportPreferences({
        dismissedMotionNudge: false,
        motionPermissionState: "granted",
        shakeEnabled: true,
      });
      setPreferences(next);
      toast({
        title: "Shake reporting enabled",
        description: "A firm shake will now open the report form on this device.",
      });
      return true;
    } catch {
      const next = updateProblemReportPreferences({
        motionPermissionState: "denied",
      });
      setPreferences(next);
      toast({
        title: "Motion access could not be enabled",
        description: "Use the manual report button instead.",
        variant: "destructive",
      });
      return false;
    }
  }, [motionSupport, toast]);

  const dismissMotionNudge = useCallback(() => {
    const next = updateProblemReportPreferences({
      dismissedMotionNudge: true,
    });
    setPreferences(next);
  }, []);

  const handleModalOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setSubmitError(null);
    }
    setModalOpen(open);
  }, []);

  const handleSubmit = useCallback(
    async (values: ReportProblemFormValues) => {
      setSubmitting(true);
      setSubmitError(null);

      try {
        const payload = buildProblemReportPayload({
          category: values.category,
          details: values.details,
          email: values.contactEmail,
          extraContext: {
            motion_permission_state: preferences.motionPermissionState,
            report_trigger: source,
            shake_enabled: preferences.shakeEnabled,
          },
          motionTriggered: source === "shake",
          routePath,
          screenshotFileName: values.screenshotFile?.name ?? null,
          source,
          summary: values.summary,
        });

        await submitProblemReport({
          payload,
          screenshotFile: values.screenshotFile,
        });

        setModalOpen(false);
        toast({
          title: "Report sent",
          description: "Thanks. We saved the details and context for follow-up.",
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to submit the problem report right now.";

        setSubmitError(message);
        toast({
          title: "Report failed",
          description: message,
          variant: "destructive",
        });
      } finally {
        setSubmitting(false);
      }
    },
    [preferences.motionPermissionState, preferences.shakeEnabled, routePath, source, toast],
  );

  const shakeListening =
    motionSupport.supported &&
    motionSupport.likelyMobile &&
    motionSupport.secure &&
    preferences.shakeEnabled &&
    preferences.motionPermissionState === "granted" &&
    !modalOpen;

  useShakeDetection({
    active: shakeListening,
    initialLastTriggerAt: preferences.lastTriggerAt,
    onShake: () => {
      const next = updateProblemReportPreferences({
        lastTriggerAt: Date.now(),
      });
      setPreferences(next);
      openReportModal("shake");
    },
  });

  const fallbackButtonVisible =
    motionSupport.likelyMobile &&
    (!motionSupport.supported ||
      !motionSupport.secure ||
      !preferences.shakeEnabled ||
      preferences.motionPermissionState === "denied");
  const floatingButtonVisible =
    fallbackButtonVisible &&
    !routePath.startsWith("/dashboard/messages");
  const reserveFloatingSpace =
    floatingButtonVisible && !modalOpen && isMobileViewport;

  const motionPrompt = (
    <MotionPermissionPrompt
      enabled={preferences.shakeEnabled}
      likelyMobile={motionSupport.likelyMobile}
      motionPermissionState={preferences.motionPermissionState}
      onDisable={disableShakeReporting}
      onDismiss={preferences.dismissedMotionNudge ? undefined : dismissMotionNudge}
      onEnable={enableShakeReporting}
      permissionRequired={motionSupport.permissionRequired}
      secure={motionSupport.secure}
      supported={motionSupport.supported}
    />
  );

  return (
    <ProblemReportContext.Provider
      value={{
        disableShakeReporting,
        enableShakeReporting,
        motionSupport,
        openReportModal,
        preferences,
      }}
    >
      {children}

      {reserveFloatingSpace && (
        <div
          aria-hidden="true"
          className="pointer-events-none h-[calc(5.5rem+env(safe-area-inset-bottom))] sm:hidden"
          data-testid="problem-report-floating-spacer"
        />
      )}

      {floatingButtonVisible && !modalOpen && (
        <div
          className="pointer-events-none fixed right-4 z-40 max-w-[calc(100vw-2rem)] [bottom:calc(1rem+env(safe-area-inset-bottom))] sm:right-6"
          data-testid="problem-report-floating-launcher"
        >
          <Button
            className="pointer-events-auto h-12 rounded-full px-4 shadow-[0_18px_36px_-18px_rgba(15,23,42,0.88)]"
            onClick={() => openReportModal("manual")}
            size="sm"
            type="button"
          >
            <Bug className="mr-2 h-4 w-4" />
            Report a problem
          </Button>
        </div>
      )}

      <ReportProblemModal
        defaultEmail={user?.email ?? ""}
        motionPrompt={
          preferences.dismissedMotionNudge && !preferences.shakeEnabled ? null : motionPrompt
        }
        onOpenChange={handleModalOpenChange}
        onSubmit={handleSubmit}
        open={modalOpen}
        source={source}
        submitError={submitError}
        submitting={submitting}
      />
    </ProblemReportContext.Provider>
  );
};
