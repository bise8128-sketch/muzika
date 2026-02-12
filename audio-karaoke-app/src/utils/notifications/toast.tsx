/**
 * Toast Notification System
 * 
 * Provides a clean, accessible way to display notifications
 * instead of using browser alerts.
 */

'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number;
    dismissible?: boolean;
}

interface ToastContextValue {
    toasts: Toast[];
    addToast: (toast: Omit<Toast, 'id'>) => string;
    removeToast: (id: string) => void;
    clearAllToasts: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Generate unique ID for toasts
 */
function generateToastId(): string {
    return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Toast Provider Component
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((toast: Omit<Toast, 'id'>): string => {
        const id = generateToastId();
        const newToast: Toast = {
            ...toast,
            id,
            duration: toast.duration ?? 5000,
            dismissible: toast.dismissible ?? true,
        };

        setToasts(prev => [...prev, newToast]);
        return id;
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const clearAllToasts = useCallback(() => {
        setToasts([]);
    }, []);

    // Auto-dismiss toasts
    useEffect(() => {
        const timers: NodeJS.Timeout[] = [];

        toasts.forEach(toast => {
            if (toast.duration && toast.duration > 0) {
                const timer = setTimeout(() => {
                    removeToast(toast.id);
                }, toast.duration);
                timers.push(timer);
            }
        });

        return () => {
            timers.forEach(timer => clearTimeout(timer));
        };
    }, [toasts, removeToast]);

    return (
        <ToastContext.Provider value={{ toasts, addToast, removeToast, clearAllToasts }}>
            {children}
            <ToastContainer />
        </ToastContext.Provider>
    );
}

/**
 * Hook to use toast notifications
 */
export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

/**
 * Toast Container Component
 */
function ToastContainer() {
    const { toasts, removeToast } = useToast();

    if (toasts.length === 0) return null;

    return (
        <div 
            className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md"
            role="region"
            aria-label="Notifications"
        >
            {toasts.map(toast => (
                <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
            ))}
        </div>
    );
}

/**
 * Individual Toast Item
 */
function ToastItem({ 
    toast, 
    onDismiss 
}: { 
    toast: Toast; 
    onDismiss: (id: string) => void;
}) {
    const icons: Record<ToastType, string> = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };

    const colors: Record<ToastType, string> = {
        success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
        error: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
        warning: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
        info: 'bg-blue-500/10 border-blue-500/30 text-blue-400'
    };

    const iconColors: Record<ToastType, string> = {
        success: 'bg-emerald-500',
        error: 'bg-rose-500',
        warning: 'bg-amber-500',
        info: 'bg-blue-500'
    };

    return (
        <div 
            className={`
                animate-in slide-in-from-right-full fade-in duration-300
                p-4 rounded-lg border backdrop-blur-sm
                ${colors[toast.type]}
            `}
            role="alert"
            aria-live="polite"
        >
            <div className="flex items-start gap-3">
                <div className={`
                    w-6 h-6 rounded-full flex items-center justify-center text-white text-sm
                    ${iconColors[toast.type]}
                `}>
                    {icons[toast.type]}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-medium text-white">{toast.title}</p>
                    {toast.message && (
                        <p className="text-sm opacity-80 mt-1">{toast.message}</p>
                    )}
                </div>
                {toast.dismissible && (
                    <button
                        onClick={() => onDismiss(toast.id)}
                        className="text-current opacity-50 hover:opacity-100 transition-opacity"
                        aria-label="Dismiss notification"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>
        </div>
    );
}

/**
 * Error notification helper
 * Creates a user-friendly error toast from an error object
 */
export function createErrorToast(error: unknown): Omit<Toast, 'id'> {
    let title = 'An error occurred';
    let message: string | undefined;

    if (error instanceof Error) {
        // Use the error message but sanitize it
        title = error.message.slice(0, 100) || 'An unexpected error occurred';
        
        // Don't expose internal error details
        if (error.message.includes('ECONNREFUSED') || 
            error.message.includes('ETIMEDOUT') ||
            error.message.includes('NetworkError')) {
            title = 'Connection error';
            message = 'Please check your internet connection and try again.';
        }
    } else if (typeof error === 'string') {
        title = error.slice(0, 100);
    }

    return {
        type: 'error',
        title,
        message,
        duration: 7000 // Longer duration for errors
    };
}
