/**
 * SecurityBoundary - Error boundary with security assertion checking
 * 
 * Wraps components that require security invariants to hold.
 * Logs violations and renders a safe fallback on security errors.
 * 
 * SECURITY_MODEL.md: "When security rules block an action, the system fails CLOSED"
 */

import { Component, ReactNode, ErrorInfo } from "react";
import { AlertTriangle, ShieldX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";
import { logSecurityEvent } from "@/lib/securityInvariants";

interface SecurityBoundaryProps {
  children: ReactNode;
  /** Name of the protected feature (for logging) */
  feature: string;
  /** Custom fallback when security violation occurs */
  fallback?: ReactNode;
  /** Callback when a security violation is detected */
  onViolation?: (error: Error) => void;
}

interface SecurityBoundaryState {
  hasError: boolean;
  isSecurityError: boolean;
  error: Error | null;
}

/**
 * Custom error class for security violations
 */
export class SecurityViolationError extends Error {
  public readonly invariant: string;
  public readonly details: string;

  constructor(invariant: string, details: string) {
    super(`Security violation: ${invariant} - ${details}`);
    this.name = "SecurityViolationError";
    this.invariant = invariant;
    this.details = details;
  }
}

export class SecurityBoundary extends Component<
  SecurityBoundaryProps,
  SecurityBoundaryState
> {
  constructor(props: SecurityBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      isSecurityError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): SecurityBoundaryState {
    const isSecurityError = error instanceof SecurityViolationError;
    return {
      hasError: true,
      isSecurityError,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { feature, onViolation } = this.props;

    // Log the error
    logger.error("SecurityBoundary caught error", {
      feature,
      error: error.message,
      isSecurityError: error instanceof SecurityViolationError,
      componentStack: errorInfo.componentStack,
    });

    // Log security event if it's a security error
    if (error instanceof SecurityViolationError) {
      logSecurityEvent("SUSPICIOUS_ACTIVITY", {
        feature,
        invariant: error.invariant,
        details: error.details,
      });
    }

    // Call violation callback if provided
    if (onViolation) {
      onViolation(error);
    }
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      isSecurityError: false,
      error: null,
    });
  };

  render(): ReactNode {
    const { hasError, isSecurityError, error } = this.state;
    const { children, feature, fallback } = this.props;

    if (hasError) {
      if (fallback) {
        return fallback;
      }

      if (isSecurityError) {
        // Security error - show locked state
        return (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="p-6 flex flex-col items-center text-center gap-4">
              <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <ShieldX className="h-6 w-6 text-destructive" />
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-lg">Access Denied</h3>
                <p className="text-muted-foreground text-sm max-w-sm">
                  A security check prevented this action. This has been logged.
                </p>
              </div>

              <Button variant="outline" onClick={() => window.location.reload()}>
                Reload Page
              </Button>
            </CardContent>
          </Card>
        );
      }

      // General error
      return (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="p-6 flex flex-col items-center text-center gap-4">
            <div className="h-12 w-12 rounded-full bg-warning/10 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-warning" />
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-lg">Something went wrong</h3>
              <p className="text-muted-foreground text-sm max-w-sm">
                An error occurred in {feature}. Please try again.
              </p>
            </div>

            <Button variant="outline" onClick={this.handleRetry}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      );
    }

    return children;
  }
}

/**
 * Utility to throw a security violation error
 * Use this when an invariant is violated
 */
export function throwSecurityViolation(invariant: string, details: string): never {
  throw new SecurityViolationError(invariant, details);
}

/**
 * Utility to assert and throw on violation
 */
export function assertOrThrow(
  condition: boolean,
  invariant: string,
  details: string
): void {
  if (!condition) {
    throwSecurityViolation(invariant, details);
  }
}
