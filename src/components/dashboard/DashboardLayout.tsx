import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Calendar,
  Users,
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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { NotificationDropdown } from "@/components/notifications/NotificationDropdown";
import { TrialBadge } from "@/components/dashboard/TrialBadge";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { OnboardingOverlay } from "@/components/onboarding/OnboardingOverlay";
import { FamilySwitcher } from "@/components/family/FamilySwitcher";

interface DashboardLayoutProps {
  children: React.ReactNode;
  userRole?: "parent" | "lawoffice";
}

// Full navigation for parents/guardians
const parentNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard", thirdPartyAllowed: true, id: "nav-dashboard" },
  { icon: Calendar, label: "Parenting Calendar", href: "/dashboard/calendar", thirdPartyAllowed: false, id: "nav-calendar" },
  { icon: Users, label: "Child Info", href: "/dashboard/children", thirdPartyAllowed: false, id: "nav-children" },
  { icon: Trophy, label: "Sports Hub", href: "/dashboard/sports", thirdPartyAllowed: false, id: "nav-sports" },
  { icon: Baby, label: "Kids Hub", href: "/dashboard/kids-hub", thirdPartyAllowed: false, id: "nav-kids-hub" },
  { icon: MessageSquare, label: "Messaging Hub", href: "/dashboard/messages", thirdPartyAllowed: true, id: "nav-messages" },
  { icon: FileText, label: "Documents", href: "/dashboard/documents", thirdPartyAllowed: false, id: "nav-documents" },
  { icon: DollarSign, label: "Expenses", href: "/dashboard/expenses", thirdPartyAllowed: false, id: "nav-expenses" },
  { icon: BookHeart, label: "Journal", href: "/dashboard/journal", thirdPartyAllowed: true, id: "nav-journal" },
  { icon: Scale, label: "Law Library", href: "/dashboard/law-library", thirdPartyAllowed: true, id: "nav-law-library" },
  { icon: BookOpen, label: "Blog", href: "/dashboard/blog", thirdPartyAllowed: true, id: "nav-blog" },
  { icon: Settings, label: "Settings", href: "/dashboard/settings", thirdPartyAllowed: false, id: "nav-settings" },
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
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard", thirdPartyAllowed: true, id: "nav-dashboard" },
  { icon: FileText, label: "Documents", href: "/dashboard/documents", thirdPartyAllowed: false, id: "nav-documents" },
  { icon: Settings, label: "Settings", href: "/dashboard/settings", thirdPartyAllowed: false, id: "nav-settings" },
];

export const DashboardLayout = ({ children, userRole = "parent" }: DashboardLayoutProps) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [userInitials, setUserInitials] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { isThirdParty } = useFamilyRole();
  const { toast } = useToast();

  // Filter nav items based on user role
  const allNavItems = userRole === "lawoffice" ? lawOfficeNavItems : parentNavItems;
  const navItems = isThirdParty 
    ? allNavItems.filter(item => item.thirdPartyAllowed) 
    : allNavItems;

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
    navigate("/login");
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo - Fixed at top, no safe area here (handled by container) */}
      <div className="p-4 border-b border-sidebar-border shrink-0">
        <div className="flex items-center justify-between gap-2">
          <Link to="/dashboard">
            <Logo size="md" showText={!sidebarCollapsed} className="[&_span]:text-sidebar-foreground" />
          </Link>
          <TrialBadge collapsed={sidebarCollapsed} />
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
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
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
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
        >
          <LogOut className="w-5 h-5" />
          {!sidebarCollapsed && <span className="text-sm font-medium">Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarCollapsed ? 72 : 256 }}
        className="hidden lg:flex flex-col bg-sidebar border-r border-sidebar-border fixed left-0 top-0 bottom-0 z-40"
      >
        <SidebarContent />
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-sidebar border border-sidebar-border flex items-center justify-center text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
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
              className="fixed left-0 top-0 bottom-0 w-[280px] bg-sidebar z-50 flex flex-col lg:hidden"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className={cn("flex-1 flex flex-col min-h-screen", sidebarCollapsed ? "lg:ml-[72px]" : "lg:ml-[256px]")}>
        {/* Top Bar with safe area support - consistent across all pages */}
        <header 
          className="bg-card border-b border-border flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30"
          style={{ 
            paddingTop: 'env(safe-area-inset-top, 0)', 
            minHeight: '4rem',
            paddingBottom: '0.5rem'
          }}
        >
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-muted mt-auto mb-auto"
            onClick={() => setMobileSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <NotificationDropdown />
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
              {userInitials || "U"}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>

      {/* Onboarding Tooltips */}
      <OnboardingOverlay />
    </div>
  );
};
