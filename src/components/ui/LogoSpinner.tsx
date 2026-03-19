import { cn } from "@/lib/utils";
import logoMark from "@/assets/coparrent-mark.svg";

interface LogoSpinnerProps {
  size?: number;
  label?: string;
  className?: string;
}

export const LogoSpinner = ({ 
  size = 64, 
  label,
  className 
}: LogoSpinnerProps) => {
  const ringSize = size + 16;
  const strokeWidth = Math.max(2, size / 16);

  return (
    <div 
      className={cn("flex flex-col items-center justify-center gap-3", className)}
      role="status"
      aria-label={label || "Loading"}
    >
      <div className="relative" style={{ width: ringSize, height: ringSize }}>
        {/* Spinning outer ring */}
        <svg
          className="absolute inset-0 animate-spin"
          style={{ 
            width: ringSize, 
            height: ringSize,
            animationDuration: '1.5s'
          }}
          viewBox={`0 0 ${ringSize} ${ringSize}`}
          fill="none"
        >
          <circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={(ringSize - strokeWidth) / 2}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted opacity-20"
          />
          <circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={(ringSize - strokeWidth) / 2}
            stroke="url(#spinner-gradient)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${(ringSize - strokeWidth) * Math.PI * 0.25} ${(ringSize - strokeWidth) * Math.PI * 0.75}`}
          />
          <defs>
            <linearGradient id="spinner-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--primary))" />
              <stop offset="100%" stopColor="hsl(174 50% 45%)" />
            </linearGradient>
          </defs>
        </svg>
        
        {/* Static centered logo */}
        <img
          src={logoMark}
          alt="CoParrent"
          className="absolute"
          style={{
            width: size,
            height: size,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)'
          }}
        />
      </div>
      
      {label && (
        <p className="text-sm text-muted-foreground animate-pulse">
          {label}
        </p>
      )}
    </div>
  );
};

export default LogoSpinner;
