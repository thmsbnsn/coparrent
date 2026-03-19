/**
 * Password-safe input component
 * - Always renders as type="password" by default
 * - Supports show/hide toggle
 * - Never exposes password value in props or DOM (except when toggled)
 * - Includes proper autoComplete attributes
 */

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PasswordAutoComplete = "current-password" | "new-password" | "off";

interface PasswordInputProps extends Omit<React.ComponentProps<typeof Input>, "type" | "autoComplete"> {
  /** Allow user to toggle password visibility. Default: true */
  allowReveal?: boolean;
  /** autoComplete hint for password managers. Default: "current-password" */
  autoComplete?: PasswordAutoComplete;
  /** Additional className for the wrapper div */
  wrapperClassName?: string;
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ allowReveal = true, autoComplete = "current-password", wrapperClassName, className, ...props }, ref) => {
    const [show, setShow] = React.useState(false);

    // Reset visibility when input is cleared (e.g., after form submit)
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.value === "") {
        setShow(false);
      }
      props.onChange?.(e);
    };

    return (
      <div className={cn("relative", wrapperClassName)}>
        <Input
          {...props}
          ref={ref}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          onChange={handleChange}
          className={cn(allowReveal && "pr-10", className)}
        />
        {allowReveal && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            tabIndex={-1}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        )}
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";
