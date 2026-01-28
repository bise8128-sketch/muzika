/**
 * LyricDisplay Component
 * Renders lyrics and highlights the current line based on playback time
 */

import React, { useEffect, useRef, useMemo } from 'react';
import { LRCData } from '@/types/karaoke';

interface LyricDisplayProps {
    lyrics: LRCData | null;
    currentTime: number;
}

export const LyricDisplay: React.FC<LyricDisplayProps> = ({ lyrics, currentTime }) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

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
                <p className="text-sm opacity-60">Upload an .lrc file to start singing</p>
            </div>
        );
    }

    return (
        <div
            ref={scrollContainerRef}
            className="h-[400px] overflow-y-auto px-8 py-32 space-y-8 no-scrollbar"
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
                            ${isActive
                                ? 'text-4xl md:text-5xl text-white scale-100 opacity-100 py-4 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]'
                                : isPast
                                    ? 'text-2xl text-white/40 blur-[1px] scale-95'
                                    : 'text-2xl text-white/20 blur-[2px] scale-90'
                            }
                        `}
                    >
                        <span className={isActive ? 'text-gradient' : ''}>
                            {line.text || '♪'}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};
