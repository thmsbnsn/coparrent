/**
 * @page-role Overview
 * @summary-pattern Parenting time summary + messages widget + children quick access
 * @ownership Parent A (blue) highlights current user's time; neutral for shared
 * @court-view N/A (Dashboard is navigational, not evidentiary)
 * 
 * LAW 1: Overview role - summary-first, minimal direct actions
 * LAW 2: Summary cards answer "what's happening today" before detail
 * LAW 3: Ownership uses parent-a semantic tokens for user distinction
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, MessageSquare, Users, ArrowRight, Clock, BookHeart, DollarSign, Phone } from "lucide-react";
import { Link } from "react-router-dom";
import { format, differenceInYears, parseISO } from "date-fns";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { StatusPill } from "@/components/ui/StatusPill";
import { ExchangeCheckin } from "@/components/exchange/ExchangeCheckin";
import { SubscriptionBanner } from "@/components/dashboard/SubscriptionBanner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useFamilyRole } from "@/hooks/useFamilyRole";
import { useRealtimeChildren } from "@/hooks/useRealtimeChildren";
import { BlogDashboardCard } from "@/components/dashboard/BlogDashboardCard";
import { resolveSenderName } from "@/lib/displayResolver";
import { fetchFamilyParentProfiles, type FamilyParentProfile } from "@/lib/familyScope";
import { canAccessProtectedRoute } from "@/lib/routeAccess";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;
type CustodySchedule = Tables<"custody_schedules">;

interface RecentMessage {
  id: string;
  thread_id: string;
  content: string;
  created_at: string;
  sender_id: string;
  sender?: Profile;
}

const Dashboard = () => {
  const { user } = useAuth();
  const { isThirdParty, profileId: activeProfileId, activeFamilyId } = useFamilyRole();
  const { children: realtimeChildren } = useRealtimeChildren();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [otherParent, setOtherParent] = useState<FamilyParentProfile | null>(null);
  const [messages, setMessages] = useState<RecentMessage[]>([]);
  const [schedule, setSchedule] = useState<CustodySchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [journalCount, setJournalCount] = useState(0);
  const requestVersionRef = useRef(0);

  // Map children with age
  const children = realtimeChildren.map(child => ({
    ...child,
    age: child.date_of_birth 
      ? differenceInYears(new Date(), new Date(child.date_of_birth))
      : null
  }));

  const fetchDashboardData = useCallback(async () => {
    const requestVersion = ++requestVersionRef.current;

    if (!user || !activeProfileId || !activeFamilyId) {
      if (requestVersion === requestVersionRef.current) {
        setProfile(null);
        setOtherParent(null);
        setMessages([]);
        setSchedule(null);
        setJournalCount(0);
        setLoading(false);
      }
      return;
    }

    setLoading(true);

    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const [
        profileRes,
        familyParentProfiles,
        threadsRes,
        scheduleRes,
        journalRes,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .eq("id", activeProfileId)
          .maybeSingle(),
        fetchFamilyParentProfiles(activeFamilyId),
        supabase
          .from("message_threads")
          .select("id")
          .eq("family_id", activeFamilyId),
        supabase
          .from("custody_schedules")
          .select("*")
          .eq("family_id", activeFamilyId)
          .maybeSingle(),
        supabase
          .from("journal_entries")
          .select("*", { count: 'exact', head: true })
          .eq("user_id", user.id)
          .gte("created_at", startOfMonth.toISOString()),
      ]);

      if (requestVersion !== requestVersionRef.current) {
        return;
      }

      setProfile(profileRes.data ?? null);
      setOtherParent(familyParentProfiles.find((familyParent) => familyParent.profileId !== activeProfileId) ?? null);
      setSchedule(scheduleRes.data ?? null);
      setJournalCount(journalRes.count || 0);

      const threadIds = (threadsRes.data ?? []).map((thread) => thread.id);
      if (threadIds.length === 0) {
        setMessages([]);
        return;
      }

      const { data: messagesData } = await supabase
        .from("thread_messages")
        .select("*")
        .in("thread_id", threadIds)
        .order("created_at", { ascending: false })
        .limit(3);

      if (requestVersion !== requestVersionRef.current) {
        return;
      }

      if (!messagesData || messagesData.length === 0) {
        setMessages([]);
        return;
      }

      const senderIds = [...new Set(messagesData.map((message) => message.sender_id))];
      const { data: senderProfiles } = await supabase
        .from("profiles")
        .select("*")
        .in("id", senderIds);

      if (requestVersion !== requestVersionRef.current) {
        return;
      }

      const messagesWithSenders: RecentMessage[] = messagesData.map((message) => ({
        id: message.id,
        thread_id: message.thread_id,
        content: message.content,
        created_at: message.created_at,
        sender_id: message.sender_id,
        sender: senderProfiles?.find((senderProfile) => senderProfile.id === message.sender_id),
      }));
      setMessages(messagesWithSenders);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      if (requestVersion === requestVersionRef.current) {
        setMessages([]);
        setSchedule(null);
        setOtherParent(null);
      }
    } finally {
      if (requestVersion === requestVersionRef.current) {
        setLoading(false);
      }
    }
  }, [activeFamilyId, activeProfileId, user]);

  useEffect(() => {
    void fetchDashboardData();
  }, [fetchDashboardData]);

  // Check if today is an exchange day based on schedule pattern
  const isExchangeDay = () => {
    if (!schedule) return false;
    const today = new Date();
    const startDate = parseISO(schedule.start_date);
    const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Simple exchange detection based on pattern
    switch (schedule.pattern) {
      case "weekly":
        return daysSinceStart % 7 === 0;
      case "biweekly":
        return daysSinceStart % 14 === 0;
      case "2-2-3":
        return [0, 2, 4].includes(daysSinceStart % 7);
      case "3-4-4-3":
        return [0, 3].includes(daysSinceStart % 7);
      case "5-2":
        return daysSinceStart % 7 === 0 || daysSinceStart % 7 === 5;
      default:
        return daysSinceStart % 7 === 0;
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
    return "";
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

  const canAccessRoute = useCallback(
    (pathname: string) =>
      canAccessProtectedRoute(pathname, {
        activeFamilyId,
        isThirdParty,
      }),
    [activeFamilyId, isThirdParty],
  );

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  const quickLinks = [
    {
      label: "Messages",
      description: messages.length > 0 ? "See the latest thread activity" : "Start a clean written record",
      href: "/dashboard/messages",
      icon: MessageSquare,
    },
    {
      label: "Calls",
      description: "Review call history and return family calls",
      href: "/dashboard/calls",
      icon: Phone,
    },
    {
      label: "Calendar",
      description: schedule ? "Review the current schedule" : "Set up parenting time",
      href: "/dashboard/calendar",
      icon: Calendar,
    },
    {
      label: "Children",
      description: children.length > 0 ? "Open profiles and health info" : "Add your child details",
      href: "/dashboard/children",
      icon: Users,
    },
    {
      label: "Expenses",
      description: "Track reimbursements and shared costs",
      href: "/dashboard/expenses",
      icon: DollarSign,
    },
  ].filter((link) => canAccessRoute(link.href));

  const canAccessChildrenRoute = canAccessRoute("/dashboard/children");
  const canAccessSettingsRoute = canAccessRoute("/dashboard/settings");

  const heroTitle = getFirstName() ? `${getGreeting()}, ${getFirstName()}` : "Your co-parenting dashboard";
  const heroEyebrow = otherParent ? "Family connected" : "Finish setup";
  const heroDescription = otherParent
    ? "Check the plan, review recent communication, and jump into the next task without digging through the full app."
    : "You have the workspace ready. Add another parent or guardian, set the schedule, and keep the important records in one place.";
  const statusCards = [
    {
      label: "Children",
      value: children.length.toString(),
      detail: children.length > 0 ? "profiles ready" : "add your first child",
      icon: Users,
      accentClass: "from-primary/20 via-primary/10 to-transparent",
      iconClass: "bg-primary/15 text-primary ring-1 ring-primary/20",
      valueClass: children.length > 0 ? "text-white" : "text-slate-300",
    },
    {
      label: isExchangeDay() ? "Today" : "Schedule",
      value: schedule ? (isExchangeDay() ? "Exchange day" : "Active") : "Not set",
      detail: schedule ? "calendar is available" : "build your parenting plan",
      icon: Calendar,
      accentClass: "from-accent/20 via-accent/10 to-transparent",
      iconClass: "bg-accent/15 text-accent ring-1 ring-accent/20",
      valueClass: schedule ? "text-white" : "text-slate-300",
    },
    {
      label: "Journal",
      value: journalCount.toString(),
      detail: journalCount > 0 ? "entries this month" : "good place for exchange notes",
      icon: BookHeart,
      accentClass: "from-[#21B0FE]/20 via-[#21B0FE]/10 to-transparent",
      iconClass: "bg-[#21B0FE]/10 text-[#21B0FE] ring-1 ring-[#21B0FE]/20",
      valueClass: journalCount > 0 ? "text-white" : "text-slate-300",
    },
  ];

  return (
    <DashboardLayout>
      <div className="page-shell-app page-stack">
        {/* Subscription Status Banner */}
        <div className="surface-primary relative isolate overflow-hidden p-[1px]">
          <div className="absolute inset-y-0 left-8 w-28 rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute inset-y-0 right-10 w-28 rounded-full bg-accent/15 blur-3xl" />
          <div className="relative rounded-[28px] border border-white/5 bg-background/80 p-1 backdrop-blur-sm">
            <SubscriptionBanner />
          </div>
        </div>

        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="surface-hero p-5 sm:p-6"
        >
          <div className="absolute left-6 top-5 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-40 w-40 rounded-full bg-accent/15 blur-3xl" />
          <div className="relative flex flex-col gap-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill variant="dark">
                    {heroEyebrow}
                  </StatusPill>
                  <StatusPill variant="dark">
                    Family command center
                  </StatusPill>
                </div>
                <div className="space-y-3">
                  <h1 className="max-w-3xl text-3xl font-display font-bold tracking-tight text-white sm:text-4xl">
                    {heroTitle}
                  </h1>
                  <p className="max-w-2xl text-sm leading-6 text-slate-200/80 sm:text-base">
                    {heroDescription}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:w-[360px] xl:grid-cols-1">
                <div className="surface-hero-panel">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300/70">
                    Family connection
                  </p>
                  <p className="mt-3 text-lg font-semibold text-white">
                    {otherParent?.fullName || "Setup still needed"}
                  </p>
                  <p className="mt-1 text-sm text-slate-300/70">
                    {otherParent
                      ? "Shared records, schedule coordination, and communication are connected."
                      : canAccessSettingsRoute
                        ? "Invite the other parent or guardian to finish family setup."
                        : "A parent or guardian must complete family setup before shared actions open."}
                  </p>
                </div>

                <div className="surface-hero-panel bg-slate-950/35">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300/70">
                    Current focus
                  </p>
                  <p className="mt-3 text-lg font-semibold text-white">
                    {schedule ? "Plan and document" : "Finish core setup"}
                  </p>
                  <p className="mt-1 text-sm text-slate-300/70">
                    {schedule
                      ? "Review the schedule, keep communication clean, and record what matters without leaving the dashboard."
                      : "Build the calendar first so exchanges, messages, and records all stay aligned."}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {statusCards.map(({ accentClass, detail, icon: Icon, iconClass, label, value, valueClass }) => (
                <div
                  key={label}
                  className={cn(
                    "surface-hero-panel relative overflow-hidden",
                    "before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-white/10",
                  )}
                >
                  <div className={cn("absolute inset-x-0 top-0 h-28 bg-gradient-to-br opacity-80", accentClass)} />
                  <div className="relative flex items-start justify-between gap-3">
                    <div className="space-y-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300/70">
                        {label}
                      </p>
                      <p className={cn("text-2xl font-display font-semibold sm:text-[1.9rem]", valueClass)}>
                        {value}
                      </p>
                    </div>
                    <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl backdrop-blur-sm", iconClass)}>
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="relative mt-4 text-sm leading-6 text-slate-300/70">{detail}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {quickLinks.map(({ label, description, href, icon: Icon }) => (
                <Button
                  key={href}
                  variant="outline"
                  className={cn(
                    "group h-auto rounded-[26px] border border-white/10 bg-white/5 p-0 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-all duration-200 hover:-translate-y-1 hover:border-white/20 hover:bg-white/10 hover:shadow-[0_20px_35px_-24px_rgba(15,23,42,0.95)]",
                    (href === "/dashboard/messages" || href === "/dashboard/calls") && "border-primary/20 bg-primary/10",
                  )}
                  asChild
                >
                  <Link to={href} className="flex h-full items-center justify-between gap-4 px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/35 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-transform duration-200 group-hover:scale-[1.03]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-semibold text-white">{label}</p>
                        <p className="text-xs leading-5 text-slate-300/70">{description}</p>
                      </div>
                    </div>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200/70 transition-all duration-200 group-hover:translate-x-0.5 group-hover:border-white/20 group-hover:text-white">
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </Link>
                </Button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Today's Schedule Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="surface-primary overflow-hidden p-6"
        >
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-display font-semibold">Today's Parenting Time</h2>
              <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-[24px] border border-parent-a/40 bg-[linear-gradient(135deg,rgba(33,176,254,0.18),rgba(255,255,255,0.03))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <p className="mb-1 text-sm font-medium text-parent-a">
                {schedule ? "Status today" : "Your parenting time"}
              </p>
              <p className="text-2xl font-display font-bold text-parent-a">
                {schedule ? (isExchangeDay() ? "Exchange day" : "Schedule active") : "Set up your schedule"}
              </p>
              <p className="mt-2 text-sm leading-6 text-parent-a/80">
                {otherParent
                  ? `Other parent/guardian: ${otherParent.fullName || "Connected"}`
                  : "Add another parent or guardian to get started"}
              </p>
            </div>
            <div className="surface-secondary p-5">
              <p className="mb-1 text-sm font-medium text-muted-foreground">Next best move</p>
              <p className="text-sm leading-6 text-muted-foreground">
                {schedule
                  ? "Open the calendar for timing details or send a written update without leaving the dashboard."
                  : "Build the schedule first, then use messages and journal entries to document changes cleanly."}
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" size="sm" className="rounded-full border-border/70 bg-background/80" asChild>
                  <Link to="/dashboard/calendar">View Schedule</Link>
                </Button>
                <Button variant="outline" size="sm" className="rounded-full border-border/70 bg-background/80" asChild>
                  <Link to="/dashboard/messages">Send Message</Link>
                </Button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Exchange Check-in (only show if it's an exchange day and schedule exists) */}
        {schedule && isExchangeDay() && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <ExchangeCheckin 
              exchangeDate={new Date()} 
              scheduleId={schedule.id}
            />
          </motion.div>
        )}

        {/* Quick Stats Grid */}

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {/* Upcoming Exchanges */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="surface-standard p-5"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                  Planning
                </p>
                <h3 className="font-display font-semibold">Upcoming Exchanges</h3>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-background/70 text-muted-foreground">
                <Clock className="h-5 w-5" />
              </div>
            </div>
            <div className="space-y-3">
              {otherParent ? (
                <div className="rounded-2xl border border-dashed border-border/70 bg-background/40 p-4">
                  <p className="text-sm leading-6 text-muted-foreground">
                    Set up your custody schedule to see upcoming exchanges.
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/70 bg-background/40 px-4 py-5 text-center">
                  <p className="text-sm leading-6 text-muted-foreground">
                    {canAccessSettingsRoute
                      ? "Add another parent or guardian to manage exchanges"
                      : "A parent or guardian needs to finish family setup before exchanges can appear"}
                  </p>
                  {canAccessSettingsRoute && (
                    <Button variant="outline" size="sm" className="mt-4 rounded-full" asChild>
                      <Link to="/dashboard/settings">Set Up</Link>
                    </Button>
                  )}
                </div>
              )}
            </div>
          </motion.div>

          {/* Recent Messages */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="surface-standard p-5"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                  Communication
                </p>
                <h3 className="font-display font-semibold">Recent Messages</h3>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-background/70 text-primary">
                <MessageSquare className="h-5 w-5" />
              </div>
            </div>
            <div className="space-y-3">
              {messages.length > 0 ? (
                messages.map((msg) => (
                  <Link
                    key={msg.id}
                    to={`/dashboard/messages?thread=${msg.thread_id}`}
                    className="group block rounded-[22px] border border-border/70 bg-background/50 p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-background/80"
                  >
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-foreground">
                        {resolveSenderName(msg.sender?.full_name, msg.sender?.email)}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {formatMessageTime(msg.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{msg.content}</p>
                  </Link>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-border/70 bg-background/40 p-4 text-center">
                  <p className="text-sm font-medium text-foreground">Written record is quiet right now</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Start the next update from Messaging Hub to keep the family record clear.
                  </p>
                </div>
              )}
            </div>
            <Button variant="ghost" className="mt-4 w-full rounded-2xl border border-transparent bg-background/40 hover:bg-background/70" asChild>
              <Link to="/dashboard/messages">View All Messages</Link>
            </Button>
          </motion.div>

          {/* Children Quick Access */}
          {canAccessChildrenRoute && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="surface-standard p-5"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                    Family details
                  </p>
                  <h3 className="font-display font-semibold">Your Children</h3>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-background/70 text-primary">
                  <Users className="h-5 w-5" />
                </div>
              </div>
              <div className="space-y-3">
                {children.length > 0 ? (
                  children.map((child) => (
                    <Link
                      key={child.id}
                      to="/dashboard/children"
                      className="flex items-center gap-3 rounded-[22px] border border-border/70 bg-background/50 p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-background/80"
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 font-semibold text-primary">
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
                  <div className="rounded-2xl border border-dashed border-border/70 bg-background/40 px-4 py-5 text-center">
                    <p className="text-sm font-medium text-foreground">No child profiles added yet</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Add your children's information so schedules, health details, and records stay anchored.
                    </p>
                    <Button variant="outline" size="sm" className="mt-4 rounded-full" asChild>
                      <Link to="/dashboard/children">Add Child</Link>
                    </Button>
                  </div>
                )}
              </div>
              <Button variant="ghost" className="mt-4 w-full rounded-2xl border border-transparent bg-background/40 hover:bg-background/70" asChild>
                <Link to="/dashboard/children">Manage Child Info</Link>
              </Button>
            </motion.div>
          )}

          {/* Journal Quick Access */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="surface-standard p-5"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                  Private record
                </p>
                <h3 className="font-display font-semibold">Private Journal</h3>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#21B0FE]/20 bg-[#21B0FE]/10 text-[#21B0FE]">
                <BookHeart className="h-5 w-5" />
              </div>
            </div>
            <div className="rounded-[22px] border border-[#21B0FE]/15 bg-[#21B0FE]/[0.07] px-4 py-5 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#21B0FE]/80">This month</p>
              <p className="mt-3 text-3xl font-display font-bold text-[#21B0FE]">{journalCount}</p>
              <p className="text-sm text-muted-foreground">entries this month</p>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                {journalCount > 0
                  ? "Your private notes are ready when you need to review the month."
                  : "Use the journal after exchanges or difficult conversations to keep a private record."}
              </p>
            </div>
            <Button variant="ghost" className="mt-4 w-full rounded-2xl border border-transparent bg-background/40 hover:bg-background/70" asChild>
              <Link to="/dashboard/journal">Open Journal</Link>
            </Button>
          </motion.div>

          {/* Blog Card */}
          <BlogDashboardCard />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
