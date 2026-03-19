import { LogoSpinner } from "./LogoSpinner";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  fullScreen?: boolean;
  message?: string;
}

const sizeMap = {
  sm: 32,
  md: 56,
  lg: 80,
};

export const LoadingSpinner = ({ 
  size = "md", 
  fullScreen = false,
  message 
}: LoadingSpinnerProps) => {
  const content = (
    <LogoSpinner 
      size={sizeMap[size]} 
      label={message}
    />
  );

  if (fullScreen) {
    return (
      <div className={cn(
        "fixed inset-0 z-50 flex items-center justify-center",
        "bg-background"
      )}>
        {content}
      </div>
    );
  }

  return content;
};

export default LoadingSpinner;
