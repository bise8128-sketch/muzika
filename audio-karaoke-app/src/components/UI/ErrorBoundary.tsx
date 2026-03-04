import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AppError } from '@/errors';
import { logError, logEvent } from '@/lib/monitoring';

/**
 * Error severity levels for categorizing errors
 */
export type ErrorSeverity = 'critical' | 'warning' | 'recoverable';

/**
 * Error boundary variant for hierarchical error handling
 */
export type ErrorBoundaryVariant = 'global' | 'feature' | 'component';

interface Props {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  onReset?: () => void;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  variant?: ErrorBoundaryVariant;
  featureName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  recoveryAttempts: number;
}

/**
 * Determines the severity of an error for telemetry and UI purposes.
 */
function getErrorSeverity(error: Error): ErrorSeverity {
  if (error instanceof AppError) {
    if (error.isRecoverable) {
      return 'recoverable';
    }
    // Critical errors that require full page reload
    if (['ERR_STORAGE_QUOTA', 'ERR_MODEL_LOAD'].includes(error.code)) {
      return 'critical';
    }
    return 'warning';
  }
  // Unknown errors are treated as warnings
  return 'warning';
}

/**
 * ErrorBoundary component that captures runtime exceptions across the component tree.
 * Supports hierarchical error handling with different variants:
 * - 'global': Top-level boundary that catches all unhandled errors
 * - 'feature': Boundary around major features (e.g., audio processing, karaoke player)
 * - 'component': Granular boundary around individual components
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    recoveryAttempts: 0
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { variant = 'component', featureName, onError } = this.props;
    const severity = getErrorSeverity(error);
    
    // Log error to telemetry with enhanced context
    logError(error, {
      componentStack: errorInfo.componentStack,
      variant,
      featureName,
      severity,
      recoveryAttempts: this.state.recoveryAttempts,
      timestamp: new Date().toISOString()
    });

    // Track error event for analytics
    logEvent('error_boundary_triggered', {
      errorType: error.name,
      errorCode: error instanceof AppError ? error.code : 'UNKNOWN',
      variant,
      featureName,
      severity
    });

    // Store errorInfo in state for debugging
    this.setState({ errorInfo });

    // Propagate to parent error handler if provided
    onError?.(error, errorInfo);

    console.error(`[ErrorBoundary:${variant}${featureName ? `:${featureName}` : ''}] Uncaught error:`, error, errorInfo);
  }

  private handleReset = () => {
    const { variant = 'component', featureName } = this.props;
    
    // Track recovery attempt
    logEvent('error_recovery_attempted', {
      variant,
      featureName,
      recoveryAttempts: this.state.recoveryAttempts + 1
    });

    this.setState((prevState) => ({
      hasError: false,
      error: null,
      errorInfo: null,
      recoveryAttempts: prevState.recoveryAttempts + 1
    }));
    
    this.props.onReset?.();
  };

  private handleClearCache = async () => {
    const { variant = 'component', featureName } = this.props;
    
    try {
      // Clear various caches that might be causing issues
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      
      // Clear localStorage error flags
      if (typeof localStorage !== 'undefined') {
        const keysToRemove = Object.keys(localStorage).filter(key => 
          key.startsWith('muzika_error_') || key.startsWith('muzika_cache_')
        );
        keysToRemove.forEach(key => localStorage.removeItem(key));
      }

      logEvent('cache_cleared_for_recovery', { variant, featureName });
      
      // Attempt reset after cache clear
      this.handleReset();
    } catch (e) {
      console.error('Failed to clear cache:', e);
      // Still try to reset
      this.handleReset();
    }
  };

  private handleReportIssue = () => {
    const { error, errorInfo } = this.state;
    
    // Build error report
    const report = {
      error: error?.toString(),
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      url: typeof window !== 'undefined' ? window.location.href : 'N/A',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
      timestamp: new Date().toISOString()
    };
    
    // Encode and open issue URL (if configured) or copy to clipboard
    const reportJson = JSON.stringify(report, null, 2);
    
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(reportJson).then(() => {
        alert('Error details copied to clipboard. Please paste them when reporting the issue.');
      });
    }

    logEvent('error_report_initiated', { errorType: error?.name });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        if (typeof this.props.fallback === 'function') {
          return this.props.fallback(this.state.error!, this.handleReset);
        }
        return this.props.fallback;
      }

      const { variant = 'component', featureName } = this.props;
      const error = this.state.error!;
      const severity = getErrorSeverity(error);
      let errorTitle = "Signal Interrupted";
      let errorDescription = "Muzika encountered an unexpected error. Don't worry, your audio data is likely safe.";
      let isRecoverable = true;
      let showClearCache = false;
      const showReportButton = true;

      if (error instanceof AppError) {
        isRecoverable = error.isRecoverable;
        
        switch (error.code) {
          case 'ERR_STORAGE_QUOTA':
            errorTitle = "Storage Full";
            errorDescription = "We don't have enough space to process this audio. Please free up some disk space on your device and try again.";
            showClearCache = true;
            break;
          case 'ERR_AUDIO_PROCESSING':
          case 'ERR_AUDIO_CONTEXT':
            errorTitle = "Audio Engine Error";
            errorDescription = "The audio engine encountered a problem. " + error.message;
            showClearCache = true;
            break;
          case 'ERR_NETWORK_FETCH':
            errorTitle = "Connection Dropped";
            errorDescription = "Unable to download necessary resources. Please check your internet connection and try again.";
            break;
          case 'ERR_MODEL_LOAD':
          case 'ERR_MODEL_INFERENCE':
            errorTitle = "AI Engine Offline";
            errorDescription = "There was a problem loading or running the AI models. " + error.message;
            showClearCache = true;
            break;
          default:
            errorTitle = "Application Error";
            errorDescription = error.message;
        }
      }

      // Customize UI based on variant
      const isGlobal = variant === 'global';
      const containerClass = isGlobal
        ? "min-h-screen flex flex-col items-center justify-center p-12 bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900"
        : "flex flex-col items-center justify-center p-12 m-8 rounded-3xl bg-white/5 backdrop-blur-2xl border border-white/10 text-center animate-in fade-in zoom-in duration-500";

      // Icon based on severity
      const iconBgClass = severity === 'critical' ? 'bg-red-500/20' : severity === 'warning' ? 'bg-yellow-500/20' : 'bg-blue-500/20';
      const iconTextClass = severity === 'critical' ? 'text-red-500' : severity === 'warning' ? 'text-yellow-500' : 'text-blue-500';

      return (
        <div className={containerClass}>
          <div className={`w-20 h-20 mb-6 ${iconBgClass} rounded-full flex items-center justify-center ${iconTextClass}`}>
            {severity === 'critical' ? (
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            ) : severity === 'warning' ? (
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
          </div>
          
          {featureName && (
            <span className="text-xs text-white/40 uppercase tracking-widest mb-2">
              {featureName}
            </span>
          )}
          
          <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter">
            {errorTitle}
          </h2>
          
          <p className="text-white/60 mb-8 max-w-md font-medium">
            {errorDescription}
          </p>
          
          {/* Recovery attempts indicator */}
          {this.state.recoveryAttempts > 0 && (
            <p className="text-white/40 text-sm mb-4">
              Recovery attempts: {this.state.recoveryAttempts}
            </p>
          )}
          
          <div className="flex flex-wrap gap-4 justify-center">
            {isRecoverable && (
              <button
                onClick={this.handleReset}
                className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-all backdrop-blur-xl border border-white/10"
              >
                Try to Resume
              </button>
            )}
            
            {showClearCache && (
              <button
                onClick={this.handleClearCache}
                className="px-8 py-3 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 rounded-xl font-bold transition-all backdrop-blur-xl border border-yellow-500/20"
              >
                Clear Cache & Retry
              </button>
            )}
            
            <button
              onClick={() => window.location.reload()}
              className="px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-purple-600/20"
            >
              {isGlobal ? 'Restart Application' : 'System Reset'}
            </button>
          </div>
          
          {showReportButton && (
            <button
              onClick={this.handleReportIssue}
              className="mt-4 px-4 py-2 text-white/40 hover:text-white/60 text-sm underline transition-colors"
            >
              Copy error details for reporting
            </button>
          )}
          
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-8 p-4 bg-black/40 rounded-xl text-left overflow-auto max-w-full max-h-48 text-xs font-mono text-red-400">
              <div className="mb-2 text-white/60">Error: {this.state.error?.toString()}</div>
              {this.state.error?.stack && (
                <pre className="whitespace-pre-wrap text-red-400/80">{this.state.error.stack}</pre>
              )}
              {this.state.errorInfo?.componentStack && (
                <>
                  <div className="mt-4 mb-2 text-white/60">Component Stack:</div>
                  <pre className="whitespace-pre-wrap text-yellow-400/80">{this.state.errorInfo.componentStack}</pre>
                </>
              )}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Global Error Boundary wrapper for application-level error handling.
 */
export function GlobalErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary variant="global">
      {children}
    </ErrorBoundary>
  );
}

/**
 * Feature Error Boundary wrapper for feature-level error handling.
 */
export function FeatureErrorBoundary({ 
  children, 
  featureName,
  onReset
}: { 
  children: ReactNode; 
  featureName: string;
  onReset?: () => void;
}) {
  return (
    <ErrorBoundary variant="feature" featureName={featureName} onReset={onReset}>
      {children}
    </ErrorBoundary>
  );
}
