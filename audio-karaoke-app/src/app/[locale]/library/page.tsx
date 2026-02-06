'use client';

import React from 'react';
import { useRouter } from '@/i18n/routing';
import { LibraryGrid } from '@/components/Library/LibraryGrid';

export default function LibraryPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen selection:bg-primary/30 flex flex-col">
            <nav className="sticky top-0 z-40 glass border-b border-white/5 h-20 shrink-0">
                <div className="container mx-auto px-6 h-full flex items-center justify-between">
                    <button
                        type="button"
                        className="flex items-center gap-3 group focus-ring rounded-xl p-1"
                        onClick={() => router.push('/')}
                        aria-label="Go to home"
                    >
                        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                            </svg>
                        </div>
                        <span className="text-2xl font-black tracking-tighter">MUZIKA</span>
                    </button>
                    <button
                        onClick={() => router.push('/')}
                        className="text-sm font-medium text-muted-foreground hover:text-white transition-colors focus-ring rounded-lg px-2 py-1"
                    >
                        Back to Studio
                    </button>
                </div>
            </nav>

            <main className="container mx-auto px-6 py-12 md:py-20 flex-1">
                <h1 className="text-4xl font-bold mb-8">Song Library</h1>
                <LibraryGrid />
            </main>
        </div>
    );
}
