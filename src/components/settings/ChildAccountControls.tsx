import { useState } from "react";
import { motion } from "framer-motion";
import {
  Users,
  MessageSquare,
  Bell,
  Calendar,
  Smile,
  FileText,
  Lock,
  Unlock,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useChildPermissions, ChildAccountInfo } from "@/hooks/useChildPermissions";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

const PermissionToggle = ({
  label,
  description,
  icon: Icon,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  description: string;
  icon: React.ElementType;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) => (
  <div className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
    <Icon className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
    <div className="flex-1 min-w-0">
      <Label className="font-medium">{label}</Label>
      <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
    </div>
    <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
  </div>
);

const ChildAccountCard = ({
  account,
  onUpdatePermission,
  onToggleLogin,
}: {
  account: ChildAccountInfo;
  onUpdatePermission: (
    childProfileId: string,
    permission: string,
    value: boolean
  ) => Promise<boolean>;
  onToggleLogin: (childProfileId: string, enabled: boolean) => Promise<boolean>;
}) => {
  const [isUpdating, setIsUpdating] = useState(false);

  const handlePermissionChange = async (permission: string, value: boolean) => {
    setIsUpdating(true);
    await onUpdatePermission(account.profile_id, permission, value);
    setIsUpdating(false);
  };

  const handleLoginToggle = async (enabled: boolean) => {
    setIsUpdating(true);
    await onToggleLogin(account.profile_id, enabled);
    setIsUpdating(false);
  };

  const permissions = account.permissions;

  return (
    <Card className="relative overflow-hidden">
      {isUpdating && (
        <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}
      
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
              {account.child_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <CardTitle className="text-lg">{account.child_name}</CardTitle>
              <CardDescription>Child Account</CardDescription>
            </div>
          </div>
          <Badge variant={account.login_enabled ? "default" : "secondary"}>
            {account.login_enabled ? "Active" : "Disabled"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Account Status */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
          <div className="flex items-center gap-3">
            {account.login_enabled ? (
              <Unlock className="w-5 h-5 text-green-600" />
            ) : (
              <Lock className="w-5 h-5 text-muted-foreground" />
            )}
            <div>
              <p className="font-medium">
                {account.login_enabled ? "Login Enabled" : "Login Disabled"}
              </p>
              <p className="text-sm text-muted-foreground">
                {account.login_enabled
                  ? "Child can access their account"
                  : "Child cannot log in"}
              </p>
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant={account.login_enabled ? "destructive" : "default"} size="sm">
                {account.login_enabled ? "Disable" : "Enable"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {account.login_enabled ? "Disable Child Login?" : "Enable Child Login?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {account.login_enabled
                    ? "This will immediately prevent the child from logging in. Any active sessions will be invalidated."
                    : "This will allow the child to log in to their account again."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleLoginToggle(!account.login_enabled)}>
                  {account.login_enabled ? "Disable Login" : "Enable Login"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <Separator />

        {/* Messaging Permissions */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Messaging Permissions
          </h4>
          <div className="space-y-2">
            <PermissionToggle
              label="Message Parents"
              description="Allow sending messages to parents"
              icon={Users}
              checked={permissions?.allow_parent_messaging ?? true}
              onCheckedChange={(v) => handlePermissionChange("allow_parent_messaging", v)}
            />
            <PermissionToggle
              label="Family Group Chat"
              description="Allow participating in family group chats"
              icon={MessageSquare}
              checked={permissions?.allow_family_chat ?? true}
              onCheckedChange={(v) => handlePermissionChange("allow_family_chat", v)}
            />
            <PermissionToggle
              label="Sibling Messaging"
              description="Allow messaging with siblings"
              icon={Users}
              checked={permissions?.allow_sibling_messaging ?? true}
              onCheckedChange={(v) => handlePermissionChange("allow_sibling_messaging", v)}
            />
          </div>
        </div>

        <Separator />

        {/* Notification Permissions */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Notification Permissions
          </h4>
          <div className="space-y-2">
            <PermissionToggle
              label="Push Notifications"
              description="Allow push notifications (OFF by default for COPPA compliance)"
              icon={Bell}
              checked={permissions?.allow_push_notifications ?? false}
              onCheckedChange={(v) => handlePermissionChange("allow_push_notifications", v)}
            />
            <PermissionToggle
              label="Calendar Reminders"
              description="Allow calendar event reminders"
              icon={Calendar}
              checked={permissions?.allow_calendar_reminders ?? true}
              onCheckedChange={(v) => handlePermissionChange("allow_calendar_reminders", v)}
            />
          </div>
        </div>

        <Separator />

        {/* Calendar & Features */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Calendar & Features
          </h4>
          <div className="space-y-2">
            <PermissionToggle
              label="Full Event Details"
              description="Show full event details vs simplified labels"
              icon={Calendar}
              checked={permissions?.show_full_event_details ?? false}
              onCheckedChange={(v) => handlePermissionChange("show_full_event_details", v)}
            />
            <PermissionToggle
              label="Mood Check-ins"
              description="Allow emoji mood check-ins"
              icon={Smile}
              checked={permissions?.allow_mood_checkins ?? true}
              onCheckedChange={(v) => handlePermissionChange("allow_mood_checkins", v)}
            />
            <PermissionToggle
              label="Notes to Parents"
              description="Allow sending notes/messages to parents"
              icon={FileText}
              checked={permissions?.allow_notes_to_parents ?? true}
              onCheckedChange={(v) => handlePermissionChange("allow_notes_to_parents", v)}
            />
          </div>
        </div>

        {/* COPPA Notice */}
        <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-300">COPPA Compliance</p>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                Child accounts are created and managed by parents only. Push notifications are
                disabled by default. No tracking, ads, or behavioral profiling is applied to child
                accounts.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const ChildAccountControls = () => {
  const { childAccounts, loading, updatePermission, toggleLoginEnabled } = useChildPermissions();

  if (loading) {
    return <LoadingSpinner message="Loading child accounts..." />;
  }

  if (childAccounts.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Users className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Child Accounts</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            You can create child accounts from the Child Info Hub to give your children their own
            safe, controlled access to CoParrent.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Child Account Controls</h3>
        <p className="text-sm text-muted-foreground">
          Manage permissions and access for child accounts in your family.
        </p>
      </div>

      <div className="grid gap-6">
        {childAccounts.map((account, index) => (
          <motion.div
            key={account.profile_id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <ChildAccountCard
              account={account}
              onUpdatePermission={updatePermission}
              onToggleLogin={toggleLoginEnabled}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
};
