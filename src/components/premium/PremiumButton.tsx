import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { Button, ButtonProps } from "@/components/ui/button";
import { usePremiumAccess } from "@/hooks/usePremiumAccess";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PremiumButtonProps extends ButtonProps {
  children: ReactNode;
  featureName?: string;
}

export const PremiumButton = ({
  children,
  featureName = "This feature",
  onClick,
  disabled,
  ...props
}: PremiumButtonProps) => {
  const navigate = useNavigate();
  const { hasAccess, loading, reason } = usePremiumAccess();

  const isLocked = !loading && !hasAccess;
  const isExpired = reason === "trial_expired";

  if (isLocked) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              {...props}
              variant="outline"
              className="gap-2 opacity-70"
              onClick={() => navigate("/pricing")}
            >
              <Lock className="h-4 w-4" />
              {children}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {isExpired 
                ? `Trial expired. Upgrade to use ${featureName.toLowerCase()}.`
                : `${featureName} requires a premium subscription.`
              }
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Button {...props} onClick={onClick} disabled={disabled || loading}>
      {children}
    </Button>
  );
};
