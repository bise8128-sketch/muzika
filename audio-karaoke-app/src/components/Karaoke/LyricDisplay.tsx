/**
 * Komponenta LyricDisplay
 * Prikazuje stihove i ističe trenutni red na osnovu indeksa iz workera
 */

import React, { useEffect, useRef } from 'react';
import { LRCData, VisualSettings } from '@/types/karaoke';
import { useTranslations } from 'next-intl';

export type LyricTheme = 'modern' | 'neon' | 'classic' | 'retro';

interface LyricDisplayProps {
    lyrics: LRCData | null;
    currentLineIndex: number;
    currentWordIndex: number;
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
    currentLineIndex,
    currentWordIndex,
    theme = 'modern',
    visualSettings
}) => {
    const t = useTranslations('LyricDisplay');
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

    const style = THEME_STYLES[theme];

    // Auto-scroll to active line
    useEffect(() => {
        if (currentLineIndex !== -1 && lineRefs.current[currentLineIndex]) {
            lineRefs.current[currentLineIndex]?.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }, [currentLineIndex]);

    if (!lyrics) {
        return (
            <div className="flex items-center justify-center h-full text-white/40">
                <p>{t('waitingForLyrics') || 'Waiting for lyrics...'}</p>
            </div>
        );
    }

    return (
        <div
            ref={scrollContainerRef}
            className={`h-full overflow-y-auto no-scrollbar mask-gradient transition-all duration-500 ${style.container}`}
            style={{
                fontSize: (visualSettings?.fontSize === 'lg' || visualSettings?.fontSize === 'xl') ? '1.25rem' : visualSettings?.fontSize === 'sm' ? '0.875rem' : '1rem',
                fontWeight: visualSettings?.fontWeight || 'bold'
            }}
        >
            {lyrics.lines.map((line, index) => {
                const isActive = index === currentLineIndex;
                const isPast = index < currentLineIndex;
                const lineStyle = isActive ? style.active : (isPast ? style.past : style.future);

                return (
                    <div
                        key={index}
                        ref={el => { lineRefs.current[index] = el }}
                        className={`transition-all duration-500 ease-out transform text-center px-4 ${lineStyle}`}
                    >
                        {/* Word-by-word highlighting if active */}
                        {isActive && line.words ? (
                            <p className={style.gradient}>
                                {line.words.map((word, wIndex) => {
                                    const isWordActive = wIndex === currentWordIndex;
                                    const isWordPast = wIndex < currentWordIndex;

                                    // Highlight past words and current word
                                    const wordColor = (isWordPast || isWordActive)
                                        ? (visualSettings?.highlightColor || 'text-yellow-400')
                                        : 'text-white';

                                    return (
                                        <span
                                            key={wIndex}
                                            className={`inline-block transition-colors duration-200 mr-1 ${wordColor}`}
                                        >
                                            {word.text}
                                        </span>
                                    );
                                })}
                            </p>
                        ) : (
                            <p className={isActive ? (visualSettings?.highlightColor || 'text-yellow-400') : ''}>
                                {line.text}
                            </p>
                        )}

                        {/* Dual Text (Translation/Romanization) */}
                        {visualSettings?.showDualText && line.translation && (
                            <p className="text-sm opacity-60 mt-1">{line.translation}</p>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
