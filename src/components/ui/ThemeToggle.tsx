import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useAuth } from "@/contexts/AuthContext";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const iconVariants = {
  initial: { scale: 0, rotate: -180, opacity: 0 },
  animate: { scale: 1, rotate: 0, opacity: 1 },
  exit: { scale: 0, rotate: 180, opacity: 0 },
};

const themeLabels = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

export function ThemeToggle() {
  const { user } = useAuth();
  const { resolvedTheme, theme, setTheme } = useTheme();
  const { preferences, cycleTheme } = useUserPreferences();

  // Use preferences theme for logged-in users, otherwise use local theme
  const currentTheme = user ? preferences.theme : (theme as "light" | "dark" | "system") || "system";

  const handleClick = () => {
    if (user) {
      // Logged-in users: persist to database
      cycleTheme();
    } else {
      // Anonymous users: cycle locally
      const themes: Array<"light" | "dark" | "system"> = ["light", "dark", "system"];
      const currentIndex = themes.indexOf(currentTheme);
      const nextTheme = themes[(currentIndex + 1) % themes.length];
      setTheme(nextTheme);
    }
  };

  const getIcon = () => {
    if (currentTheme === "system") {
      return <Monitor className="h-4 w-4" />;
    }
    return resolvedTheme === "dark" ? (
      <Moon className="h-4 w-4" />
    ) : (
      <Sun className="h-4 w-4" />
    );
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 relative overflow-hidden"
          onClick={handleClick}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={currentTheme}
              variants={iconVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="absolute flex items-center justify-center"
            >
              {getIcon()}
            </motion.div>
          </AnimatePresence>
          <span className="sr-only">Toggle theme ({themeLabels[currentTheme]})</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Theme: {themeLabels[currentTheme]}</p>
        <p className="text-xs text-muted-foreground">Click to cycle</p>
      </TooltipContent>
    </Tooltip>
  );
}
