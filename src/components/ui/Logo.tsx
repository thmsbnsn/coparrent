import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
}

export const Logo = ({ className, showText = true, size = "md" }: LogoProps) => {
  const sizes = {
    sm: { icon: "w-6 h-6", text: "text-lg" },
    md: { icon: "w-8 h-8", text: "text-xl" },
    lg: { icon: "w-12 h-12", text: "text-3xl" },
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn("relative", sizes[size].icon)}>
        {/* CoParrent Logo - Flow/Current waves connecting two parents */}
        <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
          {/* Left parent circle */}
          <circle cx="10" cy="14" r="5" fill="url(#parentGradient1)" />
          {/* Right parent circle */}
          <circle cx="30" cy="14" r="5" fill="url(#parentGradient2)" />
          {/* Flowing current wave connecting them */}
          <path
            d="M10 20C10 20 14 28 20 28C26 28 30 20 30 20"
            stroke="url(#flowGradient)"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M13 24C13 24 16 30 20 30C24 30 27 24 27 24"
            stroke="url(#flowGradient)"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M16 28C16 28 18 33 20 33C22 33 24 28 24 28"
            stroke="url(#flowGradient)"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
          {/* Child circle at center bottom */}
          <circle cx="20" cy="36" r="3" fill="url(#childGradient)" />
          <defs>
            <linearGradient id="parentGradient1" x1="5" y1="9" x2="15" y2="19" gradientUnits="userSpaceOnUse">
              <stop stopColor="hsl(222, 60%, 50%)" />
              <stop offset="1" stopColor="hsl(222, 47%, 35%)" />
            </linearGradient>
            <linearGradient id="parentGradient2" x1="25" y1="9" x2="35" y2="19" gradientUnits="userSpaceOnUse">
              <stop stopColor="hsl(174, 50%, 45%)" />
              <stop offset="1" stopColor="hsl(150, 45%, 40%)" />
            </linearGradient>
            <linearGradient id="flowGradient" x1="10" y1="20" x2="30" y2="30" gradientUnits="userSpaceOnUse">
              <stop stopColor="hsl(222, 60%, 50%)" />
              <stop offset="0.5" stopColor="hsl(200, 55%, 45%)" />
              <stop offset="1" stopColor="hsl(174, 50%, 45%)" />
            </linearGradient>
            <linearGradient id="childGradient" x1="17" y1="33" x2="23" y2="39" gradientUnits="userSpaceOnUse">
              <stop stopColor="hsl(38, 92%, 50%)" />
              <stop offset="1" stopColor="hsl(30, 85%, 50%)" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      {showText && (
        <span className={cn("font-display font-bold tracking-tight", sizes[size].text)}>
          <span className="text-primary">Co</span>
          <span className="text-gradient bg-gradient-accent">Parrent</span>
        </span>
      )}
    </div>
  );
};
