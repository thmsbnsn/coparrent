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
    <div
      className={cn("flex items-center gap-2", className)}
      aria-label={showText ? undefined : "CoParrent"}
    >
      <img
        src="/icons/logo.svg"
        alt={showText ? "" : "CoParrent"}
        aria-hidden={showText}
        className={cn("shrink-0 object-contain", sizes[size].icon)}
      />
      {showText && (
        <span className={cn("font-display font-bold tracking-tight text-foreground", sizes[size].text)}>
          CoParrent
        </span>
      )}
    </div>
  );
};
