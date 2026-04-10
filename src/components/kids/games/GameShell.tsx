import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, ArrowLeft, Maximize2, Minimize2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

type GameShellNoticeTone = "error" | "info" | "warning";

export interface GameShellImmersiveState {
  enterImmersiveMode: () => Promise<void>;
  exitImmersiveMode: () => Promise<void>;
  fullscreenSupported: boolean;
  immersiveNotice: string | null;
  immersiveNoticeTone: GameShellNoticeTone | null;
  isFullscreenActive: boolean;
  isLandscape: boolean;
  landscapeSupportLabel: string;
  orientationLocked: boolean;
  orientationLockSupported: boolean;
}

interface GameShellProps {
  backLabel?: string;
  children: ReactNode | ((immersiveMode: GameShellImmersiveState) => ReactNode);
  description: string;
  onBack: () => void;
  title: string;
}

interface FullscreenCapableDocument extends Document {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
}

interface FullscreenCapableElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

const getFullscreenElement = (doc: FullscreenCapableDocument) =>
  doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;

const requestShellFullscreen = async (element: FullscreenCapableElement) => {
  if (typeof element.requestFullscreen === "function") {
    await element.requestFullscreen();
    return true;
  }

  if (typeof element.webkitRequestFullscreen === "function") {
    await Promise.resolve(element.webkitRequestFullscreen());
    return true;
  }

  return false;
};

const exitShellFullscreen = async (doc: FullscreenCapableDocument) => {
  if (typeof doc.exitFullscreen === "function") {
    await doc.exitFullscreen();
    return true;
  }

  if (typeof doc.webkitExitFullscreen === "function") {
    await Promise.resolve(doc.webkitExitFullscreen());
    return true;
  }

  return false;
};

const getNoticeClasses = (tone: GameShellNoticeTone | null) => {
  switch (tone) {
    case "error":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-sky-200 bg-sky-50 text-sky-700";
  }
};

export const GameShell = ({
  backLabel = "Back",
  children,
  description,
  onBack,
  title,
}: GameShellProps) => {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreenActive, setIsFullscreenActive] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [immersiveNotice, setImmersiveNotice] = useState<string | null>(null);
  const [immersiveNoticeTone, setImmersiveNoticeTone] = useState<GameShellNoticeTone | null>(null);
  const [orientationLocked, setOrientationLocked] = useState(false);
  const previousFullscreenActiveRef = useRef(false);
  const manualExitRequestedRef = useRef(false);

  const fullscreenSupported = useMemo(() => {
    if (typeof document === "undefined") {
      return false;
    }

    const fullscreenDocument = document as FullscreenCapableDocument;
    const fullscreenRoot = document.documentElement as FullscreenCapableElement;
    const fullscreenEnabled =
      fullscreenDocument.fullscreenEnabled ?? fullscreenDocument.webkitFullscreenEnabled;

    if (fullscreenEnabled === false) {
      return false;
    }

    return (
      typeof fullscreenRoot.requestFullscreen === "function" ||
      typeof fullscreenRoot.webkitRequestFullscreen === "function" ||
      typeof fullscreenDocument.exitFullscreen === "function" ||
      typeof fullscreenDocument.webkitExitFullscreen === "function"
    );
  }, []);
  const orientationLockSupported = useMemo(
    () => typeof screen !== "undefined" && typeof screen.orientation?.lock === "function",
    [],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncOrientation = () => {
      if (typeof window.matchMedia === "function") {
        setIsLandscape(window.matchMedia("(orientation: landscape)").matches);
        return;
      }

      setIsLandscape(window.innerWidth >= window.innerHeight);
    };

    syncOrientation();
    window.addEventListener("resize", syncOrientation);
    window.addEventListener("orientationchange", syncOrientation);

    return () => {
      window.removeEventListener("resize", syncOrientation);
      window.removeEventListener("orientationchange", syncOrientation);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const fullscreenDocument = document as FullscreenCapableDocument;
    const syncFullscreenState = () => {
      const isActive = Boolean(getFullscreenElement(fullscreenDocument));
      setIsFullscreenActive(isActive);

      if (!isActive && typeof screen !== "undefined") {
        setOrientationLocked(false);
        screen.orientation?.unlock?.();
      }

      if (previousFullscreenActiveRef.current && !isActive) {
        setImmersiveNotice(
          manualExitRequestedRef.current
            ? "Fullscreen closed. The game keeps running in the page view."
            : "Fullscreen ended outside the game controls. You can re-enter it whenever you want.",
        );
        setImmersiveNoticeTone("info");
        manualExitRequestedRef.current = false;
      }

      previousFullscreenActiveRef.current = isActive;
    };

    const handleFullscreenError = () => {
      setImmersiveNotice(
        "Fullscreen was blocked or denied. The game still works here, so rotate manually if needed.",
      );
      setImmersiveNoticeTone("warning");
      setOrientationLocked(false);
      syncFullscreenState();
    };

    syncFullscreenState();
    document.addEventListener("fullscreenchange", syncFullscreenState);
    document.addEventListener("fullscreenerror", handleFullscreenError);
    document.addEventListener("visibilitychange", syncFullscreenState);
    window.addEventListener("focus", syncFullscreenState);

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
      document.removeEventListener("fullscreenerror", handleFullscreenError);
      document.removeEventListener("visibilitychange", syncFullscreenState);
      window.removeEventListener("focus", syncFullscreenState);
    };
  }, []);

  const handleEnterLandscapeMode = useCallback(async () => {
    if (typeof document === "undefined") {
      return;
    }

    const fullscreenDocument = document as FullscreenCapableDocument;
    const fullscreenShell = shellRef.current as FullscreenCapableElement | null;
    setImmersiveNotice(null);
    setImmersiveNoticeTone(null);
    manualExitRequestedRef.current = false;

    if (!fullscreenSupported) {
      setImmersiveNotice(
        "This browser does not offer reliable fullscreen here. The game still works, but rotate manually for the widest view.",
      );
      setImmersiveNoticeTone("warning");
      return;
    }

    if (!fullscreenShell) {
      setImmersiveNotice("The game shell could not open fullscreen from this screen.");
      setImmersiveNoticeTone("error");
      return;
    }

    try {
      if (!getFullscreenElement(fullscreenDocument)) {
        const requested = await requestShellFullscreen(fullscreenShell);
        if (!requested) {
          setImmersiveNotice(
            "This browser did not expose a fullscreen request API for the game shell.",
          );
          setImmersiveNoticeTone("warning");
          return;
        }
      }

      if (!getFullscreenElement(fullscreenDocument)) {
        setImmersiveNotice(
          "Fullscreen did not activate after the request. You can still play here and rotate manually if needed.",
        );
        setImmersiveNoticeTone("warning");
        return;
      }
    } catch {
      setImmersiveNotice(
        "Fullscreen was denied by the browser or operating system. The game still works without it.",
      );
      setImmersiveNoticeTone("warning");
      setOrientationLocked(false);
      return;
    }

    if (!orientationLockSupported) {
      setOrientationLocked(false);
      return;
    }

    try {
      await screen.orientation?.lock?.("landscape");
      setOrientationLocked(true);
    } catch {
      setOrientationLocked(false);
      setImmersiveNotice(
        "Fullscreen is active, but landscape lock is not available here. Rotate manually if needed.",
      );
      setImmersiveNoticeTone("warning");
    }
  }, [fullscreenSupported, orientationLockSupported]);

  const handleExitLandscapeMode = useCallback(async () => {
    if (typeof document === "undefined") {
      return;
    }

    const fullscreenDocument = document as FullscreenCapableDocument;
    manualExitRequestedRef.current = true;

    try {
      screen.orientation?.unlock?.();
    } catch {
      // Ignore browsers that do not expose orientation unlock.
    }

    if (getFullscreenElement(fullscreenDocument)) {
      try {
        const exited = await exitShellFullscreen(fullscreenDocument);
        if (!exited) {
          setImmersiveNotice(
            "The browser did not expose a fullscreen exit API. Use the system fullscreen control if needed.",
          );
          setImmersiveNoticeTone("warning");
        }
      } catch {
        setImmersiveNotice(
          "Fullscreen did not close cleanly. Use the browser or system exit control if needed.",
        );
        setImmersiveNoticeTone("warning");
      }
    }
  }, []);

  const landscapeSupportLabel = useMemo(() => {
    if (orientationLocked) {
      return "Landscape lock is active for this fullscreen session.";
    }

    if (isFullscreenActive && orientationLockSupported) {
      return isLandscape
        ? "Fullscreen is active. Landscape is available here, but the browser still keeps rotation under your control."
        : "Fullscreen is active, but landscape did not lock. Rotate manually if needed.";
    }

    if (fullscreenSupported && orientationLockSupported) {
      return "Use a fullscreen button tap to request landscape on supported phones and tablets.";
    }

    if (fullscreenSupported) {
      return "Fullscreen is available here, but this browser does not expose landscape lock. Rotate manually if needed.";
    }

    return "This browser does not expose reliable fullscreen here. The game still works, but rotate manually for the widest view.";
  }, [fullscreenSupported, isFullscreenActive, isLandscape, orientationLockSupported, orientationLocked]);

  const immersiveMode: GameShellImmersiveState = {
    enterImmersiveMode: handleEnterLandscapeMode,
    exitImmersiveMode: handleExitLandscapeMode,
    fullscreenSupported,
    immersiveNotice,
    immersiveNoticeTone,
    isFullscreenActive,
    isLandscape,
    landscapeSupportLabel,
    orientationLocked,
    orientationLockSupported,
  };

  return (
    <div ref={shellRef} className="space-y-5">
      <section className="rounded-[2rem] border border-border bg-white/90 p-5 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                className="rounded-full bg-white"
                onClick={onBack}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {backLabel}
              </Button>

              {fullscreenSupported ? (
                isFullscreenActive ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full bg-slate-950 text-white hover:bg-slate-800 hover:text-white"
                    onClick={() => {
                      void handleExitLandscapeMode();
                    }}
                  >
                    <Minimize2 className="mr-2 h-4 w-4" />
                    Exit Fullscreen
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full border-primary/20 bg-primary/10 text-primary hover:bg-primary/15"
                    onClick={() => {
                      void handleEnterLandscapeMode();
                    }}
                  >
                    <Maximize2 className="mr-2 h-4 w-4" />
                    Enter Fullscreen
                  </Button>
                )
              ) : (
                <div className="inline-flex items-center rounded-full border border-border/70 bg-white px-3 py-2 text-xs font-medium text-muted-foreground">
                  Rotate manually
                </div>
              )}
            </div>

            <div>
              <div className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700">
                First playable game
              </div>
              <h1 className="mt-3 text-3xl font-display font-semibold text-slate-950 sm:text-4xl">
                {title}
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
                {description}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.5rem] bg-slate-950 px-4 py-4 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/65">
                How to play
              </p>
              <p className="mt-2 text-sm font-medium">Tap, click, or press space to keep flying.</p>
            </div>
            <div className="rounded-[1.5rem] bg-sky-50 px-4 py-4 text-slate-900">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700/70">
                Screen setup
              </p>
              <p className="mt-2 text-sm font-medium">
                {orientationLocked
                  ? "Landscape lock is active."
                  : isFullscreenActive
                    ? "Fullscreen is active."
                    : "Use landscape for more runway."}
              </p>
              <p className="mt-3 inline-flex items-start gap-2 text-xs leading-5 text-sky-700/80">
                <Smartphone className="h-3.5 w-3.5" />
                {landscapeSupportLabel}
              </p>
            </div>
          </div>

          {immersiveNotice ? (
            <div className={`rounded-[1.25rem] border px-4 py-3 text-sm leading-6 ${getNoticeClasses(immersiveNoticeTone)}`}>
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{immersiveNotice}</p>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {typeof children === "function" ? children(immersiveMode) : children}
    </div>
  );
};
