import { WifiOff, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/Logo";

export const OfflineFallback = () => {
  const handleRetry = () => {
    window.location.reload();
  };

  const handleHome = () => {
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md mx-auto">
        <div className="mb-8">
          <Logo size="lg" />
        </div>

        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
          <WifiOff className="h-10 w-10 text-muted-foreground" />
        </div>

        <h1 className="text-2xl font-bold mb-3">You're Offline</h1>
        
        <p className="text-muted-foreground mb-8 leading-relaxed">
          It looks like you've lost your internet connection. Don't worry — your data is safe. 
          Please check your connection and try again.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={handleRetry} size="lg" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
          <Button onClick={handleHome} variant="outline" size="lg" className="gap-2">
            <Home className="h-4 w-4" />
            Go Home
          </Button>
        </div>

        <div className="mt-12 p-4 bg-muted/50 rounded-lg">
          <h2 className="font-medium text-sm mb-2">While you're offline:</h2>
          <ul className="text-sm text-muted-foreground text-left space-y-1">
            <li>• Your cached pages are still accessible</li>
            <li>• Any unsaved changes will sync when you reconnect</li>
            <li>• Check your WiFi or mobile data connection</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
