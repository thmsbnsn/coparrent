import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  featureName?: string;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class FeatureErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`FeatureErrorBoundary [${this.props.featureName || 'Unknown'}] caught an error:`, error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="rounded-full bg-destructive/10 w-12 h-12 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-destructive" />
            </div>
            
            <div className="space-y-1">
              <h3 className="font-medium text-foreground">
                {this.props.featureName ? `${this.props.featureName} failed to load` : 'Something went wrong'}
              </h3>
              <p className="text-sm text-muted-foreground">
                This section encountered an error. Try refreshing.
              </p>
            </div>

            {this.state.error && (
              <p className="text-xs text-muted-foreground font-mono bg-muted/50 px-3 py-1.5 rounded max-w-full overflow-auto">
                {this.state.error.message}
              </p>
            )}

            <Button onClick={this.handleRetry} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
