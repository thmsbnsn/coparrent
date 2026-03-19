import { useLocation, Link, useNavigate } from "react-router-dom";
import { useEffect, useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { Home, ArrowLeft, Search, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PublicLayout } from "@/components/landing/PublicLayout";

const searchablePages = [
  { path: "/", label: "Home", keywords: ["home", "landing", "start", "main"] },
  { path: "/dashboard", label: "Dashboard", keywords: ["dashboard", "overview", "main", "home"] },
  { path: "/calendar", label: "Calendar", keywords: ["calendar", "schedule", "dates", "custody", "visitation"] },
  { path: "/messages", label: "Messages", keywords: ["messages", "chat", "communication", "inbox"] },
  { path: "/children", label: "Children", keywords: ["children", "kids", "child", "profiles"] },
  { path: "/documents", label: "Documents", keywords: ["documents", "files", "upload", "papers"] },
  { path: "/expenses", label: "Expenses", keywords: ["expenses", "money", "costs", "payments", "budget"] },
  { path: "/journal", label: "Journal", keywords: ["journal", "notes", "diary", "log"] },
  { path: "/court-records", label: "Court Records", keywords: ["court", "records", "legal", "case"] },
  { path: "/law-library", label: "Law Library", keywords: ["law", "library", "legal", "resources", "information"] },
  { path: "/settings", label: "Settings", keywords: ["settings", "account", "profile", "preferences"] },
  { path: "/help", label: "Help Center", keywords: ["help", "support", "faq", "questions"] },
  { path: "/features", label: "Features", keywords: ["features", "capabilities", "what", "about"] },
  { path: "/pricing", label: "Pricing", keywords: ["pricing", "plans", "subscription", "cost"] },
  { path: "/blog", label: "Blog", keywords: ["blog", "articles", "news", "posts"] },
  { path: "/about", label: "About", keywords: ["about", "company", "team", "who"] },
];

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(-1);

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return searchablePages.filter(
      (page) =>
        page.label.toLowerCase().includes(query) ||
        page.keywords.some((keyword) => keyword.includes(query))
    );
  }, [searchQuery]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(searchResults.length > 0 ? 0 : -1);
  }, [searchResults]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (searchResults.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < searchResults.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : searchResults.length - 1
          );
          break;
        case "Enter":
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
            navigate(searchResults[selectedIndex].path);
          }
          break;
        case "Escape":
          setSearchQuery("");
          setSelectedIndex(-1);
          break;
      }
    },
    [searchResults, selectedIndex, navigate]
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIndex >= 0 && searchResults[selectedIndex]) {
      navigate(searchResults[selectedIndex].path);
    } else if (searchResults.length === 1) {
      navigate(searchResults[0].path);
    }
  };

  return (
    <PublicLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        {/* Animated 404 Number */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative mb-8"
        >
          <span className="text-[10rem] sm:text-[14rem] font-bold leading-none bg-gradient-to-br from-primary via-primary/70 to-primary/40 bg-clip-text text-transparent select-none">
            404
          </span>
          <motion.div
            className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent blur-3xl -z-10"
            animate={{
              opacity: [0.3, 0.6, 0.3],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </motion.div>

        {/* Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="space-y-3 mb-8"
        >
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">
            Page Not Found
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Oops! The page you're looking for doesn't exist or has been moved.
            Try searching for what you need.
          </p>
        </motion.div>

        {/* Search Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="w-full max-w-md mb-6"
        >
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search for a page... (↑↓ to navigate)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-10 pr-4 h-12 text-base"
            />
          </form>

          {/* Search Results */}
          {searchQuery && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 bg-card border border-border rounded-lg shadow-lg overflow-hidden"
            >
              {searchResults.length > 0 ? (
                <ul className="divide-y divide-border">
                  {searchResults.map((result, index) => (
                    <li key={result.path}>
                      <Link
                        to={result.path}
                        className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                          index === selectedIndex
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-muted"
                        }`}
                        onMouseEnter={() => setSelectedIndex(index)}
                      >
                        <Search className={`w-4 h-4 ${index === selectedIndex ? "text-primary" : "text-muted-foreground"}`} />
                        <span className={index === selectedIndex ? "text-primary font-medium" : "text-foreground"}>
                          {result.label}
                        </span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {result.path}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-4 py-3 text-muted-foreground text-sm">
                  No pages found for "{searchQuery}"
                </div>
              )}
            </motion.div>
          )}
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="flex flex-col sm:flex-row gap-3 mb-12"
        >
          <Button asChild size="lg" className="gap-2">
            <Link to="/">
              <Home className="w-4 h-4" />
              Go Home
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="gap-2">
            <Link to="/dashboard">
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </Link>
          </Button>
        </motion.div>

        {/* Helpful Links */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="border-t border-border pt-8 w-full max-w-lg"
        >
          <p className="text-sm text-muted-foreground mb-4">
            Popular destinations
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/features"
              className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              Features
            </Link>
            <Link
              to="/help"
              className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              Help Center
            </Link>
          </div>
        </motion.div>
      </div>
    </PublicLayout>
  );
};

export default NotFound;
