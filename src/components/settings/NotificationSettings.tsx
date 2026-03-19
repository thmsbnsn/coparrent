import { useState } from "react";
import { Bell, BellOff, Smartphone, Mail, Check, AlertCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useNotifications } from "@/hooks/useNotifications";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useToast } from "@/hooks/use-toast";

export const NotificationSettings = () => {
  const { toast } = useToast();
  const {
    preferences,
    loading: prefsLoading,
    updatePreferences,
    toggleAllNotifications,
  } = useNotifications();

  const {
    isSupported,
    isSubscribed,
    permission,
    isiOS,
    isPWA,
    loading: pushLoading,
    subscribe,
    unsubscribe,
    sendLocalNotification,
  } = usePushNotifications();

  const [saving, setSaving] = useState(false);

  const handleTogglePreference = async (
    key: keyof typeof preferences,
    value: boolean
  ) => {
    setSaving(true);
    const success = await updatePreferences({ [key]: value });
    if (success) {
      toast({
        title: "Preference Updated",
        description: "Your notification settings have been saved.",
      });
    }
    setSaving(false);
  };

  const handleTogglePush = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  const handleTestNotification = async () => {
    const success = await sendLocalNotification("Test Notification", {
      body: "This is a test notification from CoParrent!",
      tag: "test-notification",
    });

    if (!success) {
      toast({
        title: "Test Failed",
        description: "Could not send test notification. Check your browser settings.",
        variant: "destructive",
      });
    }
  };

  if (prefsLoading || pushLoading) {
    return (
      <div className="p-6 rounded-2xl border border-border bg-card">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-muted rounded w-1/3" />
          <div className="h-4 bg-muted rounded w-2/3" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-2xl border border-border bg-card space-y-6">
      <div>
        <h3 className="text-lg font-display font-semibold flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Notification Settings
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Manage how and when you receive notifications
        </p>
      </div>

      {/* Delivery Methods Section */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Delivery Methods
        </h4>

        {/* Push Notifications */}
        <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Push Notifications</p>
                <p className="text-xs text-muted-foreground">
                  {isSupported
                    ? isSubscribed
                      ? "Receiving notifications even when app is closed"
                      : "Get notified even when the app is in the background"
                    : isiOS && !isPWA
                      ? "Add to Home Screen to enable notifications"
                      : "Not supported in this browser"}
                </p>
              </div>
            </div>
            {isSupported && (
              <div className="flex items-center gap-2">
                {isSubscribed && (
                  <Badge variant="secondary" className="text-xs">
                    <Check className="w-3 h-3 mr-1" />
                    Active
                  </Badge>
                )}
                <Switch
                  checked={isSubscribed}
                  onCheckedChange={handleTogglePush}
                  disabled={permission === "denied"}
                />
              </div>
            )}
          </div>

          {/* iOS Home Screen instruction */}
          {isiOS && !isPWA && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
              <Smartphone className="w-4 h-4 text-primary mt-0.5" />
              <div className="text-xs text-primary">
                <p className="font-medium">Install Required for iOS</p>
                <p className="mt-1 opacity-80">
                  Tap the Share button, then "Add to Home Screen" to enable push notifications on iOS.
                </p>
              </div>
            </div>
          )}

          {isSupported && permission === "denied" && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertCircle className="w-4 h-4 text-destructive mt-0.5" />
              <p className="text-xs text-destructive">
                {isiOS 
                  ? "Notifications are blocked. Open Settings → CoParrent → Notifications to enable."
                  : "Notifications are blocked. Please enable them in your browser settings."}
              </p>
            </div>
          )}

          {isSupported && isSubscribed && (
            <Button variant="outline" size="sm" onClick={handleTestNotification}>
              Send Test Notification
            </Button>
          )}
        </div>

        {/* Email Notifications */}
        <div className="p-4 rounded-xl bg-muted/30 border border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                <Mail className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <p className="font-medium">Email Notifications</p>
                <p className="text-xs text-muted-foreground">
                  Receive important updates via email
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                <Check className="w-3 h-3 mr-1" />
                Always On
              </Badge>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3 pl-13">
            Email notifications are sent based on your preferences below. 
            Critical updates are always sent via email.
          </p>
        </div>
      </div>

      <Separator />

      {/* Notification Types Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Notification Types
          </h4>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">All notifications</span>
            <Switch
              checked={preferences.enabled}
              onCheckedChange={(checked) => toggleAllNotifications(checked)}
              disabled={saving}
            />
          </div>
        </div>

        <div className="space-y-1">
          <NotificationToggle
            id="schedule_changes"
            title="Schedule Changes"
            description="When your co-parent requests or makes schedule changes"
            checked={preferences.schedule_changes}
            disabled={!preferences.enabled || saving}
            onChange={(checked) => handleTogglePreference("schedule_changes", checked)}
          />

          <NotificationToggle
            id="new_messages"
            title="New Messages"
            description="When you receive a new message from your co-parent"
            checked={preferences.new_messages}
            disabled={!preferences.enabled || saving}
            onChange={(checked) => handleTogglePreference("new_messages", checked)}
          />

          <NotificationToggle
            id="upcoming_exchanges"
            title="Upcoming Exchanges"
            description="Master toggle for custody exchange reminders"
            checked={preferences.upcoming_exchanges}
            disabled={!preferences.enabled || saving}
            onChange={(checked) => handleTogglePreference("upcoming_exchanges", checked)}
          />

          {/* Granular Exchange Reminder Intervals */}
          {preferences.upcoming_exchanges && (
            <div className="ml-6 pl-4 border-l-2 border-secondary/30 space-y-1">
              <div className="flex items-center gap-2 py-2">
                <Clock className="w-4 h-4 text-secondary" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Reminder Intervals
                </span>
              </div>
              
              <NotificationToggle
                id="exchange_reminder_24h"
                title="24 Hours Before"
                description="Get reminded a day before the exchange"
                checked={preferences.exchange_reminder_24h}
                disabled={!preferences.enabled || !preferences.upcoming_exchanges || saving}
                onChange={(checked) => handleTogglePreference("exchange_reminder_24h", checked)}
              />
              
              <NotificationToggle
                id="exchange_reminder_2h"
                title="2 Hours Before"
                description="Get reminded 2 hours before the exchange"
                checked={preferences.exchange_reminder_2h}
                disabled={!preferences.enabled || !preferences.upcoming_exchanges || saving}
                onChange={(checked) => handleTogglePreference("exchange_reminder_2h", checked)}
              />
              
              <NotificationToggle
                id="exchange_reminder_30min"
                title="30 Minutes Before"
                description="Get a final reminder 30 minutes before"
                checked={preferences.exchange_reminder_30min}
                disabled={!preferences.enabled || !preferences.upcoming_exchanges || saving}
                onChange={(checked) => handleTogglePreference("exchange_reminder_30min", checked)}
              />
            </div>
          )}

          <NotificationToggle
            id="document_uploads"
            title="Document Uploads"
            description="When new documents are shared with you"
            checked={preferences.document_uploads}
            disabled={!preferences.enabled || saving}
            onChange={(checked) => handleTogglePreference("document_uploads", checked)}
          />

          <NotificationToggle
            id="child_info_updates"
            title="Child Info Updates"
            description="When child information is updated"
            checked={preferences.child_info_updates}
            disabled={!preferences.enabled || saving}
            onChange={(checked) => handleTogglePreference("child_info_updates", checked)}
          />
        </div>
      </div>

      {/* Quiet Hours Notice */}
      <div className="p-4 rounded-xl bg-muted/30 border border-border">
        <div className="flex items-start gap-3">
          <BellOff className="w-5 h-5 text-muted-foreground mt-0.5" />
          <div>
            <p className="font-medium text-sm">Calm, Non-Intrusive Delivery</p>
            <p className="text-xs text-muted-foreground mt-1">
              We respect your time. Notifications are batched when possible, 
              and non-urgent updates may be delayed during evening hours (9 PM - 7 AM).
              Critical updates are always delivered immediately.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

interface NotificationToggleProps {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}

const NotificationToggle = ({
  id,
  title,
  description,
  checked,
  disabled,
  onChange,
}: NotificationToggleProps) => (
  <div className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-muted/30 transition-colors">
    <Label htmlFor={id} className="cursor-pointer flex-1">
      <p className="font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </Label>
    <Switch
      id={id}
      checked={checked}
      onCheckedChange={onChange}
      disabled={disabled}
    />
  </div>
);
