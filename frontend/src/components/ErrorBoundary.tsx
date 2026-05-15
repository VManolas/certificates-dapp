// frontend/src/components/ErrorBoundary.tsx
/**
 * Error Boundary Component
 * ========================
 * 
 * Catches React errors and provides graceful fallback UI.
 * Prevents entire app from crashing due to component errors.
 * 
 * Features:
 * - Catches errors in component tree
 * - Logs errors to console/monitoring
 * - Provides user-friendly error UI
 * - Offers recovery options
 * 
 * Usage:
 * ```tsx
 * <ErrorBoundary fallback={<CustomError />}>
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 */

import { Component, type ReactNode } from 'react';
import { logger } from '@/lib/logger';
import { AlertCircle, RefreshCw } from 'lucide-react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  resetKeys?: Array<string | number>;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console in development
    logger.error('Error boundary caught error', error, {
      componentStack: errorInfo.componentStack,
    });
    
    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
    
    // Store error info in state
    this.setState({ errorInfo });
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    // Reset error state if resetKeys changed
    if (this.state.hasError && prevProps.resetKeys !== this.props.resetKeys) {
      this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 p-4">
          <div className="max-w-2xl w-full bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700 p-8 shadow-2xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-red-500/10 rounded-xl">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white mb-1">
                  Something went wrong
                </h1>
                <p className="text-gray-400">
                  An unexpected error occurred in the application
                </p>
              </div>
            </div>

            {this.state.error && (
              <div className="mb-6 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                <p className="text-sm text-red-400 font-mono">
                  {this.state.error.message}
                </p>
                {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                  <details className="mt-4">
                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">
                      Component Stack
                    </summary>
                    <pre className="mt-2 text-xs text-gray-500 overflow-x-auto">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Reload Page
              </button>
            </div>

            {process.env.NODE_ENV === 'production' && (
              <p className="mt-6 text-sm text-gray-500">
                If this problem persists, please contact support with the error details above.
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Feature-specific error fallback component
 */
export function FeatureErrorFallback({ 
  title = 'Feature Error',
  message = 'This feature encountered an error',
  onRetry 
}: { 
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="p-6 bg-slate-800/30 backdrop-blur-sm rounded-xl border border-slate-700">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-white font-semibold mb-1">{title}</h3>
          <p className="text-gray-400 text-sm mb-4">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
