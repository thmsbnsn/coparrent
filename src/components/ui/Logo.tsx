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
      {/* Inline SVG using the favicon/PWA icon design */}
      <svg 
        viewBox="0 0 64 64" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className={cn(sizes[size].icon)}
        aria-label="CoParrent Logo"
      >
        <defs>
          <linearGradient id="coparrent-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0EA5E9"/>
            <stop offset="50%" stopColor="#14B8A6"/>
            <stop offset="100%" stopColor="#06B6D4"/>
          </linearGradient>
        </defs>
        
        {/* Left House */}
        <path d="M8 34L20 22L32 34V52H8V34Z" fill="url(#coparrent-gradient)"/>
        {/* Left Roof */}
        <path d="M4 34L20 18L32 30L28 34L20 26L12 34H4Z" fill="url(#coparrent-gradient)"/>
        {/* Left Window */}
        <rect x="14" y="38" width="8" height="8" rx="1" fill="white" fillOpacity="0.9"/>
        
        {/* Right House (mirrored) */}
        <path d="M56 34L44 22L32 34V52H56V34Z" fill="url(#coparrent-gradient)"/>
        {/* Right Roof */}
        <path d="M60 34L44 18L32 30L36 34L44 26L52 34H60Z" fill="url(#coparrent-gradient)"/>
        {/* Right Window */}
        <rect x="42" y="38" width="8" height="8" rx="1" fill="white" fillOpacity="0.9"/>
        
        {/* Bridge connecting both homes */}
        <rect x="24" y="44" width="16" height="4" rx="2" fill="url(#coparrent-gradient)"/>
        <circle cx="32" cy="46" r="3" fill="white" fillOpacity="0.9"/>
      </svg>
      {showText && (
        <span 
          className={cn(
            "font-display font-bold tracking-tight bg-clip-text text-transparent",
            sizes[size].text
          )}
          style={{
            backgroundImage: "linear-gradient(135deg, #0EA5E9 0%, #14B8A6 50%, #06B6D4 100%)"
          }}
        >
          CoParrent
        </span>
      )}
    </div>
  );
};
