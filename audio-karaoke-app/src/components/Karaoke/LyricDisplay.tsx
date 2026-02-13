/**
 * Komponenta LyricDisplay
 * Prikazuje stihove i ističe trenutni red na osnovu indeksa iz workera
 */

import React, { useEffect, useRef } from 'react';
import { LRCData, VisualSettings } from '@/types/karaoke';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence, useTransform, useSpring } from 'framer-motion';
import { AudioVisualizer } from '@/utils/audio/audioVisualizer';
import { useAudioReactivity } from '@/hooks/useAudioReactivity';

export type LyricTheme = 'modern' | 'neon' | 'classic' | 'retro';

interface LyricDisplayProps {
    lyrics: LRCData | null;
    currentLineIndex: number;
    currentWordIndex: number;
    theme?: LyricTheme;
    visualSettings?: VisualSettings;
    visualizer?: AudioVisualizer | null;
}

const THEME_STYLES: Record<LyricTheme, {
    container: string;
    active: string;
    past: string;
    future: string;
    gradient: string;
}> = {
    modern: {
        container: 'space-y-12 py-48',
        active: 'text-karaoke-effect opacity-100 py-6 scale-110',
        past: 'text-3xl text-white/20 blur-[2px] scale-95 origin-center',
        future: 'text-3xl text-white/10 blur-[4px] scale-90 origin-center',
        gradient: 'text-gradient'
    },
    neon: {
        container: 'space-y-10 py-40',
        active: 'text-karaoke-effect opacity-100 py-6 scale-105',
        past: 'text-3xl text-pink-500/10 blur-[1px] scale-95',
        future: 'text-3xl text-cyan-500/10 blur-[2px] scale-90',
        gradient: 'bg-clip-text text-transparent bg-linear-to-r from-cyan-400 to-blue-500'
    },
    classic: {
        container: 'space-y-6 py-32',
        active: 'text-karaoke-effect opacity-100 py-4 scale-100',
        past: 'text-3xl text-white/40 scale-100 [text-shadow:2px_2px_0_#000]',
        future: 'text-3xl text-white/20 scale-100 [text-shadow:2px_2px_0_#000]',
        gradient: ''
    },
    retro: {
        container: 'space-y-4 py-24 font-mono',
        active: 'text-karaoke-effect opacity-100 py-2 scale-100',
        past: 'text-2xl text-green-900/40 scale-100',
        future: 'text-2xl text-green-900/20 scale-100',
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
        if (currentLineIndex !== -1 && lineRefs.current[currentLineIndex] && scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            const target = lineRefs.current[currentLineIndex]!;
            const offset = target.offsetTop - container.clientHeight / 2 + target.clientHeight / 2;
            
            container.scrollTo({
                top: offset,
                behavior: 'smooth'
            });
        }
    }, [currentLineIndex]);

    if (!lyrics) {
        return (
            <div className="flex items-center justify-center h-full text-white/20">
                <p className="font-black uppercase tracking-[0.5em] text-xs">{t('waitingForLyrics') || 'Awaiting Data Signal...'}</p>
            </div>
        );
    }

    return (
        <div
            ref={scrollContainerRef}
            className={`h-full overflow-y-auto no-scrollbar mask-gradient relative ${style.container}`}
            style={{
                fontSize: (visualSettings?.fontSize === 'lg' || visualSettings?.fontSize === 'xl') ? '1.5rem' : visualSettings?.fontSize === 'sm' ? '1rem' : '1.25rem',
                fontWeight: visualSettings?.fontWeight || '900'
            }}
        >
            <AnimatePresence mode="popLayout">
                {lyrics.lines.map((line, index) => {
                    const isActive = index === currentLineIndex;
                    const isPast = index < currentLineIndex;
                    const lineStyle = isActive ? style.active : (isPast ? style.past : style.future);

                    return (
                        <motion.div
                            key={index}
                            ref={el => { lineRefs.current[index] = el }}
                            layout
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ 
                                opacity: isActive ? 1 : (isPast ? 0.3 : 0.1), 
                                scale: isActive ? 1.1 : (isPast ? 0.95 : 0.9),
                                y: 0,
                                filter: isActive ? 'blur(0px)' : (isPast ? 'blur(2px)' : 'blur(4px)')
                            }}
                            transition={{ type: "spring", damping: 20, stiffness: 100 }}
                            className={`transition-all duration-500 ease-out text-center px-8 relative z-10 ${lineStyle}`}
                        >
                            {/* Word-by-word highlighting if active */}
                            {isActive && line.words ? (
                                <p className={`leading-relaxed italic ${style.gradient} drop-shadow-2xl`}>
                                    {line.words.map((word, wIndex) => {
                                        const isWordActive = wIndex === currentWordIndex;
                                        const isWordPast = wIndex < currentWordIndex;

                                        // Highlight past words and current word
                                        const wordColor = (isWordPast || isWordActive)
                                            ? (visualSettings?.highlightColor || 'text-yellow-400')
                                            : 'text-white/60';

                                        return (
                                            <motion.span
                                                key={wIndex}
                                                animate={{ 
                                                    scale: isWordActive ? 1.1 : 1,
                                                    color: (isWordPast || isWordActive) ? '#facc15' : '#ffffff66'
                                                }}
                                                className={`inline-block mr-2 text-4xl lg:text-5xl font-black tracking-tighter`}
                                            >
                                                {word.text}
                                            </motion.span>
                                        );
                                    })}
                                </p>
                            ) : (
                                <p className={`text-4xl lg:text-5xl font-black tracking-tighter ${isActive ? (visualSettings?.highlightColor || 'text-yellow-400 opacity-100') : 'opacity-20'}`}>
                                    {line.text}
                                </p>
                            )}

                            {/* Dual Text (Translation/Romanization) */}
                            {visualSettings?.showDualText && line.translation && (
                                <motion.p 
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: isActive ? 0.6 : 0.2 }}
                                    className="text-lg font-bold opacity-60 mt-4 tracking-tight"
                                >
                                    {line.translation}
                                </motion.p>
                            )}
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
};
