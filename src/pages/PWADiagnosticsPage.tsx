import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, Bell, Download, RefreshCw, ShieldCheck, Smartphone, Workflow } from "lucide-react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const getManifestHref = () => {
  if (typeof document === "undefined") return null;
  return document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.href ?? null;
};

const PWADiagnosticsPage = () => {
  const [serviceWorkerState, setServiceWorkerState] = useState<"unsupported" | "missing" | "registered">("missing");
  const [manifestHref, setManifestHref] = useState<string | null>(null);
  const {
    isSupported,
    isSubscribed,
    permission,
    unsupportedReason,
    isiOS,
    isiOSPWA,
    isPWA,
    loading,
  } = usePushNotifications();
  const isAndroid = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /android/i.test(navigator.userAgent);
  }, []);

  const environmentLabel = useMemo(() => {
    if (isiOS && isiOSPWA) return "iOS PWA";
    if (isiOS) return "iOS browser";
    if (isAndroid && isPWA) return "Android PWA";
    if (isAndroid) return "Android browser";
    if (isPWA) return "Desktop PWA";
    return "Desktop browser";
  }, [isAndroid, isPWA, isiOS, isiOSPWA]);

  useEffect(() => {
    setManifestHref(getManifestHref());

    if (!("serviceWorker" in navigator)) {
      setServiceWorkerState("unsupported");
      return;
    }

    navigator.serviceWorker
      .getRegistration("/")
      .then((registration) => setServiceWorkerState(registration ? "registered" : "missing"))
      .catch(() => setServiceWorkerState("missing"));
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="container mx-auto px-4 py-12 space-y-8">
        <section className="max-w-3xl space-y-4">
          <Badge variant="secondary" className="gap-2">
            <ShieldCheck className="h-3.5 w-3.5" />
            Internal QA
          </Badge>
          <h1 className="text-4xl font-display font-semibold">PWA diagnostics</h1>
          <p className="text-muted-foreground">
            Quick checks for install mode, subscription readiness, notifications, and service-worker registration in the current browser session.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => window.location.reload()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh checks
            </Button>
            <Button asChild variant="secondary">
              <Link to="/dashboard/notifications">
                <Bell className="mr-2 h-4 w-4" />
                Open notification settings
              </Link>
            </Button>
            <Button variant="outline" onClick={() => window.open("/manifest.webmanifest", "_blank", "noopener,noreferrer")}>
              <Download className="mr-2 h-4 w-4" />
              Open manifest
            </Button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-primary" />
                Environment
              </CardTitle>
              <CardDescription>How this browser session is currently running.</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant={isPWA ? "default" : "secondary"}>
                {environmentLabel}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Service worker
              </CardTitle>
              <CardDescription>Basic registration state for the root scope.</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant={serviceWorkerState === "registered" ? "default" : "secondary"}>
                {serviceWorkerState}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Notifications
              </CardTitle>
              <CardDescription>Browser notification permission for this origin.</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant={permission === "granted" ? "default" : "secondary"}>
                {permission}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Workflow className="h-5 w-5 text-primary" />
                Push readiness
              </CardTitle>
              <CardDescription>Whether this session is ready for a real-device push check.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge variant={isSupported ? "default" : "secondary"}>
                  {isSupported ? "Supported" : "Unsupported"}
                </Badge>
                <Badge variant={isSubscribed ? "default" : "secondary"}>
                  {loading ? "Checking subscription" : isSubscribed ? "Active subscription" : "No active subscription"}
                </Badge>
              </div>
              {unsupportedReason && (
                <p className="text-sm text-muted-foreground">{unsupportedReason}</p>
              )}
              {!unsupportedReason && (
                <p className="text-sm text-muted-foreground">
                  Use this page immediately before capturing evidence for the manual push/PWA pass.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5 text-primary" />
                Manifest
              </CardTitle>
              <CardDescription>Manifest reference found in the current document.</CardDescription>
            </CardHeader>
            <CardContent className="break-all text-sm text-muted-foreground">
              {manifestHref ?? "No manifest link detected"}
            </CardContent>
          </Card>
        </section>

        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>Evidence reminder</CardTitle>
            <CardDescription>
              This page is diagnostic only. Push/PWA validation is not complete until the target physical device actually receives the notification and the evidence package is saved.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>Capture this page and the notification-settings page on the same device/session.</p>
            <p>Save the matching `verify-push-pwa` JSON and markdown artifacts for the same run.</p>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default PWADiagnosticsPage;
