/**
 * Komponenta LyricDisplay
 * Prikazuje stihove i ističe trenutni red na osnovu vremena reprodukcije
 */

import React, { useEffect, useRef, useMemo } from 'react';
import { LRCData, VisualSettings } from '@/types/karaoke';
import { useTranslations } from 'next-intl';

export type LyricTheme = 'modern' | 'neon' | 'classic' | 'retro';

interface LyricDisplayProps {
    lyrics: LRCData | null;
    currentTime: number;
    theme?: LyricTheme;
    visualSettings?: VisualSettings;
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
        active: 'scale-110 opacity-100 py-4 text-karaoke-effect',
        past: 'text-2xl text-white/40 blur-[1px] scale-95',
        future: 'text-2xl text-white/20 blur-[2px] scale-90',
        gradient: 'text-gradient'
    },
    neon: {
        container: 'space-y-6 py-24',
        active: 'scale-105 opacity-100 py-4 text-karaoke-effect',
        past: 'text-2xl text-pink-500/30 blur-[0.5px] scale-95',
        future: 'text-2xl text-cyan-500/20 blur-[1px] scale-90',
        gradient: 'bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500'
    },
    classic: {
        container: 'space-y-4 py-20',
        active: 'scale-100 opacity-100 py-2 text-karaoke-effect',
        past: 'text-2xl text-white/60 scale-100 [text-shadow:1px_1px_0_#000]',
        future: 'text-2xl text-white/40 scale-100 [text-shadow:1px_1px_0_#000]',
        gradient: ''
    },
    retro: {
        container: 'space-y-2 py-16 font-mono',
        active: 'scale-100 opacity-100 py-1 text-karaoke-effect',
        past: 'text-xl text-green-900 scale-100',
        future: 'text-xl text-green-900/40 scale-100',
        gradient: ''
    }
};

export const LyricDisplay: React.FC<LyricDisplayProps> = ({ 
    lyrics, 
    currentTime, 
    theme = 'modern',
    visualSettings
}) => {
    const t = useTranslations('LyricDisplay');
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

    const style = THEME_STYLES[theme];

    // Calculate effective time with offset
    const effectiveTime = useMemo(() => {
        return currentTime + ((visualSettings?.offset || 0) / 1000);
    }, [currentTime, visualSettings?.offset]);

    const currentTiming = useMemo(() => {
        if (!lyrics) return { lineIndex: -1, wordIndex: -1 };

        const lineIndex = lyrics.lines.findIndex(
            (line, index) => {
                const nextLine = lyrics.lines[index + 1];
                return effectiveTime >= line.startTime && (nextLine ? effectiveTime < nextLine.startTime : true);
            }
        );

        if (lineIndex === -1) return { lineIndex: -1, wordIndex: -1 };

        const activeLine = lyrics.lines[lineIndex];
        let wordIndex = -1;

        if (activeLine.words && activeLine.words.length > 0) {
            wordIndex = activeLine.words.findIndex(
                (word, index) => {
                    const nextWord = activeLine.words![index + 1];
                    return effectiveTime >= word.startTime && (nextWord ? effectiveTime < nextWord.startTime : true);
                }
            );
            // Keep the last word highlighted if we passed the start time of the last word but haven't moved to next line
            if (wordIndex === -1 && effectiveTime > activeLine.words[activeLine.words.length - 1].startTime) {
                wordIndex = activeLine.words.length - 1;
            }
        }

        return { lineIndex, wordIndex };
    }, [lyrics, effectiveTime]);

    const currentLineIndex = currentTiming.lineIndex;
    const currentWordIndex = currentTiming.wordIndex;

    // Helper to get font size class
    const getFontSizeClass = (size?: string, isActive: boolean = false) => {
        if (!isActive) return '';
        switch (size) {
            case 'sm': return 'text-xl md:text-2xl';
            case 'lg': return 'text-4xl md:text-5xl';
            case 'xl': return 'text-5xl md:text-7xl';
            case 'base':
            default: return 'text-3xl md:text-4xl';
        }
    };

    // Helper to get font weight class
    const getFontWeightClass = (weight?: string) => {
        switch (weight) {
            case 'normal': return 'font-normal';
            case 'extrabold': return 'font-extrabold';
            case 'bold':
            default: return 'font-bold';
        }
    };

    // Easing function for smooth scroll (easeOutExpo)
    const easeOutExpo = (t: number) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);

    const scrollToActiveLine = (lineElement: HTMLDivElement | null) => {
        const container = scrollContainerRef.current;
        if (!lineElement || !container) return;

        const containerHeight = container.clientHeight;
        const lineTop = lineElement.offsetTop;
        const lineHeight = lineElement.offsetHeight;

        // Target: Center the line then shift up to be at ~1/3 of view
        const targetScrollTop = lineTop - (containerHeight / 3) + (lineHeight / 2);

        const startScrollTop = container.scrollTop;
        const distance = targetScrollTop - startScrollTop;

        if (Math.abs(distance) < 5) {
            container.scrollTop = targetScrollTop;
            return;
        }

        const duration = 100; // 100ms transition
        let startTime: number | null = null;

        const step = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const progress = Math.min(1, elapsed / duration);
            const easedProgress = easeOutExpo(progress);

            container.scrollTop = startScrollTop + distance * easedProgress;

            if (progress < 1) {
                requestAnimationFrame(step);
            }
        };

        requestAnimationFrame(step);
    };

    useEffect(() => {
        if (currentLineIndex !== -1 && lineRefs.current[currentLineIndex]) {
            scrollToActiveLine(lineRefs.current[currentLineIndex]);
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
                <p className="font-medium text-lg text-white">{t('noLyrics')}</p>
                <p className="text-sm opacity-60">{t('uploadHint')}</p>
            </div>
        );
    }

    return (
        <div className={`relative w-full h-[400px] rounded-3xl overflow-hidden shadow-2xl bg-black/50`}>
            {/* Thematic Background Layer: Blurred and Animated Gradient */}
            <div className="absolute inset-0 bg-animated-gradient backdrop-blur-3xl z-0 opacity-70" />

            {/* Lyric Content Layer */}
            <div
                ref={scrollContainerRef}
                className={`absolute inset-0 overflow-y-auto px-8 no-scrollbar z-10 ${style.container} font-karaoke-display`}
                style={{
                    maskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)',
                    WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)'
                }}
            >
                {lyrics.lines.map((line, index) => {
                    const isActive = index === currentLineIndex;
                    const isPast = index < currentLineIndex;
                    const isFuture = index > currentLineIndex;

                    // Dynamic styles based on visual settings
                    const fontSizeClass = isActive ? getFontSizeClass(visualSettings?.fontSize, true) : '';
                    const fontWeightClass = isActive ? getFontWeightClass(visualSettings?.fontWeight) : '';
                    const shadowStyle = isActive && visualSettings?.textShadow ? { textShadow: '2px 2px 4px rgba(0,0,0,0.8)' } : {};
                    const colorClass = isActive && visualSettings?.highlightColor ? visualSettings.highlightColor : '';

                    return (
                        <div
                            key={index}
                            ref={(el) => { lineRefs.current[index] = el; }}
                            className={`text-center transition-all duration-500 ease-out transform
                            ${isActive ? `${style.active} ${fontSizeClass} ${fontWeightClass} ${colorClass}` : ''}
                            ${isPast ? style.past : ''}
                            ${isFuture ? style.future : ''}
                        `}
                            style={shadowStyle}
                        >
                            {isActive && line.words && line.words.length > 0 ? (
                                <div className="inline-flex flex-wrap justify-center gap-x-[0.25em]">
                                    {line.words.map((word, wIndex) => {
                                        const isWordActive = wIndex === currentWordIndex;
                                        const isWordPast = wIndex < currentWordIndex;

                                        return (
                                            <span
                                                key={wIndex}
                                                className={`transition-all duration-100 inline-block ${
                                                    isWordActive || isWordPast ? (colorClass || style.gradient) : 'opacity-70'
                                                } ${isWordActive ? 'scale-110 origin-bottom' : ''}`}
                                            >
                                                {word.text}
                                            </span>
                                        );
                                    })}
                                </div>
                            ) : (
                                <span className={isActive ? (colorClass || style.gradient) : ''}>
                                    {line.text}
                                </span>
                            )}
                            
                            {/* Dual Text Rendering */}
                            {visualSettings?.showDualText && line.translation && (
                                <div className={`mt-2 text-lg md:text-xl opacity-80 ${isActive ? 'text-white' : 'text-white/40'}`}>
                                    {line.translation}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
