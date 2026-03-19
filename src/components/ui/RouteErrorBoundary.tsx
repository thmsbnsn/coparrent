import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ArrowLeft, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  routeName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
}

// Simple error ID generator for tracking
const generateErrorId = () => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `ERR-${timestamp}-${random}`.toUpperCase();
};

export class RouteErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorId: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { 
      hasError: true, 
      error,
      errorId: generateErrorId(),
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorId = this.state.errorId || generateErrorId();
    
    // Enhanced logging for debugging
    console.error(`[RouteErrorBoundary] Error ID: ${errorId}`);
    console.error(`[RouteErrorBoundary] Route: ${this.props.routeName || 'Unknown'}`);
    console.error(`[RouteErrorBoundary] Error:`, error);
    console.error(`[RouteErrorBoundary] Component Stack:`, errorInfo.componentStack);
    
    // Log to sessionStorage for potential retrieval
    try {
      const errorLog = {
        id: errorId,
        route: this.props.routeName || 'Unknown',
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      };
      
      // Store last 5 errors
      const existingErrors = JSON.parse(sessionStorage.getItem('error_logs') || '[]');
      existingErrors.unshift(errorLog);
      sessionStorage.setItem('error_logs', JSON.stringify(existingErrors.slice(0, 5)));
    } catch {
      // Ignore storage errors
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorId: null });
  };

  private handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  private handleGoBack = () => {
    window.history.back();
  };

  private handleReportBug = () => {
    const { error, errorId } = this.state;
    const subject = encodeURIComponent(`Bug Report: ${errorId || 'Unknown Error'}`);
    const body = encodeURIComponent(
      `Error ID: ${errorId || 'Unknown'}\n` +
      `Page: ${this.props.routeName || 'Unknown'}\n` +
      `URL: ${window.location.href}\n` +
      `Error: ${error?.message || 'Unknown error'}\n\n` +
      `Please describe what you were doing when this error occurred:\n\n`
    );
    window.open(`mailto:support@coparrent.com?subject=${subject}&body=${body}`, '_blank');
  };

  public render() {
    if (this.state.hasError) {
      const { error, errorId } = this.state;
      
      // Sanitize error message for display (hide technical details)
      const displayMessage = this.getDisplayMessage(error);
      
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-background">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="rounded-full bg-destructive/10 w-20 h-20 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-10 h-10 text-destructive" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-display font-bold text-foreground">
                Something went wrong
              </h1>
              <p className="text-muted-foreground">
                {displayMessage}
              </p>
            </div>

            {/* Error reference ID for support */}
            {errorId && (
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">
                  Reference ID: <code className="font-mono text-foreground">{errorId}</code>
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={this.handleGoBack} variant="outline">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Go Back
                </Button>
                <Button onClick={this.handleRetry} variant="outline">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
                <Button onClick={this.handleGoHome}>
                  <Home className="w-4 h-4 mr-2" />
                  Dashboard
                </Button>
              </div>
              
              {/* Report bug option */}
              <Button 
                onClick={this.handleReportBug} 
                variant="ghost" 
                size="sm"
                className="text-muted-foreground"
              >
                <Bug className="w-4 h-4 mr-2" />
                Report this issue
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }

  private getDisplayMessage(error: Error | null): string {
    if (!error) {
      return "We encountered an unexpected error. Please try again or navigate to a different section.";
    }

    const message = error.message.toLowerCase();
    
    // Map technical errors to user-friendly messages
    if (message.includes('network') || message.includes('fetch')) {
      return "We're having trouble connecting. Please check your internet connection and try again.";
    }
    
    if (message.includes('auth') || message.includes('unauthorized') || message.includes('401')) {
      return "Your session may have expired. Please try signing in again.";
    }
    
    if (message.includes('permission') || message.includes('403')) {
      return "You don't have permission to access this page.";
    }
    
    if (message.includes('not found') || message.includes('404')) {
      return "The page or resource you're looking for couldn't be found.";
    }

    if (message.includes('timeout')) {
      return "The request took too long. Please try again.";
    }
    
    // Default message for other errors
    return "We encountered an error while loading this page. Please try again or navigate to a different section.";
  }
}
