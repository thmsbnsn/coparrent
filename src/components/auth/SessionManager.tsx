import { useCallback, useEffect, useState } from "react";
import { Monitor, Smartphone, Globe, Loader2, LogOut, MapPin, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";

interface Session {
  id: string;
  device: string;
  browser: string;
  location: string;
  lastActive: Date;
  isCurrent: boolean;
}

// Parse user agent to get device/browser info
const parseUserAgent = (ua: string): { device: string; browser: string } => {
  let device = "Unknown Device";
  let browser = "Unknown Browser";

  // Detect device
  if (/iPhone|iPad|iPod/.test(ua)) {
    device = /iPad/.test(ua) ? "iPad" : "iPhone";
  } else if (/Android/.test(ua)) {
    device = /Mobile/.test(ua) ? "Android Phone" : "Android Tablet";
  } else if (/Windows/.test(ua)) {
    device = "Windows PC";
  } else if (/Mac/.test(ua)) {
    device = "Mac";
  } else if (/Linux/.test(ua)) {
    device = "Linux PC";
  }

  // Detect browser
  if (/Chrome/.test(ua) && !/Edge|Edg/.test(ua)) {
    browser = "Chrome";
  } else if (/Safari/.test(ua) && !/Chrome/.test(ua)) {
    browser = "Safari";
  } else if (/Firefox/.test(ua)) {
    browser = "Firefox";
  } else if (/Edge|Edg/.test(ua)) {
    browser = "Edge";
  }

  return { device, browser };
};

const getDeviceIcon = (device: string) => {
  if (/iPhone|Android Phone|Mobile/.test(device)) {
    return Smartphone;
  }
  return Monitor;
};

export const SessionManager = () => {
  const { toast } = useToast();
  const { session: currentSession, signOut } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [showRevokeAllDialog, setShowRevokeAllDialog] = useState(false);
  const [revokingAll, setRevokingAll] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      // In a real implementation, you would fetch sessions from an API
      // Supabase doesn't provide session listing by default
      // For demo purposes, we'll show the current session and some mock data
      
      const currentUA = navigator.userAgent;
      const { device, browser } = parseUserAgent(currentUA);
      
      const currentSessionData: Session = {
        id: currentSession?.access_token?.slice(-8) || "current",
        device,
        browser,
        location: "Current Location",
        lastActive: new Date(),
        isCurrent: true,
      };

      // Mock additional sessions for demo
      const mockSessions: Session[] = [
        currentSessionData,
        // Uncomment to show additional mock sessions
        // {
        //   id: "sess_abc123",
        //   device: "iPhone",
        //   browser: "Safari",
        //   location: "New York, US",
        //   lastActive: new Date(Date.now() - 1000 * 60 * 60 * 2),
        //   isCurrent: false,
        // },
      ];

      setSessions(mockSessions);
    } catch (error) {
      console.error("Error loading sessions:", error);
    } finally {
      setLoading(false);
    }
  }, [currentSession]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const handleRevokeSession = async (sessionId: string) => {
    setRevoking(sessionId);
    try {
      // In a real implementation, you would call an API to revoke the session
      // For demo, we'll just remove it from the list
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      
      toast({
        title: "Session revoked",
        description: "The device has been signed out.",
      });
    } catch (error: unknown) {
      toast({
        title: "Failed to revoke session",
        description: error instanceof Error ? error.message : "Could not revoke the session.",
        variant: "destructive",
      });
    } finally {
      setRevoking(null);
    }
  };

  const handleRevokeAllSessions = async () => {
    setRevokingAll(true);
    try {
      // Sign out from all sessions
      await signOut();
      
      toast({
        title: "All sessions revoked",
        description: "You have been signed out from all devices.",
      });
    } catch (error: unknown) {
      toast({
        title: "Failed to revoke sessions",
        description: error instanceof Error ? error.message : "Could not revoke sessions.",
        variant: "destructive",
      });
    } finally {
      setRevokingAll(false);
      setShowRevokeAllDialog(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading sessions...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <Globe className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">Active Sessions</p>
            <p className="text-sm text-muted-foreground">
              Manage devices where you're signed in
            </p>
          </div>
        </div>
        
        {sessions.length > 1 && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowRevokeAllDialog(true)}
          >
            Sign out all
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {sessions.map((session) => {
          const DeviceIcon = getDeviceIcon(session.device);
          
          return (
            <div 
              key={session.id} 
              className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center border border-border">
                  <DeviceIcon className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{session.device}</span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-sm text-muted-foreground">{session.browser}</span>
                    {session.isCurrent && (
                      <Badge variant="secondary" className="text-xs">
                        Current
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {session.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {session.isCurrent 
                        ? "Active now" 
                        : formatDistanceToNow(session.lastActive, { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>
              
              {!session.isCurrent && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRevokeSession(session.id)}
                  disabled={revoking === session.id}
                >
                  {revoking === session.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <LogOut className="w-4 h-4" />
                  )}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {sessions.length === 0 && (
        <div className="text-center text-muted-foreground py-8">
          No active sessions found.
        </div>
      )}

      {/* Revoke All Confirmation Dialog */}
      <AlertDialog open={showRevokeAllDialog} onOpenChange={setShowRevokeAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out from all devices?</AlertDialogTitle>
            <AlertDialogDescription>
              This will sign you out from all devices, including this one. You'll need to sign in again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRevokeAllSessions}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={revokingAll}
            >
              {revokingAll && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Sign out all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
