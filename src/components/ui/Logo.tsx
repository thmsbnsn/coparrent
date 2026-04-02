import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
}

export const Logo = ({ className, showText = true, size = "md" }: LogoProps) => {
  const sizes = {
    sm: { frame: "h-6 w-6", image: "scale-[1.42]", text: "text-lg" },
    md: { frame: "h-8 w-8", image: "scale-[1.4]", text: "text-xl" },
    lg: { frame: "h-12 w-12", image: "scale-[1.38]", text: "text-3xl" },
  };

  return (
    <div
      className={cn("flex items-center gap-2", className)}
      aria-label={showText ? undefined : "CoParrent"}
    >
      <span className={cn("relative shrink-0 overflow-hidden rounded-[22%]", sizes[size].frame)}>
        <img
          src="/icons/icon-192.png"
          alt={showText ? "" : "CoParrent"}
          aria-hidden={showText}
          className={cn("absolute inset-0 h-full w-full object-cover", sizes[size].image)}
        />
      </span>
      {showText && (
        <span className={cn("font-display font-bold tracking-tight text-foreground", sizes[size].text)}>
          CoParrent
        </span>
      )}
    </div>
  );
};
