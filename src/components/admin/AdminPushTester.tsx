import { FormEvent, useEffect, useMemo, useState } from "react";
import { Bell, BellOff, Loader2, Mail, Send, ShieldCheck, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type NotificationType =
  | "new_message"
  | "schedule_change"
  | "schedule_response"
  | "document_upload"
  | "child_update"
  | "exchange_reminder";

interface AdminProfile {
  id: string;
  email: string | null;
}

const NOTIFICATION_TYPES: Array<{ value: NotificationType; label: string }> = [
  { value: "new_message", label: "New message" },
  { value: "schedule_change", label: "Schedule change" },
  { value: "schedule_response", label: "Schedule response" },
  { value: "document_upload", label: "Document upload" },
  { value: "child_update", label: "Child update" },
  { value: "exchange_reminder", label: "Exchange reminder" },
];

const permissionTone = (permission: NotificationPermission) => {
  switch (permission) {
    case "granted":
      return "default";
    case "denied":
      return "destructive";
    default:
      return "secondary";
  }
};

export const AdminPushTester = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    isSupported,
    isSubscribed,
    permission,
    isiOS,
    isiOSPWA,
    isPWA,
    loading,
    unsupportedReason,
    requestPermission,
    subscribe,
    unsubscribe,
    sendLocalNotification,
  } = usePushNotifications();

  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [togglingSubscription, setTogglingSubscription] = useState(false);
  const [sendingLocal, setSendingLocal] = useState(false);
  const [sendingRemote, setSendingRemote] = useState(false);
  const [localTitle, setLocalTitle] = useState("CoParrent push test");
  const [localBody, setLocalBody] = useState("This browser can display test notifications from the admin dashboard.");
  const [remoteTitle, setRemoteTitle] = useState("CoParrent notification pipeline test");
  const [remoteMessage, setRemoteMessage] = useState("This test verifies the send-notification edge function and in-app notification flow.");
  const [remoteType, setRemoteType] = useState<NotificationType>("new_message");
  const [remoteActionUrl, setRemoteActionUrl] = useState("/admin");

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setProfile(null);
        setLoadingProfile(false);
        return;
      }

      setLoadingProfile(true);

      const { data, error } = await supabase
        .from("profiles")
        .select("id, email")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error loading admin profile for push tester:", error);
        toast({
          title: "Profile lookup failed",
          description: "Could not load your profile for notification testing.",
          variant: "destructive",
        });
        setProfile(null);
      } else {
        setProfile(data);
      }

      setLoadingProfile(false);
    };

    fetchProfile();
  }, [toast, user]);

  const environmentSummary = useMemo(() => {
    if (isiOS && isiOSPWA) return "iOS PWA";
    if (isiOS) return "iOS browser";
    if (isPWA) return "Installed PWA";
    return "Standard browser tab";
  }, [isPWA, isiOS, isiOSPWA]);

  const handlePermissionRequest = async () => {
    const granted = await requestPermission();
    if (granted) {
      toast({
        title: "Permission granted",
        description: "The browser is ready for notification tests.",
      });
    }
  };

  const handleSubscriptionToggle = async () => {
    setTogglingSubscription(true);
    try {
      if (isSubscribed) {
        await unsubscribe();
      } else {
        await subscribe();
      }
    } finally {
      setTogglingSubscription(false);
    }
  };

  const handleLocalSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSendingLocal(true);
    try {
      const ok = await sendLocalNotification(localTitle.trim() || "CoParrent push test", {
        body: localBody.trim(),
        tag: "coparrent-admin-push-test",
        data: {
          source: "admin-push-tester",
          created_at: new Date().toISOString(),
        },
      });

      if (ok) {
        toast({
          title: "Local notification sent",
          description: "Check the current device for the browser notification.",
        });
      } else {
        toast({
          title: "Local notification failed",
          description: "The browser did not confirm the notification test.",
          variant: "destructive",
        });
      }
    } finally {
      setSendingLocal(false);
    }
  };

  const handleRemoteSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!profile?.id) {
      toast({
        title: "Profile required",
        description: "Your admin profile must load before sending a pipeline test.",
        variant: "destructive",
      });
      return;
    }

    setSendingRemote(true);
    try {
      const { error } = await supabase.functions.invoke("send-notification", {
        body: {
          type: remoteType,
          recipient_profile_id: profile.id,
          sender_name: "Admin Push Tester",
          title: remoteTitle.trim() || "CoParrent notification pipeline test",
          message: remoteMessage.trim() || "This is a self-targeted admin notification test.",
          action_url: remoteActionUrl.trim() || "/admin",
          data: {
            source: "admin-push-tester",
            target_email: profile.email,
            created_at: new Date().toISOString(),
          },
        },
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Pipeline test submitted",
        description: "Check the in-app notifications list and inbox for the self-test.",
      });
    } catch (error) {
      console.error("Error sending admin pipeline notification test:", error);
      toast({
        title: "Pipeline test failed",
        description: "The send-notification function did not accept the test payload.",
        variant: "destructive",
      });
    } finally {
      setSendingRemote(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Push Notification QA
          </CardTitle>
          <CardDescription>
            Validate browser permission, service worker subscription, and the live notification pipeline against your own admin account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant={permissionTone(permission)}>Permission: {permission}</Badge>
            <Badge variant={isSupported ? "default" : "secondary"}>
              {isSupported ? "Push supported" : "Push unavailable"}
            </Badge>
            <Badge variant={isSubscribed ? "default" : "secondary"}>
              {isSubscribed ? "Subscribed" : "Not subscribed"}
            </Badge>
            <Badge variant="outline">{environmentSummary}</Badge>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border p-3">
              <p className="text-sm font-medium">Current device</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {loading ? "Checking browser capability..." : unsupportedReason || "Push detection completed."}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-sm font-medium">Target profile</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {loadingProfile
                  ? "Loading your admin profile..."
                  : profile?.email || "Profile email unavailable"}
              </p>
            </div>
          </div>

          {!isSupported && (
            <Alert>
              <Smartphone className="h-4 w-4" />
              <AlertTitle>Push not available on this device</AlertTitle>
              <AlertDescription>
                {unsupportedReason || "This browser cannot complete a push subscription flow right now."}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handlePermissionRequest}
              disabled={loading || permission === "granted"}
            >
              <Bell className="mr-2 h-4 w-4" />
              Request permission
            </Button>
            <Button
              type="button"
              onClick={handleSubscriptionToggle}
              disabled={loading || togglingSubscription || !isSupported}
            >
              {togglingSubscription ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : isSubscribed ? (
                <BellOff className="mr-2 h-4 w-4" />
              ) : (
                <Bell className="mr-2 h-4 w-4" />
              )}
              {isSubscribed ? "Disable subscription" : "Enable subscription"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Local Browser Test
            </CardTitle>
            <CardDescription>
              Sends a notification directly to this browser so you can confirm permission and service-worker behavior.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleLocalSubmit}>
              <div className="space-y-2">
                <Label htmlFor="local-title">Title</Label>
                <Input
                  id="local-title"
                  value={localTitle}
                  onChange={(event) => setLocalTitle(event.target.value)}
                  maxLength={80}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="local-body">Body</Label>
                <Textarea
                  id="local-body"
                  value={localBody}
                  onChange={(event) => setLocalBody(event.target.value)}
                  rows={4}
                  maxLength={240}
                />
              </div>
              <Button type="submit" disabled={sendingLocal || loading}>
                {sendingLocal ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Send local test
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Notification Pipeline Test
            </CardTitle>
            <CardDescription>
              Exercises the deployed <code>send-notification</code> edge function against your own admin profile.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleRemoteSubmit}>
              <div className="space-y-2">
                <Label htmlFor="remote-type">Notification type</Label>
                <select
                  id="remote-type"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={remoteType}
                  onChange={(event) => setRemoteType(event.target.value as NotificationType)}
                >
                  {NOTIFICATION_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="remote-title">Title</Label>
                <Input
                  id="remote-title"
                  value={remoteTitle}
                  onChange={(event) => setRemoteTitle(event.target.value)}
                  maxLength={80}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="remote-message">Message</Label>
                <Textarea
                  id="remote-message"
                  value={remoteMessage}
                  onChange={(event) => setRemoteMessage(event.target.value)}
                  rows={4}
                  maxLength={240}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="remote-action">Action URL</Label>
                <Input
                  id="remote-action"
                  value={remoteActionUrl}
                  onChange={(event) => setRemoteActionUrl(event.target.value)}
                  placeholder="/admin"
                />
              </div>
              <Button type="submit" disabled={sendingRemote || loadingProfile || !profile?.id}>
                {sendingRemote ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Send self-test
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
