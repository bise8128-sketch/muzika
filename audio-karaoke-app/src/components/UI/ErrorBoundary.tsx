'use client';

import React, { Component, type ReactNode, type ErrorInfo } from 'react';
import { logError } from '@/lib/monitoring';

interface ErrorBoundaryProps {
    children: ReactNode;
    /** Optional custom fallback UI renderer */
    fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

/**
 * React Error Boundary — catches render errors in child components
 * and displays a fallback UI instead of crashing the entire app.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        logError(error, { component: 'ErrorBoundary', errorInfo });
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError && this.state.error) {
            if (this.props.fallback) {
                return this.props.fallback(this.state.error, this.handleReset);
            }

            return (
                <div
                    role="alert"
                    className="flex flex-col items-center justify-center gap-4 p-8 rounded-2xl border border-rose-500/20 bg-rose-500/5 text-center max-w-lg mx-auto my-12"
                >
                    <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center">
                        <svg className="w-6 h-6 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-bold text-rose-300">Something went wrong</h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                        {this.state.error.message || 'An unexpected error occurred.'}
                    </p>
                    <button
                        onClick={this.handleReset}
                        className="mt-2 px-6 py-2 rounded-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-medium text-sm transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
