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
        container: 'space-y-16 py-64',
        active: 'text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] opacity-100 py-8 scale-115 z-20',
        past: 'text-white/30 blur-[3px] scale-90 translate-z-[-50px] origin-center',
        future: 'text-white/10 blur-[6px] scale-80 translate-z-[-100px] origin-center',
        gradient: 'bg-clip-text text-transparent bg-linear-to-b from-[hsl(280,80%,70%)] to-[hsl(200,90%,60%)]'
    },
    neon: {
        container: 'space-y-12 py-48',
        active: 'text-karaoke-effect opacity-100 py-6 scale-110 drop-shadow-[0_0_20px_rgba(34,211,238,0.4)]',
        past: 'text-pink-500/20 blur-[2px] scale-95 -rotate-1',
        future: 'text-cyan-500/10 blur-[4px] scale-90 rotate-1',
        gradient: 'bg-clip-text text-transparent bg-linear-to-r from-[hsl(180,100%,50%)] to-[hsl(240,100%,50%)]'
    },
    classic: {
        container: 'space-y-8 py-32',
        active: 'text-white opacity-100 py-4 scale-100 drop-shadow-lg',
        past: 'text-white/40 scale-100 [text-shadow:2px_2px_0_#000]',
        future: 'text-white/20 scale-100 [text-shadow:2px_2px_0_#000]',
        gradient: ''
    },
    retro: {
        container: 'space-y-4 py-24 font-mono',
        active: 'text-green-400 opacity-100 py-2 scale-100 drop-shadow-[0_0_10px_rgba(74,222,128,0.5)]',
        past: 'text-green-900/40 scale-100',
        future: 'text-green-900/20 scale-100',
        gradient: ''
    }
};

export const LyricDisplay: React.FC<LyricDisplayProps> = ({
    lyrics,
    currentLineIndex,
    currentWordIndex,
    theme = 'modern',
    visualSettings,
    visualizer
}) => {
    const t = useTranslations('LyricDisplay');
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

    // Ghost Mode Logic
    const { bass, energy, treble } = useAudioReactivity(visualizer || null);
    const [isMobile, setIsMobile] = React.useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);
    
    // Physics smoothing
    const smoothBass = useSpring(bass, { stiffness: 200, damping: 15 });
    const smoothEnergy = useSpring(energy, { stiffness: 100, damping: 20 });
    const smoothTreble = useSpring(treble, { stiffness: 150, damping: 15 });

    // Ghost transforms
    const ghostScale = useTransform(smoothBass, [0, 0.8], [1, 1.4]);
    const ghostOpacity = useTransform(smoothEnergy, [0, 1], [0.7, 1]);
    
    // Disable expensive blur on mobile or if autoQuality is on
    const disableBlur = isMobile || (visualSettings?.autoQuality ?? false);
    const ghostBlurVal = useTransform(smoothTreble, [0, 1], [0, disableBlur ? 0 : 4]);
    const ghostBlur = useTransform(ghostBlurVal, v => `blur(${v}px)`);
    
    const ghostWeight = useTransform(smoothBass, [0, 1], [400, 900]);
    
    const ghostXOffset = useTransform(smoothTreble, [0, 1], [0, 5]);
    const ghostScaleRed = useTransform(ghostScale, s => s * 1.05);
    const ghostScaleCyan = useTransform(ghostScale, s => s * 1.02);

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
                    const isGhostActive = isActive && visualSettings?.ghostMode;

                    return (
                        <motion.div
                            key={index}
                            ref={el => { lineRefs.current[index] = el }}
                            layout
                            initial={{ opacity: 0, y: 20, z: -100 }}
                            animate={{
                                opacity: isActive ? 1 : (isPast ? 0.3 : 0.1),
                                scale: isActive ? 1.15 : (isPast ? 0.9 : 0.8),
                                y: 0,
                                z: isActive ? 0 : (isPast ? -50 : -100),
                                filter: isActive ? 'blur(0px)' : (isPast ? 'blur(3px)' : 'blur(6px)'),
                                rotateX: isPast ? -5 : (isActive ? 0 : 5)
                            }}
                            style={{
                                scale: isGhostActive ? ghostScale : undefined,
                                opacity: isGhostActive ? ghostOpacity : undefined,
                                filter: isGhostActive ? ghostBlur : undefined,
                                fontWeight: isGhostActive ? ghostWeight : undefined,
                                perspective: '1000px',
                                transformStyle: 'preserve-3d',
                                backdropFilter: (isActive || isPast) ? 'blur(12px)' : 'none',
                                backgroundColor: (isActive || isPast) ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
                                borderRadius: '24px',
                                border: (isActive || isPast) ? '1px solid rgba(255, 255, 255, 0.05)' : 'none',
                                padding: isActive ? '2rem' : '1rem'
                            }}
                            transition={{ 
                                type: "spring", 
                                damping: 25, 
                                stiffness: 120,
                                opacity: { duration: 0.4 }
                            }}
                            className={`transition-all duration-700 ease-out text-center px-8 relative z-10 ${lineStyle}`}
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

                            {/* Chromatic Aberration Layers (Ghost Mode only) */}
                            {isGhostActive && (
                                <>
                                    <motion.div
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            right: 0,
                                            bottom: 0,
                                            color: '#ff0000',
                                            mixBlendMode: 'screen',
                                            x: useTransform(smoothTreble, [0.5, 1], [0, -4]),
                                            scale: ghostScaleRed,
                                            opacity: 0.5,
                                            pointerEvents: 'none',
                                            zIndex: -1
                                        }}
                                        className="font-black text-4xl lg:text-5xl tracking-tighter"
                                    >
                                        {line.text}
                                    </motion.div>
                                    <motion.div
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            right: 0,
                                            bottom: 0,
                                            color: '#00ffff',
                                            mixBlendMode: 'screen',
                                            x: useTransform(smoothTreble, [0.5, 1], [0, 4]),
                                            scale: ghostScaleCyan,
                                            opacity: 0.5,
                                            pointerEvents: 'none',
                                            zIndex: -1
                                        }}
                                        className="font-black text-4xl lg:text-5xl tracking-tighter"
                                    >
                                        {line.text}
                                    </motion.div>
                                </>
                            )}
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
};
