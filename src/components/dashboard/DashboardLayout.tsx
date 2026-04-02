import { Suspense, lazy, useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Gamepad2,
  MessageSquare,
  FileText,
  Settings,
  LogOut,
  ChevronLeft,
  BookHeart,
  Menu,
  BookOpen,
  DollarSign,
  Scale,
  Trophy,
  Baby,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";
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
import { canAccessProtectedRoute } from "@/lib/routeAccess";

const GlobalCallManager = lazy(() =>
  import("@/components/calls/GlobalCallManager").then((module) => ({ default: module.GlobalCallManager })),
);

interface DashboardLayoutProps {
  children: React.ReactNode;
  headerActions?: React.ReactNode;
  showFamilyPresenceToggle?: boolean;
  userRole?: "parent" | "lawoffice";
}

// Full navigation for parents/guardians
const parentNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard", id: "nav-dashboard" },
  { icon: Calendar, label: "Parenting Calendar", href: "/dashboard/calendar", id: "nav-calendar" },
  { icon: Users, label: "Child Info", href: "/dashboard/children", id: "nav-children" },
  { icon: Trophy, label: "Sports Hub", href: "/dashboard/sports", id: "nav-sports" },
  { icon: Gamepad2, label: "Games", href: "/dashboard/games", id: "nav-games" },
  { icon: Baby, label: "Kids Hub", href: "/dashboard/kids-hub", id: "nav-kids-hub" },
  { icon: MessageSquare, label: "Messaging Hub", href: "/dashboard/messages", id: "nav-messages" },
  { icon: FileText, label: "Documents", href: "/dashboard/documents", id: "nav-documents" },
  { icon: DollarSign, label: "Expenses", href: "/dashboard/expenses", id: "nav-expenses" },
  { icon: BookHeart, label: "Journal", href: "/dashboard/journal", id: "nav-journal" },
  { icon: Scale, label: "Law Library", href: "/dashboard/law-library", id: "nav-law-library" },
  { icon: BookOpen, label: "Blog", href: "/dashboard/blog", id: "nav-blog" },
  { icon: Settings, label: "Settings", href: "/dashboard/settings", id: "nav-settings" },
];

/**
 * Law office navigation - routes must exist
 * 
 * REGRESSION PREVENTION:
 * - /dashboard/cases was removed as it doesn't exist
 * - Law offices use the same document management as parents
 * 
 * @see src/lib/routes.ts for route registry
 */
const lawOfficeNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/law-office/dashboard", id: "nav-law-office-dashboard" },
];

export const DashboardLayout = ({
  children,
  headerActions,
  showFamilyPresenceToggle = true,
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

  usePresenceHeartbeat({
    enabled: hasFamilyPresenceScope && !isDashboardGameRoute,
    locationType: "dashboard",
  });

  // Filter nav items based on user role
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
        const initials = names.length >= 2 
          ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
          : profile.full_name.substring(0, 2).toUpperCase();
        setUserInitials(initials);
      } else if (profile?.email) {
        setUserInitials(profile.email.substring(0, 2).toUpperCase());
      } else if (user.email) {
        setUserInitials(user.email.substring(0, 2).toUpperCase());
      }
    };

    fetchUserProfile();
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Signed out",
      description: "You've been successfully signed out.",
    });
    navigate(isLawOfficeLayout ? "/law-office/login" : "/login");
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo - Fixed at top, no safe area here (handled by container) */}
      <div className="p-4 border-b border-sidebar-border shrink-0">
        <div className="flex items-center justify-between gap-2">
          <Link to={isLawOfficeLayout ? "/law-office/dashboard" : "/dashboard"}>
            <Logo size="md" showText={!sidebarCollapsed} className="[&_span]:text-sidebar-foreground" />
          </Link>
          {!isLawOfficeLayout && <TrialBadge collapsed={sidebarCollapsed} />}
        </div>
      </div>

      {/* Family Switcher */}
      <div className="px-3 py-2 border-b border-sidebar-border shrink-0">
        <FamilySwitcher collapsed={sidebarCollapsed} />
      </div>

      {/* Navigation - Scrollable with custom scrollbar */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto sidebar-scroll">
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
                  : "border-transparent text-sidebar-foreground/72 hover:border-white/10 hover:bg-white/[0.05] hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!sidebarCollapsed && (
                <span className="text-sm font-medium">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Section - Fixed at bottom with safe area padding */}
      <div className="p-3 border-t border-sidebar-border space-y-1 shrink-0" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0.75rem))' }}>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 text-sidebar-foreground/72 transition-all duration-200 hover:border-white/10 hover:bg-white/[0.05] hover:text-sidebar-foreground"
        >
          <LogOut className="w-5 h-5" />
          {!sidebarCollapsed && <span className="text-sm font-medium">Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen overflow-x-clip bg-[linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--background))_70%,hsl(var(--muted)/0.28)_100%)]">
      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarCollapsed ? 72 : 256 }}
        className="hidden fixed left-0 top-0 bottom-0 z-40 flex-col border-r border-sidebar-border/80 bg-[linear-gradient(180deg,hsl(var(--sidebar-background))_0%,hsl(221_62%_8%)_100%)] shadow-[18px_0_40px_-28px_rgba(8,21,47,0.85)] lg:flex"
      >
        <SidebarContent />
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-sidebar-border bg-[linear-gradient(180deg,hsl(var(--sidebar-background)),hsl(var(--sidebar-accent)))] text-sidebar-foreground shadow-lg transition-colors hover:bg-sidebar-accent"
        >
          <ChevronLeft className={cn("w-4 h-4 transition-transform", sidebarCollapsed && "rotate-180")} />
        </button>
      </motion.aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              className="fixed left-0 top-0 bottom-0 z-50 flex w-[280px] flex-col border-r border-sidebar-border/80 bg-[linear-gradient(180deg,hsl(var(--sidebar-background))_0%,hsl(221_62%_8%)_100%)] shadow-[18px_0_40px_-28px_rgba(8,21,47,0.85)] lg:hidden"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className={cn("flex min-w-0 flex-1 flex-col min-h-screen", sidebarCollapsed ? "lg:ml-[72px]" : "lg:ml-[256px]")}>
        {/* Top Bar with safe area support - consistent across all pages */}
        <header 
          className="sticky top-0 z-30 flex min-w-0 items-center justify-between overflow-x-clip border-b border-border/70 bg-background/78 px-4 shadow-[0_16px_34px_-30px_rgba(8,21,47,0.5)] backdrop-blur-xl lg:px-6"
          style={{ 
            paddingTop: 'env(safe-area-inset-top, 0)', 
            minHeight: '4rem',
            paddingBottom: '0.5rem',
            paddingLeft: mobileInlinePadding,
            paddingRight: mobileInlinePadding,
          }}
        >
          <button
            className="lg:hidden mt-auto mb-auto rounded-xl border border-transparent p-2 transition-colors hover:border-border/70 hover:bg-muted/70"
            onClick={() => setMobileSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex-1" />

          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {headerActions}
            {shouldShowFamilyPresence && <FamilyPresenceToggle />}
            <ThemeToggle />
            <NotificationDropdown />
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/15 bg-gradient-accent text-primary-foreground shadow-[0_14px_28px_-22px_hsl(var(--primary)/0.7)]">
              {userInitials || "U"}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main
          className="flex-1 min-w-0 overflow-x-clip p-4 lg:p-6"
          style={{
            paddingLeft: mobileInlinePadding,
            paddingRight: mobileInlinePadding,
          }}
        >
          {children}
        </main>
      </div>

      {/* Onboarding Tooltips */}
      {!isLawOfficeLayout && <OnboardingOverlay />}
      {!isLawOfficeLayout && (
        <Suspense fallback={null}>
          <GlobalCallManager />
        </Suspense>
      )}
    </div>
  );
};
