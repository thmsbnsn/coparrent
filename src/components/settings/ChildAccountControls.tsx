import { useEffect, useState, type ElementType } from "react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Bell,
  Calendar,
  History,
  Loader2,
  Lock,
  MessageSquare,
  PhoneCall,
  Settings2,
  ShieldCheck,
  Unlock,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import {
  useChildPermissions,
  type ChildAccountInfo,
  type FamilyContactOption,
} from "@/hooks/useChildPermissions";
import { useKidPortalApprovals } from "@/hooks/useKidPortalApprovals";
import { ParentApprovalSheet } from "@/components/kids/ParentApprovalSheet";
import { ChildAccessSettingsCard } from "@/components/settings/ChildAccessSettingsCard";
import { ChildRestrictionsCard } from "@/components/settings/ChildRestrictionsCard";
import type { ChildCallMode, KidPortalMode } from "@/lib/kidsPortal";

const PermissionToggle = ({
  checked,
  description,
  disabled,
  icon: Icon,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  description: string;
  disabled?: boolean;
  icon: ElementType;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) => (
  <div className="flex items-start gap-4 rounded-2xl border bg-card px-4 py-4">
    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
    <div className="min-w-0 flex-1">
      <Label className="font-medium">{label}</Label>
      <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
    </div>
    <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
  </div>
);

const ContactCheckbox = ({
  checked,
  contact,
  onToggle,
}: {
  checked: boolean;
  contact: FamilyContactOption;
  onToggle: () => void;
}) => (
  <button
    type="button"
    onClick={onToggle}
    className={`rounded-2xl border px-4 py-3 text-left transition ${
      checked
        ? "border-primary bg-primary/5"
        : "border-border bg-background hover:bg-muted/40"
    }`}
  >
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="font-medium">{contact.full_name || "Family member"}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {contact.relationship_label || contact.role.replace(/_/g, " ")}
        </p>
      </div>
      <div
        className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold ${
          checked
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border text-muted-foreground"
        }`}
      >
        {checked ? "✓" : ""}
      </div>
    </div>
  </button>
);

const ChildAccountCard = ({
  account,
  familyContacts,
  onLoadHistory,
  onSaveCallSettings,
  onSavePortalSettings,
  onToggleLogin,
  onUpdatePermission,
}: {
  account: ChildAccountInfo;
  familyContacts: FamilyContactOption[];
  onLoadHistory: (childId: string) => Promise<Array<Record<string, unknown>>>;
  onSaveCallSettings: (payload: {
    additional_information?: string;
    allowed_inbound_member_ids: string[];
    allowed_outbound_member_ids: string[];
    call_mode: ChildCallMode;
    calling_enabled: boolean;
  }) => Promise<boolean>;
  onSaveDeviceAccessSettings: (payload: {
    allowed_game_slugs?: string[] | null;
    allowed_sign_in_mode?: "standard_sign_in" | null;
    communication_enabled?: boolean | null;
    games_enabled?: boolean | null;
    multiplayer_enabled?: boolean | null;
    quick_unlock_enabled?: boolean | null;
    screen_time_daily_minutes?: number | null;
    screen_time_enabled?: boolean | null;
  }) => Promise<boolean>;
  onSavePortalSettings: (payload: {
    child_email?: string | null;
    child_username?: string | null;
    portal_mode?: KidPortalMode;
    reset_via_child_email?: boolean | null;
  }) => Promise<boolean>;
  onToggleLogin: (enabled: boolean) => Promise<boolean>;
  onUpdatePermission: (permission: keyof ChildAccountInfo["permissions"], value: boolean) => Promise<boolean>;
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [portalMode, setPortalMode] = useState<KidPortalMode>(account.portal_mode);
  const [childUsername, setChildUsername] = useState(account.child_username || "");
  const [childEmail, setChildEmail] = useState(account.child_email || "");
  const [resetViaChildEmail, setResetViaChildEmail] = useState(Boolean(account.child_email));
  const [callingEnabled, setCallingEnabled] = useState(account.call_settings.calling_enabled);
  const [callMode, setCallMode] = useState<ChildCallMode>(account.call_settings.call_mode);
  const [allowedOutbound, setAllowedOutbound] = useState<string[]>(account.call_settings.allowed_outbound_member_ids);
  const [allowedInbound, setAllowedInbound] = useState<string[]>(account.call_settings.allowed_inbound_member_ids);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRows, setHistoryRows] = useState<Array<Record<string, unknown>>>([]);
  const [changeNote, setChangeNote] = useState("");
  const [quickUnlockEnabled, setQuickUnlockEnabled] = useState(account.device_access.quick_unlock_enabled);
  const [screenTimeEnabled, setScreenTimeEnabled] = useState(account.device_access.screen_time_enabled);
  const [screenTimeDailyMinutes, setScreenTimeDailyMinutes] = useState(
    account.device_access.screen_time_daily_minutes?.toString() ?? "",
  );
  const [communicationEnabled, setCommunicationEnabled] = useState(account.device_access.communication_enabled);
  const [gamesEnabled, setGamesEnabled] = useState(account.device_access.games_enabled);
  const [multiplayerEnabled, setMultiplayerEnabled] = useState(account.device_access.multiplayer_enabled);
  const [allowedGameSlugs, setAllowedGameSlugs] = useState(account.device_access.allowed_game_slugs);

  useEffect(() => {
    setPortalMode(account.portal_mode);
    setChildUsername(account.child_username || "");
    setChildEmail(account.child_email || "");
    setResetViaChildEmail(Boolean(account.reset_via_child_email ?? account.child_email));
    setCallingEnabled(account.call_settings.calling_enabled);
    setCallMode(account.call_settings.call_mode);
    setAllowedOutbound(account.call_settings.allowed_outbound_member_ids);
    setAllowedInbound(account.call_settings.allowed_inbound_member_ids);
    setQuickUnlockEnabled(account.device_access.quick_unlock_enabled);
    setScreenTimeEnabled(account.device_access.screen_time_enabled);
    setScreenTimeDailyMinutes(account.device_access.screen_time_daily_minutes?.toString() ?? "");
    setCommunicationEnabled(account.device_access.communication_enabled);
    setGamesEnabled(account.device_access.games_enabled);
    setMultiplayerEnabled(account.device_access.multiplayer_enabled);
    setAllowedGameSlugs(account.device_access.allowed_game_slugs);
  }, [account]);

  const updateBusyState = async (action: () => Promise<boolean>) => {
    setIsUpdating(true);
    try {
      return await action();
    } finally {
      setIsUpdating(false);
    }
  };

  const toggleMembership = (current: string[], membershipId: string) =>
    current.includes(membershipId)
      ? current.filter((value) => value !== membershipId)
      : [...current, membershipId];

  const toggleAllowedGame = (gameSlug: string) =>
    setAllowedGameSlugs((current) =>
      current.includes(gameSlug)
        ? current.filter((value) => value !== gameSlug)
        : [...current, gameSlug],
    );

  return (
    <Card className="relative overflow-hidden rounded-[2rem] border border-border bg-card/95">
      {isUpdating && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      <CardHeader className="pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
              {account.child_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <CardTitle className="text-xl">{account.child_name}</CardTitle>
              <CardDescription className="mt-1">
                {account.portal_mode === "under_6" ? "Under-6 request-only portal" : "Ages 6-12 credential portal"}
              </CardDescription>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={account.login_enabled ? "default" : "secondary"}>
              {account.login_enabled ? "Credentials on" : "Credentials off"}
            </Badge>
            <Badge variant="outline">
              {account.has_account ? "Child account ready" : "No child account yet"}
            </Badge>
            <Button asChild variant="outline" className="rounded-full">
              <Link to={`/dashboard/settings/child-access/${account.child_id}`}>
                Device setup wizard
              </Link>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="rounded-[1.75rem] bg-muted/40 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              {account.login_enabled ? (
                <Unlock className="mt-0.5 h-5 w-5 text-emerald-600" />
              ) : (
                <Lock className="mt-0.5 h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium">
                  {account.login_enabled ? "Child credentials are enabled" : "Child credentials are disabled"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Under-6 portal access still requires live approval. Ages 6-12 can use username and password when enabled.
                </p>
              </div>
            </div>

            {account.child_profile_id ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant={account.login_enabled ? "destructive" : "default"}>
                    {account.login_enabled ? "Disable login" : "Enable login"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {account.login_enabled ? "Disable child login?" : "Enable child login?"}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This changes credential-based access for this child account and is enforced server-side.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() =>
                        void updateBusyState(() => onToggleLogin(!account.login_enabled))
                      }
                    >
                      {account.login_enabled ? "Disable login" : "Enable login"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <div className="rounded-full bg-amber-50 px-4 py-2 text-sm text-amber-800">
                Create a child account before enabling credential login.
              </div>
            )}
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-medium text-muted-foreground">Portal mode and reset path</h4>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label>Portal mode</Label>
              <Select value={portalMode} onValueChange={(value: KidPortalMode) => setPortalMode(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="under_6">Under 6: parent approval button</SelectItem>
                  <SelectItem value="age_6_to_12">Ages 6-12: username and password</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Child username</Label>
              <Input
                value={childUsername}
                onChange={(event) => setChildUsername(event.target.value)}
                placeholder={account.has_account ? "kid-username" : "Create a child account first"}
                disabled={!account.has_account}
              />
            </div>

            <div className="space-y-2">
              <Label>Child reset email</Label>
              <Input
                type="email"
                value={childEmail}
                onChange={(event) => setChildEmail(event.target.value)}
                placeholder="child@example.com"
              />
            </div>

            <div className="rounded-2xl border bg-muted/30 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">Self-reset with child email</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Default stays parent-managed unless this email path is switched on.
                  </p>
                </div>
                <Switch checked={resetViaChildEmail} onCheckedChange={setResetViaChildEmail} />
              </div>
            </div>
          </div>

          {!account.has_account && portalMode === "age_6_to_12" ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Ages 6-12 mode needs a real child account before username and password can be used.
            </div>
          ) : null}

          <Button
            type="button"
            className="rounded-full"
            onClick={() =>
              void updateBusyState(() =>
                onSavePortalSettings({
                  child_email: childEmail || null,
                  child_username: childUsername || null,
                  portal_mode: portalMode,
                  reset_via_child_email: resetViaChildEmail,
                }),
              )
            }
          >
            Save portal settings
          </Button>
        </div>

        <Separator />

        <ChildAccessSettingsCard
          allowedSignInMode={account.device_access.allowed_sign_in_mode}
          childEmailResetEnabled={account.device_access.child_email_reset_enabled}
          childName={account.child_name}
          hasAccount={account.has_account}
          loginEnabled={account.login_enabled}
          onQuickUnlockEnabledChange={setQuickUnlockEnabled}
          onSave={() =>
            void updateBusyState(() =>
              onSaveDeviceAccessSettings({
                allowed_sign_in_mode: account.device_access.allowed_sign_in_mode,
                quick_unlock_enabled: quickUnlockEnabled,
              }),
            )
          }
          quickUnlockEnabled={quickUnlockEnabled}
        />

        <Separator />

        <ChildRestrictionsCard
          allowedGameSlugs={allowedGameSlugs}
          communicationEnabled={communicationEnabled}
          gamesEnabled={gamesEnabled}
          multiplayerEnabled={multiplayerEnabled}
          onAllowedGameToggle={toggleAllowedGame}
          onCommunicationEnabledChange={setCommunicationEnabled}
          onGamesEnabledChange={setGamesEnabled}
          onMultiplayerEnabledChange={setMultiplayerEnabled}
          onSave={() =>
            void updateBusyState(() =>
              onSaveDeviceAccessSettings({
                allowed_game_slugs: allowedGameSlugs,
                allowed_sign_in_mode: account.device_access.allowed_sign_in_mode,
                communication_enabled: communicationEnabled,
                games_enabled: gamesEnabled,
                multiplayer_enabled: multiplayerEnabled,
                quick_unlock_enabled: quickUnlockEnabled,
                screen_time_daily_minutes:
                  screenTimeDailyMinutes.trim() === "" ? null : Number(screenTimeDailyMinutes),
                screen_time_enabled: screenTimeEnabled,
              }),
            )
          }
          onScreenTimeDailyMinutesChange={setScreenTimeDailyMinutes}
          onScreenTimeEnabledChange={setScreenTimeEnabled}
          screenTimeDailyMinutes={screenTimeDailyMinutes}
          screenTimeEnabled={screenTimeEnabled}
        />

        <Separator />

        <div>
          <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <MessageSquare className="h-4 w-4" />
            Messaging permissions
          </h4>
          <div className="space-y-2">
            <PermissionToggle
              checked={account.permissions.allow_parent_messaging}
              description="Allow sending messages to parents."
              icon={Users}
              label="Message parents"
              onCheckedChange={(value) =>
                void updateBusyState(() => onUpdatePermission("allow_parent_messaging", value))
              }
            />
            <PermissionToggle
              checked={account.permissions.allow_family_chat}
              description="Allow child-safe family chat participation."
              icon={MessageSquare}
              label="Family chat"
              onCheckedChange={(value) =>
                void updateBusyState(() => onUpdatePermission("allow_family_chat", value))
              }
            />
            <PermissionToggle
              checked={account.permissions.allow_sibling_messaging}
              description="Allow sibling-to-sibling conversations."
              icon={Users}
              label="Sibling messaging"
              onCheckedChange={(value) =>
                void updateBusyState(() => onUpdatePermission("allow_sibling_messaging", value))
              }
            />
          </div>
        </div>

        <Separator />

        <div>
          <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Bell className="h-4 w-4" />
            Alerts and simple tools
          </h4>
          <div className="space-y-2">
            <PermissionToggle
              checked={account.permissions.allow_push_notifications}
              description="Child push remains off by default unless you explicitly allow it."
              icon={Bell}
              label="Push notifications"
              onCheckedChange={(value) =>
                void updateBusyState(() => onUpdatePermission("allow_push_notifications", value))
              }
            />
            <PermissionToggle
              checked={account.permissions.allow_calendar_reminders}
              description="Show simple reminders for upcoming events."
              icon={Calendar}
              label="Calendar reminders"
              onCheckedChange={(value) =>
                void updateBusyState(() => onUpdatePermission("allow_calendar_reminders", value))
              }
            />
            <PermissionToggle
              checked={account.permissions.allow_mood_checkins}
              description="Keep the emoji check-in available on the kids dashboard."
              icon={ShieldCheck}
              label="Mood check-ins"
              onCheckedChange={(value) =>
                void updateBusyState(() => onUpdatePermission("allow_mood_checkins", value))
              }
            />
            <PermissionToggle
              checked={account.permissions.show_full_event_details}
              description="Show full schedule details instead of simplified labels."
              icon={Calendar}
              label="Full event details"
              onCheckedChange={(value) =>
                void updateBusyState(() => onUpdatePermission("show_full_event_details", value))
              }
            />
            <PermissionToggle
              checked={account.permissions.allow_notes_to_parents}
              description="Let the child send notes back to parents from child-safe surfaces."
              icon={MessageSquare}
              label="Notes to parents"
              onCheckedChange={(value) =>
                void updateBusyState(() => onUpdatePermission("allow_notes_to_parents", value))
              }
            />
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <PhoneCall className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-medium text-muted-foreground">Child calling permissions</h4>
          </div>

          <div className="rounded-[1.75rem] border bg-muted/30 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">Calling enabled</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Child calling only appears on the Kids Dashboard when this is on and approved people are selected.
                </p>
              </div>
              <Switch checked={callingEnabled} onCheckedChange={setCallingEnabled} />
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <div className="space-y-3">
              <Label>People this child can call</Label>
              <div className="grid gap-3">
                {familyContacts.map((contact) => (
                  <ContactCheckbox
                    key={`outbound-${contact.membership_id}`}
                    checked={allowedOutbound.includes(contact.membership_id)}
                    contact={contact}
                    onToggle={() =>
                      setAllowedOutbound((current) => toggleMembership(current, contact.membership_id))
                    }
                  />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label>People allowed to call this child</Label>
              <div className="grid gap-3">
                {familyContacts.map((contact) => (
                  <ContactCheckbox
                    key={`inbound-${contact.membership_id}`}
                    checked={allowedInbound.includes(contact.membership_id)}
                    contact={contact}
                    onToggle={() =>
                      setAllowedInbound((current) => toggleMembership(current, contact.membership_id))
                    }
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
            <div className="space-y-2">
              <Label>Call mode</Label>
              <Select value={callMode} onValueChange={(value: ChildCallMode) => setCallMode(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="audio_only">Audio only</SelectItem>
                  <SelectItem value="audio_video">Audio + video</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Additional information about this change</Label>
              <Textarea
                value={changeNote}
                onChange={(event) => setChangeNote(event.target.value)}
                placeholder="Optional context for the other parent or guardian"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              className="rounded-full"
              onClick={() =>
                void updateBusyState(async () => {
                  const success = await onSaveCallSettings({
                    additional_information: changeNote,
                    allowed_inbound_member_ids: allowedInbound,
                    allowed_outbound_member_ids: allowedOutbound,
                    call_mode: callMode,
                    calling_enabled: callingEnabled,
                  });

                  if (success) {
                    setChangeNote("");
                  }

                  return success;
                })
              }
            >
              Save calling rules
            </Button>

            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={async () => {
                setHistoryLoading(true);
                try {
                  setHistoryRows(await onLoadHistory(account.child_id));
                } finally {
                  setHistoryLoading(false);
                }
              }}
            >
              <History className="mr-2 h-4 w-4" />
              Refresh history
            </Button>
          </div>

          <div className="rounded-[1.75rem] border bg-background p-4">
            <div className="mb-3 flex items-center gap-2">
              <UserRoundCheck className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">Change history</p>
            </div>

            {historyLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading history...
              </div>
            ) : historyRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No saved calling permission changes yet for this child.
              </p>
            ) : (
              <div className="space-y-3">
                {historyRows.map((row) => (
                  <div key={String(row.id)} className="rounded-2xl bg-muted/40 p-4">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <p className="font-medium">{String(row.actor_name || "Family member")}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.created_at
                          ? formatDistanceToNow(new Date(String(row.created_at)), { addSuffix: true })
                          : "Time unavailable"}
                      </p>
                    </div>
                    {row.additional_information ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {String(row.additional_information)}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-medium text-amber-800">Safety and logging</p>
              <p className="mt-1 text-sm text-amber-700">
                Family scope is required for every change. Calling permissions are enforced on the
                server and each update is stored with before-and-after details.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const ChildAccountControls = () => {
  const {
    childAccounts,
    familyContacts,
    getCallHistory,
    loading,
    scopeError,
    toggleLoginEnabled,
    updateCallSettings,
    updateDeviceAccessSettings,
    updatePermission,
    updatePortalSettings,
  } = useChildPermissions();
  const {
    decideRequest,
    loading: approvalsLoading,
    requests,
    scopeError: approvalScopeError,
  } = useKidPortalApprovals();
  const [approvalSheetOpen, setApprovalSheetOpen] = useState(false);

  if (loading) {
    return <LoadingSpinner message="Loading child accounts..." />;
  }

  if (scopeError) {
    return (
      <Card className="border-dashed border-amber-500/40 bg-amber-50/40 dark:bg-amber-900/10">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <AlertTriangle className="mb-4 h-12 w-12 text-amber-600" />
          <h3 className="mb-2 text-lg font-medium">Family Scope Required</h3>
          <p className="max-w-md text-sm text-muted-foreground">{scopeError}</p>
        </CardContent>
      </Card>
    );
  }

  if (childAccounts.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Users className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-medium">No Child Accounts</h3>
          <p className="max-w-md text-center text-sm text-muted-foreground">
            You can create child accounts from the Child Info Hub to give your children their own
            safe, controlled access to CoParrent.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-border bg-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-medium">Child account controls</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage kid portal modes, device access, quick unlock, communication and game
              restrictions, child calling permissions, and approval flow settings for the active
              family.
            </p>
            {approvalScopeError ? (
              <p className="mt-2 text-sm text-amber-700">{approvalScopeError}</p>
            ) : null}
          </div>

          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => setApprovalSheetOpen(true)}
          >
            Pending approvals
            {requests.length > 0 ? (
              <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                {requests.length}
              </span>
            ) : null}
          </Button>
        </div>
      </div>

      <ParentApprovalSheet
        loading={approvalsLoading}
        open={approvalSheetOpen}
        onOpenChange={setApprovalSheetOpen}
        onDecision={async (requestId, decision) => {
          await decideRequest(requestId, decision);
        }}
        requests={requests}
      />

      <div className="grid gap-6">
        {childAccounts.map((account, index) => (
          <motion.div
            key={account.child_id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
          >
            <ChildAccountCard
              account={account}
              familyContacts={familyContacts}
              onLoadHistory={getCallHistory}
              onSaveCallSettings={(payload) => updateCallSettings(account.child_id, payload)}
              onSaveDeviceAccessSettings={(payload) => updateDeviceAccessSettings(account.child_id, payload)}
              onSavePortalSettings={(payload) => updatePortalSettings(account.child_id, payload)}
              onToggleLogin={(enabled) =>
                account.child_profile_id ? toggleLoginEnabled(account.child_profile_id, enabled) : Promise.resolve(false)
              }
              onUpdatePermission={(permission, value) =>
                account.child_profile_id ? updatePermission(account.child_profile_id, permission, value) : Promise.resolve(false)
              }
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
};
