import { useEffect, useState } from "react";
import { Activity, Bell, Download, RefreshCw, ShieldCheck, Smartphone } from "lucide-react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

const detectStandalone = () => {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as NavigatorWithStandalone).standalone === true
  );
};

const getManifestHref = () => {
  if (typeof document === "undefined") return null;
  return document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.href ?? null;
};

const PWADiagnosticsPage = () => {
  const [isStandalone, setIsStandalone] = useState(false);
  const [serviceWorkerState, setServiceWorkerState] = useState<"unsupported" | "missing" | "registered">("missing");
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [manifestHref, setManifestHref] = useState<string | null>(null);

  useEffect(() => {
    setIsStandalone(detectStandalone());
    setManifestHref(getManifestHref());

    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }

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
            Quick checks for installability, notifications, and service-worker registration in the current browser session.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => window.location.reload()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh checks
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
                Install mode
              </CardTitle>
              <CardDescription>Whether the app is running as an installed PWA.</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant={isStandalone ? "default" : "secondary"}>
                {isStandalone ? "Standalone" : "Browser tab"}
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
              <Badge variant={notificationPermission === "granted" ? "default" : "secondary"}>
                {notificationPermission}
              </Badge>
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
      </main>
      <Footer />
    </div>
  );
};

export default PWADiagnosticsPage;
