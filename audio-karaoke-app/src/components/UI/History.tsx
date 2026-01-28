'use client';

import React from 'react';

interface HistoryItem {
    id: string;
    fileName: string;
    date: string;
    duration: string;
}

interface HistoryProps {
    items: HistoryItem[];
    onRestore: (id: string) => void;
    onClear: () => void;
}

export const History: React.FC<HistoryProps> = ({ items, onRestore, onClear }) => {
    if (items.length === 0) return null;

    return (
        <div className="w-full max-w-2xl mx-auto mt-20 animate-in fade-in slide-in-from-bottom-5 duration-700">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold flex items-center gap-3">
                    <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Recent Sessions
                </h3>
                <button
                    onClick={onClear}
                    className="text-sm text-muted-foreground hover:text-white transition-colors"
                >
                    Clear History
                </button>
            </div>

            <div className="space-y-3">
                {items.map((item) => (
                    <div
                        key={item.id}
                        onClick={() => onRestore(item.id)}
                        className="glass-card p-4 rounded-2xl flex items-center justify-between group cursor-pointer hover:border-primary/40 transition-all"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-white/5 text-muted-foreground group-hover:text-primary transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                </svg>
                            </div>
                            <div>
                                <div className="font-semibold group-hover:text-primary transition-colors">{item.fileName}</div>
                                <div className="text-xs text-muted-foreground">{item.date} • {item.duration}</div>
                            </div>
                        </div>
                        <button className="p-2 rounded-lg bg-white/5 opacity-0 group-hover:opacity-100 transition-all hover:bg-white/10">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};
