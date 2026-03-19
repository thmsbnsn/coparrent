import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Check, X, AlertTriangle } from "lucide-react";

interface PasswordStrengthIndicatorProps {
  password: string;
  className?: string;
}

interface PasswordCheck {
  label: string;
  passed: boolean;
}

export const PasswordStrengthIndicator = ({ password, className }: PasswordStrengthIndicatorProps) => {
  const checks: PasswordCheck[] = useMemo(() => {
    return [
      { label: "At least 8 characters", passed: password.length >= 8 },
      { label: "Contains uppercase letter", passed: /[A-Z]/.test(password) },
      { label: "Contains lowercase letter", passed: /[a-z]/.test(password) },
      { label: "Contains number", passed: /\d/.test(password) },
      { label: "Contains special character", passed: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
    ];
  }, [password]);

  const passedCount = checks.filter((c) => c.passed).length;
  
  const strength = useMemo(() => {
    if (passedCount <= 1) return { label: "Very Weak", color: "bg-destructive", textColor: "text-destructive" };
    if (passedCount === 2) return { label: "Weak", color: "bg-orange-500", textColor: "text-orange-500" };
    if (passedCount === 3) return { label: "Fair", color: "bg-yellow-500", textColor: "text-yellow-600" };
    if (passedCount === 4) return { label: "Good", color: "bg-blue-500", textColor: "text-blue-500" };
    return { label: "Strong", color: "bg-success", textColor: "text-success" };
  }, [passedCount]);

  if (!password) return null;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Strength bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Password strength</span>
          <span className={cn("font-medium", strength.textColor)}>{strength.label}</span>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((level) => (
            <div
              key={level}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                level <= passedCount ? strength.color : "bg-muted"
              )}
            />
          ))}
        </div>
      </div>

      {/* Requirements checklist */}
      <div className="space-y-1">
        {checks.map((check, index) => (
          <div
            key={index}
            className={cn(
              "flex items-center gap-2 text-xs transition-colors",
              check.passed ? "text-success" : "text-muted-foreground"
            )}
          >
            {check.passed ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <X className="w-3.5 h-3.5" />
            )}
            <span>{check.label}</span>
          </div>
        ))}
      </div>

      {/* Warning for common passwords */}
      {password.length >= 8 && passedCount < 3 && (
        <div className="flex items-start gap-2 text-xs text-orange-600 bg-orange-50 dark:bg-orange-950/30 p-2 rounded-md">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>Consider using a mix of letters, numbers, and symbols for better security.</span>
        </div>
      )}
    </div>
  );
};
