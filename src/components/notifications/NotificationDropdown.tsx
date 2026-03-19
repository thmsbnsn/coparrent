import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Bell, MoreHorizontal, ChevronDown, ChevronUp } from "lucide-react";
import { formatDistanceToNow, differenceInHours, differenceInDays } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  related_id: string | null;
  read_at: string | null;
  created_at: string;
}

interface GroupedNotification {
  latest: Notification;
  grouped: Notification[];
}

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  const now = new Date();
  const hoursAgo = differenceInHours(now, date);
  const daysAgo = differenceInDays(now, date);

  if (hoursAgo < 1) {
    return "Just now";
  } else if (hoursAgo < 24) {
    return `${hoursAgo}h ago`;
  } else if (daysAgo === 1) {
    return "1 day ago";
  } else {
    return `${daysAgo} days ago`;
  }
};

const groupConsecutiveNotifications = (notifications: Notification[]): GroupedNotification[] => {
  const result: GroupedNotification[] = [];
  let i = 0;

  while (i < notifications.length) {
    const current = notifications[i];
    const grouped: Notification[] = [];
    
    // Look for consecutive notifications of the same type
    let j = i + 1;
    while (j < notifications.length && notifications[j].type === current.type) {
      grouped.push(notifications[j]);
      j++;
    }

    result.push({
      latest: current,
      grouped: grouped.length > 0 ? grouped : [],
    });

    i = j;
  }

  return result;
};

export const NotificationDropdown = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [profileId, setProfileId] = useState<string | null>(null);

  // Get profile ID
  useEffect(() => {
    const fetchProfileId = async () => {
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile) {
        setProfileId(profile.id);
      }
    };

    fetchProfileId();
  }, [user]);

  // Fetch notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      if (!profileId) return;

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", profileId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (!error && data) {
        setNotifications(data);
      }
      setLoading(false);
    };

    fetchNotifications();

    // Subscribe to realtime updates
    if (profileId) {
      const channel = supabase
        .channel("notifications-realtime")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${profileId}`,
          },
          (payload) => {
            if (payload.eventType === "INSERT") {
              setNotifications((prev) => [payload.new as Notification, ...prev]);
            } else if (payload.eventType === "UPDATE") {
              setNotifications((prev) =>
                prev.map((n) => (n.id === payload.new.id ? (payload.new as Notification) : n))
              );
            } else if (payload.eventType === "DELETE") {
              setNotifications((prev) => prev.filter((n) => n.id !== payload.old.id));
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [profileId]);

  const unreadCount = notifications.filter((n) => !n.read_at).length;
  const recentNotifications = notifications.slice(0, 10);
  const groupedNotifications = groupConsecutiveNotifications(recentNotifications).slice(0, 5);

  const markAsRead = async (notificationId: string) => {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId);
  };

  const markAllAsRead = async () => {
    if (!profileId) return;
    
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", profileId)
      .is("read_at", null);
  };

  const toggleGroupExpand = (notificationId: string) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(notificationId)) {
        newSet.delete(notificationId);
      } else {
        newSet.add(notificationId);
      }
      return newSet;
    });
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "schedule_change":
        return "📅";
      case "new_message":
        return "💬";
      case "document_upload":
        return "📄";
      case "child_info_update":
        return "👶";
      default:
        return "🔔";
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-destructive" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 max-h-[480px] overflow-y-auto bg-popover border border-border shadow-lg z-50"
      >
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead}>
              Mark all read
            </Button>
          )}
        </div>

        {loading ? (
          <div className="p-4 text-center text-muted-foreground">Loading...</div>
        ) : groupedNotifications.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">No notifications yet</div>
        ) : (
          <div className="py-1">
            {groupedNotifications.map((group) => (
              <div key={group.latest.id}>
                <DropdownMenuItem
                  className={cn(
                    "flex items-start gap-3 p-3 cursor-pointer",
                    !group.latest.read_at && "bg-primary/5"
                  )}
                  onClick={() => markAsRead(group.latest.id)}
                >
                  <span className="text-lg flex-shrink-0">
                    {getNotificationIcon(group.latest.type)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm truncate">{group.latest.title}</p>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimestamp(group.latest.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {group.latest.message}
                    </p>
                    {group.grouped.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-1 h-6 px-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleGroupExpand(group.latest.id);
                        }}
                      >
                        <MoreHorizontal className="w-3 h-3 mr-1" />
                        {group.grouped.length} more
                        {expandedGroups.has(group.latest.id) ? (
                          <ChevronUp className="w-3 h-3 ml-1" />
                        ) : (
                          <ChevronDown className="w-3 h-3 ml-1" />
                        )}
                      </Button>
                    )}
                  </div>
                </DropdownMenuItem>

                {/* Expanded grouped notifications */}
                {expandedGroups.has(group.latest.id) &&
                  group.grouped.map((notification) => (
                    <DropdownMenuItem
                      key={notification.id}
                      className={cn(
                        "flex items-start gap-3 p-3 pl-10 cursor-pointer border-l-2 border-muted ml-4",
                        !notification.read_at && "bg-primary/5"
                      )}
                      onClick={() => markAsRead(notification.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-sm truncate">{notification.title}</p>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatTimestamp(notification.created_at)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                      </div>
                    </DropdownMenuItem>
                  ))}
              </div>
            ))}
          </div>
        )}

        <DropdownMenuSeparator />
        <div className="p-2">
          <Button variant="ghost" className="w-full justify-center" asChild>
            <Link to="/dashboard/notifications">See all notifications</Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
