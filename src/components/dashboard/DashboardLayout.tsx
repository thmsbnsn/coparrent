import { Suspense, lazy, useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Baby,
  BookHeart,
  BookOpen,
  Calendar,
  ChevronLeft,
  DollarSign,
  FileText,
  Gamepad2,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Phone,
  Scale,
  Settings,
  Trophy,
  Users,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/StatusPill";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyRole } from "@/hooks/useFamilyRole";
import { useChildAccount } from "@/hooks/useChildAccount";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { NotificationDropdown } from "@/components/notifications/NotificationDropdown";
import { TrialBadge } from "@/components/dashboard/TrialBadge";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { OnboardingOverlay } from "@/components/onboarding/OnboardingOverlay";
import { FamilySwitcher } from "@/components/family/FamilySwitcher";
import { FamilyPresenceToggle } from "@/components/family/FamilyPresenceToggle";
import { usePresenceHeartbeat } from "@/hooks/usePresenceHeartbeat";
import { canAccessProtectedRoute, matchesRoutePrefix } from "@/lib/routeAccess";

const GlobalCallManager = lazy(() =>
  import("@/components/calls/GlobalCallManager").then((module) => ({ default: module.GlobalCallManager })),
);

interface DashboardLayoutProps {
  children: ReactNode;
  headerActions?: ReactNode;
  mobileHeader?: {
    hideDefaultTrailing?: boolean;
    leading?: ReactNode;
    title?: ReactNode;
    trailing?: ReactNode;
  };
  showFamilyPresenceToggle?: boolean;
  userRole?: "parent" | "lawoffice";
}

const parentNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard", id: "nav-dashboard" },
  { icon: MessageSquare, label: "Messages", href: "/dashboard/messages", id: "nav-messages" },
  { icon: Calendar, label: "Parenting Calendar", href: "/dashboard/calendar", id: "nav-calendar" },
  { icon: Phone, label: "Calls", href: "/dashboard/calls", id: "nav-calls" },
  { icon: Users, label: "Child Info", href: "/dashboard/children", id: "nav-children" },
  { icon: Trophy, label: "Sports Hub", href: "/dashboard/sports", id: "nav-sports" },
  { icon: Gamepad2, label: "Games", href: "/dashboard/games", id: "nav-games" },
  { icon: Baby, label: "Kids Hub", href: "/dashboard/kids-hub", id: "nav-kids-hub" },
  { icon: FileText, label: "Documents", href: "/dashboard/documents", id: "nav-documents" },
  { icon: DollarSign, label: "Expenses", href: "/dashboard/expenses", id: "nav-expenses" },
  { icon: BookHeart, label: "Journal", href: "/dashboard/journal", id: "nav-journal" },
  { icon: Scale, label: "Law Library", href: "/dashboard/law-library", id: "nav-law-library" },
  { icon: BookOpen, label: "Blog", href: "/dashboard/blog", id: "nav-blog" },
] as const;

const lawOfficeNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/law-office/dashboard", id: "nav-law-office-dashboard" },
] as const;

const MOBILE_HEADER_ROUTES = [
  { path: "/dashboard/messages", title: "Messages" },
  { path: "/dashboard/calls", title: "Call History" },
  { path: "/dashboard/calendar", title: "Parenting Calendar" },
  { path: "/dashboard/children", title: "Child Info" },
  { path: "/dashboard/sports", title: "Sports Hub" },
  { path: "/dashboard/games", title: "Games" },
  { path: "/dashboard/kids-hub", title: "Kids Hub" },
  { path: "/dashboard/documents", title: "Documents" },
  { path: "/dashboard/expenses", title: "Expenses" },
  { path: "/dashboard/journal", title: "Journal" },
  { path: "/dashboard/law-library", title: "Law Library" },
  { path: "/dashboard/blog", title: "Blog" },
  { path: "/dashboard/settings", title: "Settings" },
  { path: "/dashboard/notifications", title: "Notifications" },
  { path: "/dashboard/families/new", title: "Add Family" },
  { path: "/dashboard/kid-center", title: "Kid Center" },
  { path: "/dashboard/gifts", title: "Gifts" },
  { path: "/dashboard/audit", title: "Audit Log" },
  { path: "/dashboard", title: "Dashboard" },
  { path: "/law-office/dashboard", title: "Law Office Dashboard" },
] as const;

const resolveMobileHeaderTitle = (pathname: string) =>
  MOBILE_HEADER_ROUTES.find((route) => matchesRoutePrefix(pathname, route.path))?.title ?? "CoParrent";

export const DashboardLayout = ({
  children,
  headerActions,
  mobileHeader,
  showFamilyPresenceToggle = false,
  userRole = "parent",
}: DashboardLayoutProps) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [userInitials, setUserInitials] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { activeFamilyId, isChild, isLawOffice, isThirdParty, loading: roleLoading } = useFamilyRole();
  const { isChildAccount, loading: childLoading } = useChildAccount();
  const { toast } = useToast();
  const isLawOfficeLayout = userRole === "lawoffice";
  const hasFamilyPresenceScope = !isLawOfficeLayout && Boolean(activeFamilyId);
  const shouldShowFamilyPresence = hasFamilyPresenceScope && showFamilyPresenceToggle;
  const isDashboardGameRoute = location.pathname.startsWith("/dashboard/games/");
  const mobileInlinePadding = "max(1rem, env(safe-area-inset-left, 0px), env(safe-area-inset-right, 0px))";
  const canOpenSettings = !isLawOfficeLayout && canAccessProtectedRoute("/dashboard/settings", {
    activeFamilyId,
    isChild,
    isChildAccount,
    isLawOffice,
    isThirdParty,
  });
  const mobileHeaderTitle = mobileHeader?.title ?? resolveMobileHeaderTitle(location.pathname);
  const utilityButtonClassName =
    "h-10 w-10 rounded-xl border border-white/10 bg-white/[0.06] text-sidebar-foreground/78 hover:bg-white/[0.12] hover:text-sidebar-foreground";

  usePresenceHeartbeat({
    enabled: hasFamilyPresenceScope && !isDashboardGameRoute,
    locationType: "dashboard",
  });

  const allNavItems = userRole === "lawoffice" ? lawOfficeNavItems : parentNavItems;
  const navItems = roleLoading || childLoading
    ? []
    : allNavItems.filter((item) =>
        canAccessProtectedRoute(item.href, {
          activeFamilyId,
          isChild,
          isChildAccount,
          isLawOffice,
          isThirdParty,
        }),
      );

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile?.full_name) {
        const names = profile.full_name.split(" ");
        const initials =
          names.length >= 2
            ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
            : profile.full_name.substring(0, 2).toUpperCase();
        setUserInitials(initials);
      } else if (profile?.email) {
        setUserInitials(profile.email.substring(0, 2).toUpperCase());
      } else if (user.email) {
        setUserInitials(user.email.substring(0, 2).toUpperCase());
      }
    };

    void fetchUserProfile();
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Signed out",
      description: "You've been successfully signed out.",
    });
    navigate(isLawOfficeLayout ? "/law-office/login" : "/login");
  };

  const renderSidebarContent = () => (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-sidebar-border/90 p-4">
        <div className="flex items-center justify-between gap-2">
          <Link to={isLawOfficeLayout ? "/law-office/dashboard" : "/dashboard"}>
            <Logo size="md" showText={!sidebarCollapsed} className="[&_span]:text-sidebar-foreground" />
          </Link>
          {!isLawOfficeLayout && <TrialBadge collapsed={sidebarCollapsed} />}
        </div>
      </div>

      <div className="shrink-0 border-b border-sidebar-border/90 px-3 py-3">
        <FamilySwitcher collapsed={sidebarCollapsed} />
      </div>

      <nav className="sidebar-scroll flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              id={item.id}
              to={item.href}
              className={cn(
                "flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition-all duration-200",
                isActive
                  ? "border-sidebar-primary/20 bg-[linear-gradient(135deg,rgba(18,84,214,0.42),rgba(17,127,191,0.2))] text-sidebar-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_30px_-24px_rgba(13,148,136,0.6)]"
                  : "border-transparent text-sidebar-foreground/72 hover:border-white/10 hover:bg-white/[0.06] hover:text-sidebar-foreground",
              )}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!sidebarCollapsed ? <span className="text-sm font-medium">{item.label}</span> : null}
            </Link>
          );
        })}
      </nav>

      {!isLawOfficeLayout ? (
        <div className="shrink-0 border-t border-sidebar-border/90 px-3 pb-1 pt-3 lg:hidden">
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-2">
            <ThemeToggle
              buttonClassName={utilityButtonClassName}
              cycleMode="light-dark"
              showTooltip={false}
            />
            <NotificationDropdown buttonClassName={utilityButtonClassName} />
            {canOpenSettings ? (
              <Button
                asChild
                variant="ghost"
                size="icon"
                className={utilityButtonClassName}
              >
                <Link to="/dashboard/settings" aria-label="Open settings from sidebar">
                  <Settings className="h-5 w-5" />
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        className="shrink-0 space-y-1 border-t border-sidebar-border/90 p-3"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0.75rem))" }}
      >
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 text-sidebar-foreground/72 transition-all duration-200 hover:border-white/10 hover:bg-white/[0.05] hover:text-sidebar-foreground"
        >
          <LogOut className="h-5 w-5" />
          {!sidebarCollapsed ? <span className="text-sm font-medium">Sign Out</span> : null}
        </button>
      </div>
    </div>
  );

  const defaultMobileTrailing = (
    <div className="flex min-w-[2.75rem] items-center justify-end gap-2">
      {headerActions}
      {canOpenSettings ? (
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full border border-primary/15 bg-gradient-accent p-0 text-primary-foreground shadow-[0_14px_28px_-22px_hsl(var(--primary)/0.7)] hover:opacity-95"
        >
          <Link to="/dashboard/settings" aria-label="Open settings">
            <span className="text-sm font-semibold">{userInitials || "U"}</span>
          </Link>
        </Button>
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/15 bg-gradient-accent text-primary-foreground shadow-[0_14px_28px_-22px_hsl(var(--primary)/0.7)]">
          <span className="text-sm font-semibold">{userInitials || "U"}</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="page-background-app flex min-h-screen overflow-x-clip bg-background">
      <motion.aside
        initial={false}
        animate={{ width: sidebarCollapsed ? 72 : 256 }}
        className="fixed bottom-0 left-0 top-0 z-40 hidden flex-col border-r border-sidebar-border/80 bg-[linear-gradient(180deg,hsl(var(--sidebar-background))_0%,hsl(221_66%_10%)_52%,hsl(219_66%_8%)_100%)] shadow-[18px_0_40px_-28px_rgba(8,21,47,0.85)] lg:flex"
      >
        {renderSidebarContent()}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-sidebar-border bg-[linear-gradient(180deg,hsl(var(--sidebar-background)),hsl(var(--sidebar-accent)))] text-sidebar-foreground shadow-lg transition-colors hover:bg-sidebar-accent"
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform", sidebarCollapsed && "rotate-180")} />
        </button>
      </motion.aside>

      <AnimatePresence>
        {mobileSidebarOpen ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              className="fixed bottom-0 left-0 top-0 z-50 flex w-[280px] flex-col border-r border-sidebar-border/80 bg-[linear-gradient(180deg,hsl(var(--sidebar-background))_0%,hsl(221_66%_10%)_52%,hsl(219_66%_8%)_100%)] shadow-[18px_0_40px_-28px_rgba(8,21,47,0.85)] lg:hidden"
            >
              {renderSidebarContent()}
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <div className={cn("flex min-h-screen min-w-0 flex-1 flex-col", sidebarCollapsed ? "lg:ml-[72px]" : "lg:ml-[256px]")}>
        <header
          className="sticky top-0 z-30 overflow-x-clip border-b border-border/70 bg-background/74 shadow-[0_16px_34px_-30px_rgba(8,21,47,0.5)] backdrop-blur-xl"
          style={{
            paddingTop: "env(safe-area-inset-top, 0)",
          }}
        >
          <div
            className="flex min-w-0 items-center justify-between gap-2 px-4 py-2 lg:hidden"
            style={{
              minHeight: "4rem",
              paddingLeft: mobileInlinePadding,
              paddingRight: mobileInlinePadding,
            }}
          >
            <div className="flex min-w-[2.75rem] items-center justify-start">
              {mobileHeader?.leading ?? (
                <button
                  aria-label="Open navigation menu"
                  className="rounded-xl border border-transparent p-2 transition-colors hover:border-border/70 hover:bg-muted/70"
                  onClick={() => setMobileSidebarOpen(true)}
                >
                  <Menu className="h-5 w-5" />
                </button>
              )}
            </div>

            <div className="min-w-0 flex-1 px-2 text-center">
              <p className="truncate text-sm font-semibold tracking-tight text-foreground" data-mobile-header-title="">
                {mobileHeaderTitle}
              </p>
            </div>

            {mobileHeader?.hideDefaultTrailing ? (
              <div className="flex min-w-[2.75rem] items-center justify-end gap-2">
                {mobileHeader.trailing}
              </div>
            ) : (
              <div className="flex min-w-[2.75rem] items-center justify-end gap-2">
                {mobileHeader?.trailing}
                {defaultMobileTrailing}
              </div>
            )}
          </div>

          <div
            className="hidden min-w-0 items-center justify-between gap-3 px-6 py-2 lg:flex"
            style={{
              minHeight: "4rem",
              paddingLeft: mobileInlinePadding,
              paddingRight: mobileInlinePadding,
            }}
          >
            <div className="flex-1" />

            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              {!isLawOfficeLayout && !roleLoading ? (
                <div className="hidden xl:block">
                  {activeFamilyId ? (
                    <StatusPill variant="scope" icon={<Users className="h-3.5 w-3.5" />}>
                      Active family scope
                    </StatusPill>
                  ) : (
                    <StatusPill variant="warning">Family selection required</StatusPill>
                  )}
                </div>
              ) : null}
              {headerActions}
              {shouldShowFamilyPresence ? <FamilyPresenceToggle /> : null}
              <ThemeToggle />
              <NotificationDropdown />
              {canOpenSettings ? (
                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full border border-primary/15 bg-gradient-accent p-0 text-primary-foreground shadow-[0_14px_28px_-22px_hsl(var(--primary)/0.7)] hover:opacity-95"
                >
                  <Link to="/dashboard/settings" aria-label="Open settings">
                    <span className="text-sm font-semibold">{userInitials || "U"}</span>
                  </Link>
                </Button>
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/15 bg-gradient-accent text-primary-foreground shadow-[0_14px_28px_-22px_hsl(var(--primary)/0.7)]">
                  {userInitials || "U"}
                </div>
              )}
            </div>
          </div>
        </header>

        <main
          className="min-w-0 flex-1 overflow-x-clip p-4 lg:p-6"
          style={{
            paddingLeft: mobileInlinePadding,
            paddingRight: mobileInlinePadding,
          }}
        >
          {children}
        </main>
      </div>

      {!isLawOfficeLayout ? <OnboardingOverlay /> : null}
      {!isLawOfficeLayout ? (
        <Suspense fallback={null}>
          <GlobalCallManager />
        </Suspense>
      ) : null}
    </div>
  );
};
