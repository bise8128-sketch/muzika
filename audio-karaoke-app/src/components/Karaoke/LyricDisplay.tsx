/**
 * LyricDisplay Component
 * Renders lyrics and highlights the current line based on playback time
 */

import React, { useEffect, useRef, useMemo } from 'react';
import { LRCData, LyricLine } from '@/types/karaoke';

interface LyricDisplayProps {
    lyrics: LRCData | null;
    currentTime: number;
}

export const LyricDisplay: React.FC<LyricDisplayProps> = ({ lyrics, currentTime }) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

    const currentLineIndex = useMemo(() => {
        if (!lyrics) return -1;
        // Find the line where currentTime is between startTime and endTime
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
            <div className="flex flex-col items-center justify-center h-64 text-gray-500 bg-white/5 rounded-2xl border border-dashed border-white/10">
                <svg className="w-12 h-12 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                <p>No lyrics available</p>
                <p className="text-sm">Upload an .lrc file to see synchronized lyrics</p>
            </div>
        );
    }

    return (
        <div
            ref={scrollContainerRef}
            className="h-[400px] overflow-y-auto px-8 py-32 space-y-8 scrollbar-hide mask-fade"
        >
            <style jsx>{`
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                .mask-fade {
                    mask-image: linear-gradient(to bottom, transparent, black 20%, black 80%, transparent);
                }
            `}</style>

            {lyrics.lines.map((line, index) => {
                const isActive = index === currentLineIndex;
                const isPast = index < currentLineIndex;

                return (
                    <div
                        key={`${line.startTime}-${index}`}
                        ref={(el) => { lineRefs.current[index] = el; }}
                        className={`text-center transition-all duration-500 transform ${isActive
                            ? 'text-3xl font-bold text-white scale-110 opacity-100'
                            : isPast
                                ? 'text-xl text-gray-500 opacity-60 scale-95'
                                : 'text-xl text-gray-400 opacity-40 scale-90'
                            }`}
                    >
                        {line.text || '♪'}
                    </div>
                );
            })}
        </div>
    );
};
