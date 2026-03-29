import { useState, useEffect, useCallback, useMemo } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { Monitor, Smartphone, Tablet, Shield, ShieldCheck, Trash2, Loader2 } from "lucide-react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface UserDevice {
  id: string;
  device_fingerprint: string;
  device_name: string;
  browser: string;
  os: string;
  ip_address: string;
  location: string | null;
  first_seen_at: string;
  last_seen_at: string;
  is_trusted: boolean;
}

interface DeviceGroup {
  signature: string;
  devices: UserDevice[];
}

const getDeviceIcon = (deviceName: string) => {
  const name = deviceName.toLowerCase();
  if (name.includes("mobile") || name.includes("phone")) {
    return <Smartphone className="w-5 h-5" />;
  }
  if (name.includes("tablet") || name.includes("ipad")) {
    return <Tablet className="w-5 h-5" />;
  }
  return <Monitor className="w-5 h-5" />;
};

const getDeviceSignature = (device: UserDevice) =>
  [device.device_name, device.browser, device.os, device.location ?? ""].join("|");

const groupSimilarDevices = (devices: UserDevice[]): DeviceGroup[] => {
  const groups = new Map<string, UserDevice[]>();

  devices.forEach((device) => {
    const signature = getDeviceSignature(device);
    const existing = groups.get(signature) ?? [];
    existing.push(device);
    groups.set(signature, existing);
  });

  return Array.from(groups.entries())
    .map(([signature, groupedDevices]) => ({
      signature,
      devices: [...groupedDevices].sort(
        (a, b) => new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime(),
      ),
    }))
    .sort(
      (a, b) =>
        new Date(b.devices[0].last_seen_at).getTime() - new Date(a.devices[0].last_seen_at).getTime(),
    );
};

export const TrustedDevicesManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [devices, setDevices] = useState<UserDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const groupedDevices = useMemo(() => groupSimilarDevices(devices), [devices]);

  const fetchDevices = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("user_devices")
        .select("*")
        .eq("user_id", user.id)
        .order("last_seen_at", { ascending: false });

      if (error) throw error;
      setDevices(data || []);
    } catch (error) {
      console.error("Error fetching devices:", error);
      toast({
        title: "Error",
        description: "Failed to load devices",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (user) {
      void fetchDevices();
    }
  }, [user, fetchDevices]);

  const toggleTrust = async (deviceId: string, currentTrusted: boolean) => {
    setActionLoading(deviceId);
    try {
      const { error } = await supabase
        .from("user_devices")
        .update({ is_trusted: !currentTrusted })
        .eq("id", deviceId);

      if (error) throw error;

      setDevices(devices.map(d => 
        d.id === deviceId ? { ...d, is_trusted: !currentTrusted } : d
      ));

      toast({
        title: currentTrusted ? "Device untrusted" : "Device trusted",
        description: currentTrusted 
          ? "This device will now trigger login notifications"
          : "This device is now trusted and won't trigger login notifications",
      });
    } catch (error) {
      console.error("Error updating device:", error);
      toast({
        title: "Error",
        description: "Failed to update device",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const removeDevice = async (deviceId: string) => {
    setActionLoading(deviceId);
    try {
      const { error } = await supabase
        .from("user_devices")
        .delete()
        .eq("id", deviceId);

      if (error) throw error;

      setDevices(devices.filter(d => d.id !== deviceId));

      toast({
        title: "Device removed",
        description: "The device has been removed from your account",
      });
    } catch (error) {
      console.error("Error removing device:", error);
      toast({
        title: "Error",
        description: "Failed to remove device",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const toggleGroup = (signature: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [signature]: !prev[signature],
    }));
  };

  const renderDeviceCard = (device: UserDevice, showGroupedHint?: string) => (
    <div
      key={device.id}
      className={`p-4 rounded-lg border ${
        device.is_trusted
          ? "border-primary/30 bg-primary/5"
          : "border-border bg-muted/30"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${
            device.is_trusted ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          }`}>
            {getDeviceIcon(device.device_name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">{device.device_name}</span>
              {device.is_trusted && (
                <Badge variant="default" className="text-xs">
                  <ShieldCheck className="w-3 h-3 mr-1" />
                  Trusted
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {device.browser} on {device.os}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
              <span>First seen: {format(new Date(device.first_seen_at), "MMM d, yyyy")}</span>
              <span>Last active: {formatDistanceToNow(new Date(device.last_seen_at), { addSuffix: true })}</span>
              {device.ip_address && device.ip_address !== "Unknown" && (
                <span>IP: {device.ip_address}</span>
              )}
            </div>
            {showGroupedHint && (
              <p className="mt-2 text-xs text-muted-foreground">{showGroupedHint}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant={device.is_trusted ? "outline" : "default"}
            size="sm"
            onClick={() => toggleTrust(device.id, device.is_trusted)}
            disabled={actionLoading === device.id}
          >
            {actionLoading === device.id ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : device.is_trusted ? (
              <>
                <Shield className="w-4 h-4 mr-1" />
                Untrust
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 mr-1" />
                Trust
              </>
            )}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                disabled={actionLoading === device.id}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove Device</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to remove "{device.device_name}" from your trusted devices?
                  You'll receive a login notification the next time this browser accesses your account.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => removeDevice(device.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Monitor className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="font-medium">No devices recorded</p>
        <p className="text-sm">Devices will appear here after you log in</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Trusted Devices</h3>
          <p className="text-sm text-muted-foreground">
            Review browsers that have accessed your account and collapse similar sign-ins when the list gets noisy
          </p>
        </div>
        <Badge variant="secondary">{devices.length} device{devices.length !== 1 ? 's' : ''}</Badge>
      </div>

      <div className="space-y-3">
        {groupedDevices.map((group) => {
          const [latestDevice, ...olderDevices] = group.devices;
          const isExpanded = expandedGroups[group.signature] ?? false;

          return (
            <div key={group.signature} className="space-y-2">
              {renderDeviceCard(
                latestDevice,
                olderDevices.length > 0
                  ? `${olderDevices.length} similar sign-in record${olderDevices.length === 1 ? "" : "s"} hidden below this one.`
                  : undefined,
              )}

              {olderDevices.length > 0 && (
                <div className="pl-4">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs text-muted-foreground"
                    onClick={() => toggleGroup(group.signature)}
                  >
                    {isExpanded
                      ? `Hide ${olderDevices.length} older similar record${olderDevices.length === 1 ? "" : "s"}`
                      : `Show ${olderDevices.length} older similar record${olderDevices.length === 1 ? "" : "s"}`}
                  </Button>
                </div>
              )}

              {isExpanded &&
                olderDevices.map((device) =>
                  renderDeviceCard(device, "Older similar browser record retained for security history."),
                )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground pt-2">
        Trusted devices won't trigger login notifications. Similar entries are grouped so it is easier to spot something you do not recognize.
      </p>
    </div>
  );
};
