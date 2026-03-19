import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

/**
 * Navbar - Professional, Minimal
 * 
 * Design Intent:
 * - Clean, authoritative navigation
 * - Clear hierarchy of actions
 * - Consistent across all public pages
 */

const navLinks = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
  { href: "/help", label: "Help" },
];

export const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();
  
  // Determine if we're on a dark hero page (landing page only)
  const isLandingPage = location.pathname === "/";

  return (
    <header className={cn(
      "fixed top-0 left-0 right-0 z-50 pt-[env(safe-area-inset-top,0px)]",
      isLandingPage 
        ? "bg-transparent" 
        : "bg-background/80 backdrop-blur-md border-b border-border/50"
    )}>
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-18">
          {/* Logo */}
          <Link to="/" className="flex-shrink-0">
            <Logo size="md" className={isLandingPage ? "text-white" : ""} />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                  isLandingPage 
                    ? "text-white/70 hover:text-white hover:bg-white/10" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle />
            {!loading && user ? (
              <Button 
                onClick={() => navigate("/dashboard")}
                variant={isLandingPage ? "secondary" : "default"}
              >
                <LayoutDashboard className="w-4 h-4 mr-2" />
                Dashboard
              </Button>
            ) : (
              <>
                <Button 
                  variant="ghost" 
                  onClick={() => navigate("/login")}
                  className={isLandingPage ? "text-white/80 hover:text-white hover:bg-white/10" : ""}
                >
                  Sign In
                </Button>
                <Button 
                  onClick={() => navigate("/signup")}
                  variant={isLandingPage ? "secondary" : "default"}
                >
                  Get Started
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className={cn(
              "md:hidden p-2 rounded-lg transition-colors",
              isLandingPage 
                ? "text-white hover:bg-white/10" 
                : "hover:bg-muted"
            )}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden overflow-hidden"
            >
              <div className={cn(
                "py-4 space-y-1 border-t",
                isLandingPage ? "border-white/10" : "border-border"
              )}>
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    className={cn(
                      "block px-3 py-3 text-base font-medium rounded-lg transition-colors",
                      isLandingPage 
                        ? "text-white/80 hover:text-white hover:bg-white/10" 
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
                <div className={cn(
                  "pt-4 mt-4 space-y-3 border-t",
                  isLandingPage ? "border-white/10" : "border-border"
                )}>
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className={cn(
                      "text-sm font-medium",
                      isLandingPage ? "text-white/60" : "text-muted-foreground"
                    )}>
                      Theme
                    </span>
                    <ThemeToggle />
                  </div>
                  {!loading && user ? (
                    <Button 
                      className="w-full" 
                      onClick={() => { navigate("/dashboard"); setMobileMenuOpen(false); }}
                    >
                      <LayoutDashboard className="w-4 h-4 mr-2" />
                      Dashboard
                    </Button>
                  ) : (
                    <>
                      <Button 
                        variant="outline" 
                        className="w-full" 
                        onClick={() => { navigate("/login"); setMobileMenuOpen(false); }}
                      >
                        Sign In
                      </Button>
                      <Button 
                        className="w-full" 
                        onClick={() => { navigate("/signup"); setMobileMenuOpen(false); }}
                      >
                        Get Started
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </header>
  );
};
