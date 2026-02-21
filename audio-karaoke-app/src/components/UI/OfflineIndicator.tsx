'use client';

import React from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { WifiOff, Wifi } from 'lucide-react';

/**
 * Premium Offline Indicator component
 * Uses glassmorphism and subtle animations for a high-end feel.
 */
export const OfflineIndicator: React.FC = () => {
    const isOnline = useOnlineStatus();
    const [showOnline, setShowOnline] = React.useState(false);

    // Briefly show "Back Online" when connection returns
    React.useEffect(() => {
        if (isOnline) {
            setShowOnline(true);
            const timer = setTimeout(() => setShowOnline(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [isOnline]);

    if (isOnline && !showOnline) return null;

    return (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 transition-all duration-700 ease-out-expo
            ${isOnline ? 'translate-y-20 opacity-0' : 'translate-y-0 opacity-100'}`}>
            <div className={`flex items-center gap-3 px-6 py-3 rounded-full border shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-5 duration-500
                ${isOnline 
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                    : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                
                <div className={`p-1.5 rounded-full ${isOnline ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                    {isOnline ? <Wifi size={18} /> : <WifiOff size={18} />}
                </div>
                
                <span className="text-sm font-bold tracking-tight">
                    {isOnline ? 'Connection Restored' : 'Operating Offline'}
                </span>
                
                {!isOnline && (
                    <div className="flex gap-1 ml-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse delay-75" />
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse delay-150" />
                    </div>
                )}
            </div>
            
            {/* Subtle glow behind the indicator */}
            <div className={`absolute -inset-2 blur-2xl opacity-20 -z-10 rounded-full
                ${isOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
        </div>
    );
};
