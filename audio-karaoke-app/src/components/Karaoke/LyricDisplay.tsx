/**
 * LyricDisplay Component
 * Renders lyrics and highlights the current line based on playback time
 */

import React, { useEffect, useRef, useMemo } from 'react';
import { LRCData } from '@/types/karaoke';

export type LyricTheme = 'modern' | 'neon' | 'classic' | 'retro';

interface LyricDisplayProps {
    lyrics: LRCData | null;
    currentTime: number;
    theme?: LyricTheme;
}

const THEME_STYLES: Record<LyricTheme, {
    container: string;
    active: string;
    past: string;
    future: string;
    gradient: string;
}> = {
    modern: {
        container: 'space-y-8 py-32',
        active: 'text-4xl md:text-5xl text-white scale-100 opacity-100 py-4 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]',
        past: 'text-2xl text-white/40 blur-[1px] scale-95',
        future: 'text-2xl text-white/20 blur-[2px] scale-90',
        gradient: 'text-gradient'
    },
    neon: {
        container: 'space-y-6 py-24',
        active: 'text-4xl md:text-5xl text-cyan-400 scale-105 opacity-100 py-4 drop-shadow-[0_0_20px_rgba(34,211,238,0.8)] [text-shadow:0_0_10px_#22d3ee]',
        past: 'text-2xl text-pink-500/30 blur-[0.5px] scale-95',
        future: 'text-2xl text-cyan-500/20 blur-[1px] scale-90',
        gradient: 'bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500'
    },
    classic: {
        container: 'space-y-4 py-20',
        active: 'text-3xl md:text-4xl text-yellow-400 scale-100 opacity-100 py-2 [text-shadow:2px_2px_0_#000]',
        past: 'text-2xl text-white/60 scale-100 [text-shadow:1px_1px_0_#000]',
        future: 'text-2xl text-white/40 scale-100 [text-shadow:1px_1px_0_#000]',
        gradient: ''
    },
    retro: {
        container: 'space-y-2 py-16 font-mono',
        active: 'text-3xl text-green-500 scale-100 opacity-100 py-1 [text-shadow:0_0_5px_#22c55e]',
        past: 'text-xl text-green-900 scale-100',
        future: 'text-xl text-green-900/40 scale-100',
        gradient: ''
    }
};

export const LyricDisplay: React.FC<LyricDisplayProps> = ({ lyrics, currentTime, theme = 'modern' }) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

    const style = THEME_STYLES[theme];

    const currentLineIndex = useMemo(() => {
        if (!lyrics) return -1;
        return lyrics.lines.findIndex(
            (line, index) => {
                const nextLine = lyrics.lines[index + 1];
                return currentTime >= line.startTime && (nextLine ? currentTime < nextLine.startTime : true);
            }
        );
    }, [lyrics, currentTime]);

    useEffect(() => {
        if (currentLineIndex !== -1 && lineRefs.current[currentLineIndex]) {
            lineRefs.current[currentLineIndex]?.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });
        }
    }, [currentLineIndex]);

    if (!lyrics) {
        return (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-muted-foreground bg-white/5 rounded-3xl border-2 border-dashed border-white/10 group hover:border-primary/30 transition-colors">
                <div className="p-4 rounded-full bg-white/5 mb-4 group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                </div>
                <p className="font-medium text-lg text-white">No lyrics loaded</p>
                <p className="text-sm opacity-60">Upload an .lrc file or create some above</p>
            </div>
        );
    }

    return (
        <div
            ref={scrollContainerRef}
            className={`h-[400px] overflow-y-auto px-8 no-scrollbar ${style.container}`}
            style={{
                maskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)',
                WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)'
            }}
        >
            {lyrics.lines.map((line, index) => {
                const isActive = index === currentLineIndex;
                const isPast = index < currentLineIndex;

                return (
                    <div
                        key={`${line.startTime}-${index}`}
                        ref={(el) => { lineRefs.current[index] = el; }}
                        className={`
                            text-center transition-all duration-500 ease-out font-bold tracking-tight
                            ${isActive ? style.active : isPast ? style.past : style.future}
                        `}
                    >
                        <span className={isActive ? style.gradient : ''}>
                            {line.text || '♪'}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};
