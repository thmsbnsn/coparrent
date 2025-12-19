import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, MessageSquare, Users, ArrowRight, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { format, differenceInYears } from "date-fns";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;
type Message = Tables<"messages">;
type Child = Tables<"children">;

interface ChildWithAge extends Child {
  age: number | null;
}

const Dashboard = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [coParent, setCoParent] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<(Message & { sender?: Profile })[]>([]);
  const [children, setChildren] = useState<ChildWithAge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;

    try {
      // Fetch user's profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      setProfile(profileData);

      // Fetch co-parent if linked
      if (profileData?.co_parent_id) {
        const { data: coParentData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", profileData.co_parent_id)
          .maybeSingle();
        setCoParent(coParentData);
      }

      // Fetch recent messages if profile exists
      if (profileData) {
        const { data: messagesData } = await supabase
          .from("messages")
          .select("*")
          .or(`sender_id.eq.${profileData.id},recipient_id.eq.${profileData.id}`)
          .order("created_at", { ascending: false })
          .limit(3);

        if (messagesData && messagesData.length > 0) {
          // Get sender profiles for messages
          const senderIds = [...new Set(messagesData.map(m => m.sender_id))];
          const { data: senderProfiles } = await supabase
            .from("profiles")
            .select("*")
            .in("id", senderIds);

          const messagesWithSenders = messagesData.map(msg => ({
            ...msg,
            sender: senderProfiles?.find(p => p.id === msg.sender_id)
          }));
          setMessages(messagesWithSenders);
        }

        // Fetch children linked to this parent
        const { data: parentChildren } = await supabase
          .from("parent_children")
          .select("child_id")
          .eq("parent_id", profileData.id);

        if (parentChildren && parentChildren.length > 0) {
          const childIds = parentChildren.map(pc => pc.child_id);
          const { data: childrenData } = await supabase
            .from("children")
            .select("*")
            .in("id", childIds);

          if (childrenData) {
            const childrenWithAge = childrenData.map(child => ({
              ...child,
              age: child.date_of_birth 
                ? differenceInYears(new Date(), new Date(child.date_of_birth))
                : null
            }));
            setChildren(childrenWithAge);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const getFirstName = () => {
    if (profile?.full_name) {
      return profile.full_name.split(" ")[0];
    }
    return "there";
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffHours < 48) return "Yesterday";
    return format(date, "MMM d");
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold">
              {getGreeting()}, {getFirstName()}
            </h1>
            <p className="text-muted-foreground mt-1">
              Here's what's happening with your co-parenting schedule
            </p>
          </div>
          <Button asChild>
            <Link to="/dashboard/calendar">
              View Full Calendar
              <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </Button>
        </motion.div>

        {/* Today's Schedule Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-border bg-card p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-display font-semibold">Today's Parenting Time</h2>
              <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-parent-a-light border border-parent-a">
              <p className="text-sm font-medium text-parent-a mb-1">Your parenting time</p>
              <p className="text-2xl font-display font-bold text-parent-a">
                {coParent ? "View calendar for details" : "Set up your schedule"}
              </p>
              <p className="text-sm text-parent-a/70 mt-2">
                {coParent ? `Co-parent: ${coParent.full_name || coParent.email}` : "Link with your co-parent to get started"}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-muted border border-border">
              <p className="text-sm font-medium text-muted-foreground mb-1">Quick actions</p>
              <div className="flex gap-2 mt-2">
                <Button variant="outline" size="sm" asChild>
                  <Link to="/dashboard/calendar">View Schedule</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/dashboard/messages">Send Message</Link>
                </Button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Upcoming Exchanges */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl border border-border bg-card p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold">Upcoming Exchanges</h3>
              <Clock className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="space-y-3">
              {coParent ? (
                <p className="text-sm text-muted-foreground">
                  Set up your custody schedule to see upcoming exchanges.
                </p>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-3">
                    Link with your co-parent to manage exchanges
                  </p>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/dashboard/settings">Set Up</Link>
                  </Button>
                </div>
              )}
            </div>
          </motion.div>

          {/* Recent Messages */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl border border-border bg-card p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold">Recent Messages</h3>
              <MessageSquare className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="space-y-3">
              {messages.length > 0 ? (
                messages.map((msg) => (
                  <Link
                    key={msg.id}
                    to="/dashboard/messages"
                    className="block p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium">
                        {msg.sender?.full_name || msg.sender?.email || "Unknown"}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {formatMessageTime(msg.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{msg.content}</p>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No messages yet
                </p>
              )}
            </div>
            <Button variant="ghost" className="w-full mt-3" asChild>
              <Link to="/dashboard/messages">View All Messages</Link>
            </Button>
          </motion.div>

          {/* Children Quick Access */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-2xl border border-border bg-card p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold">Your Children</h3>
              <Users className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="space-y-3">
              {children.length > 0 ? (
                children.map((child) => (
                  <Link
                    key={child.id}
                    to="/dashboard/children"
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                      {child.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{child.name}</p>
                      {child.age !== null && (
                        <p className="text-xs text-muted-foreground">{child.age} years old</p>
                      )}
                    </div>
                  </Link>
                ))
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-3">
                    Add your children's information
                  </p>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/dashboard/children">Add Child</Link>
                  </Button>
                </div>
              )}
            </div>
            <Button variant="ghost" className="w-full mt-3" asChild>
              <Link to="/dashboard/children">Manage Child Info</Link>
            </Button>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
