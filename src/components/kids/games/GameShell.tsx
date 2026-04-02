import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Maximize2, Minimize2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GameShellProps {
  backLabel?: string;
  children: ReactNode;
  description: string;
  onBack: () => void;
  title: string;
}

export const GameShell = ({
  backLabel = "Back",
  children,
  description,
  onBack,
  title,
}: GameShellProps) => {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreenActive, setIsFullscreenActive] = useState(false);

  const supportsImmersiveMode = useMemo(() => {
    if (typeof document === "undefined") {
      return false;
    }

    return (
      typeof document.documentElement.requestFullscreen === "function" ||
      typeof document.exitFullscreen === "function"
    );
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const syncFullscreenState = () => {
      const isActive = Boolean(document.fullscreenElement);
      setIsFullscreenActive(isActive);

      if (!isActive && typeof screen !== "undefined") {
        screen.orientation?.unlock?.();
      }
    };

    syncFullscreenState();
    document.addEventListener("fullscreenchange", syncFullscreenState);

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
    };
  }, []);

  const handleEnterLandscapeMode = useCallback(async () => {
    if (typeof document === "undefined") {
      return;
    }

    try {
      if (!document.fullscreenElement) {
        await shellRef.current?.requestFullscreen?.();
      }

      await screen.orientation?.lock?.("landscape");
    } catch {
      // Ignore browsers that do not support orientation lock after entering fullscreen.
    }
  }, []);

  const handleExitLandscapeMode = useCallback(async () => {
    if (typeof document === "undefined") {
      return;
    }

    try {
      screen.orientation?.unlock?.();
    } catch {
      // Ignore browsers that do not expose orientation unlock.
    }

    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // Ignore fullscreen exit failures and leave the shell usable.
      }
    }
  }, []);

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

              {supportsImmersiveMode ? (
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
                    Back upright
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
                    Sideways + fullscreen
                  </Button>
                )
              ) : null}
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
                MVP score
              </p>
              <p className="mt-2 text-sm font-medium">Best score stays only on this device for now.</p>
              <p className="mt-3 inline-flex items-center gap-2 text-xs text-sky-700/80">
                <Smartphone className="h-3.5 w-3.5" />
                Best in landscape when your browser supports fullscreen.
              </p>
            </div>
          </div>
        </div>
      </section>

      {children}
    </div>
  );
};
