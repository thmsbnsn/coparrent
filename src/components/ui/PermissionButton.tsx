import { forwardRef, ReactNode } from "react";
import { Lock } from "lucide-react";
import { Button, ButtonProps } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface PermissionButtonProps extends ButtonProps {
  /** Whether the user has permission for this action */
  hasPermission: boolean;
  /** Message shown when user lacks permission */
  deniedMessage?: string;
  /** Hide the button entirely instead of disabling */
  hideWhenDenied?: boolean;
  children: ReactNode;
}

/**
 * PermissionButton - Button that respects role-based permissions
 * 
 * Automatically disables and shows a tooltip when the user lacks permission.
 * This prevents silent failures and makes the UI predictable from role alone.
 */
export const PermissionButton = forwardRef<HTMLButtonElement, PermissionButtonProps>(
  (
    {
      hasPermission,
      deniedMessage = "You don't have permission for this action",
      hideWhenDenied = false,
      disabled,
      className,
      children,
      ...props
    },
    ref
  ) => {
    // If hiding when denied, return null
    if (!hasPermission && hideWhenDenied) {
      return null;
    }

    const isDisabled = disabled || !hasPermission;

    // If has permission, render normal button
    if (hasPermission) {
      return (
        <Button ref={ref} disabled={disabled} className={className} {...props}>
          {children}
        </Button>
      );
    }

    // No permission - show disabled button with tooltip
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-block">
              <Button
                ref={ref}
                disabled={true}
                className={cn("pointer-events-none", className)}
                {...props}
              >
                <Lock className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                {children}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-sm">{deniedMessage}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
);

PermissionButton.displayName = "PermissionButton";
