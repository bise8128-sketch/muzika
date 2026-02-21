import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AppError } from '@/errors';

interface Props {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        if (typeof this.props.fallback === 'function') {
          return this.props.fallback(this.state.error!, this.handleReset);
        }
        return this.props.fallback;
      }

      const error = this.state.error!;
      let errorTitle = "Signal Interrupted";
      let errorDescription = "Muzika encountered an unexpected error. Don't worry, your audio data is likely safe.";
      let isRecoverable = true;

      if (error instanceof AppError) {
        isRecoverable = error.isRecoverable;
        
        switch (error.code) {
          case 'ERR_STORAGE_QUOTA':
            errorTitle = "Storage Full";
            errorDescription = "We don't have enough space to process this audio. Please free up some disk space on your device and try again.";
            break;
          case 'ERR_AUDIO_PROCESSING':
          case 'ERR_AUDIO_CONTEXT':
            errorTitle = "Audio Engine Error";
            errorDescription = "The audio engine encountered a problem. " + error.message;
            break;
          case 'ERR_NETWORK_FETCH':
            errorTitle = "Connection Dropped";
            errorDescription = "Unable to download necessary resources. Please check your internet connection and try again.";
            break;
          case 'ERR_MODEL_LOAD':
          case 'ERR_MODEL_INFERENCE':
            errorTitle = "AI Engine Offline";
            errorDescription = "There was a problem loading or running the AI models. " + error.message;
            break;
          default:
            errorTitle = "Application Error";
            errorDescription = error.message;
        }
      }

      return (
        <div className="flex flex-col items-center justify-center p-12 m-8 rounded-3xl bg-white/5 backdrop-blur-2xl border border-white/10 text-center animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 mb-6 bg-red-500/20 rounded-full flex items-center justify-center text-red-500">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter">{errorTitle}</h2>
          <p className="text-white/60 mb-8 max-w-md font-medium">
            {errorDescription}
          </p>
          <div className="flex gap-4">
            {isRecoverable && (
              <button
                onClick={this.handleReset}
                className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-all backdrop-blur-xl border border-white/10"
              >
                Try to Resume
              </button>
            )}
            <button
              onClick={() => window.location.reload()}
              className="px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-purple-600/20"
            >
              System Reset
            </button>
          </div>
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-8 p-4 bg-black/40 rounded-xl text-left overflow-auto max-w-full text-xs font-mono text-red-400">
              {this.state.error?.toString()}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
