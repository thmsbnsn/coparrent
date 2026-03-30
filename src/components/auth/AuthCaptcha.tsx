import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { getAuthCaptchaState } from "@/lib/authCapabilities";

declare global {
  interface Window {
    hcaptcha?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        },
      ) => number;
      remove?: (widgetId: number) => void;
    };
    __coparrentHcaptchaLoadPromise?: Promise<void>;
  }
}

interface AuthCaptchaProps {
  onTokenChange: (token: string | null) => void;
}

const loadHcaptchaScript = (): Promise<void> => {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (window.hcaptcha) {
    return Promise.resolve();
  }

  if (window.__coparrentHcaptchaLoadPromise) {
    return window.__coparrentHcaptchaLoadPromise;
  }

  window.__coparrentHcaptchaLoadPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-auth-captcha="true"]');
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Failed to load captcha")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://js.hcaptcha.com/1/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.dataset.authCaptcha = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load captcha"));
    document.head.appendChild(script);
  });

  return window.__coparrentHcaptchaLoadPromise;
};

export const AuthCaptcha = ({ onTokenChange }: AuthCaptchaProps) => {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<number | null>(null);
  const { required, configured, siteKey, canRender } = useMemo(() => getAuthCaptchaState(), []);

  useEffect(() => {
    onTokenChange(null);
  }, [onTokenChange]);

  useEffect(() => {
    if (!canRender || !siteKey || !containerRef.current || widgetIdRef.current !== null) {
      return;
    }

    let active = true;
    setLoading(true);

    void loadHcaptchaScript()
      .then(() => {
        if (!active || !containerRef.current || !window.hcaptcha) {
          return;
        }

        widgetIdRef.current = window.hcaptcha.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token) => {
            onTokenChange(token);
            setErrorMessage(null);
          },
          "expired-callback": () => onTokenChange(null),
          "error-callback": () => {
            onTokenChange(null);
            setErrorMessage("Captcha verification failed. Please try again.");
          },
        });
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : "Captcha could not be loaded.");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
      if (widgetIdRef.current !== null && window.hcaptcha?.remove) {
        window.hcaptcha.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [canRender, onTokenChange, siteKey]);

  if (!required) {
    return null;
  }

  if (!configured) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
        Captcha protection is required for sign-in, but the site key is not configured.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <AlertTriangle className="h-4 w-4" />
        )}
        <span>Complete the captcha to continue.</span>
      </div>
      <div ref={containerRef} data-testid="auth-captcha" />
      {errorMessage ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}
    </div>
  );
};
