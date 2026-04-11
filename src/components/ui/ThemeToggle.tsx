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

interface ThemeToggleProps {
  buttonClassName?: string;
  cycleMode?: "all" | "light-dark";
  showTooltip?: boolean;
}

export function ThemeToggle({
  buttonClassName,
  cycleMode = "all",
  showTooltip = true,
}: ThemeToggleProps) {
  const { user } = useAuth();
  const { resolvedTheme, theme, setTheme } = useTheme();
  const { preferences, cycleTheme, updatePreferences } = useUserPreferences();

  // Use preferences theme for logged-in users, otherwise use local theme
  const currentTheme = user ? preferences.theme : (theme as "light" | "dark" | "system") || "system";
  const iconTheme =
    cycleMode === "light-dark" && currentTheme === "system"
      ? resolvedTheme === "dark"
        ? "dark"
        : "light"
      : currentTheme;
  const visibleThemeLabel = themeLabels[iconTheme as keyof typeof themeLabels];

  const handleClick = () => {
    if (cycleMode === "light-dark") {
      const nextTheme = iconTheme === "dark" ? "light" : "dark";

      if (user) {
        void updatePreferences({ theme: nextTheme });
      } else {
        setTheme(nextTheme);
      }
      return;
    }

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
    if (cycleMode !== "light-dark" && currentTheme === "system") {
      return <Monitor className="h-4 w-4" />;
    }
    return iconTheme === "dark" ? (
      <Moon className="h-4 w-4" />
    ) : (
      <Sun className="h-4 w-4" />
    );
  };

  const button = (
    <Button
      variant="ghost"
      size="icon"
      className={buttonClassName ?? "relative h-9 w-9 overflow-hidden"}
      onClick={handleClick}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${cycleMode}-${iconTheme}`}
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
      <span className="sr-only">Toggle theme ({visibleThemeLabel})</span>
    </Button>
  );

  if (!showTooltip) {
    return button;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>
        <p>Theme: {visibleThemeLabel}</p>
        <p className="text-xs text-muted-foreground">Click to cycle</p>
      </TooltipContent>
    </Tooltip>
  );
}
