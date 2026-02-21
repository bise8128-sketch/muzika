import React, { useRef } from 'react';
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';
import { VisualSettings, StageTheme } from '@/types/karaoke';
import { VisualizerCanvas } from './VisualizerCanvas';
import { useAudioReactivity } from '@/hooks/useAudioReactivity';
import { AudioVisualizer } from '@/utils/audio/audioVisualizer';

interface KaraokeDisplayProps {
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    visualSettings: VisualSettings;
    stageTheme: StageTheme;
    isStageMode: boolean;
    visualizer?: AudioVisualizer | null;
    children?: React.ReactNode;
}

export const KaraokeDisplay: React.FC<KaraokeDisplayProps> = ({
    canvasRef,
    visualSettings,
    stageTheme,
    isStageMode,
    visualizer,
    children
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const { energy, bass, treble } = useAudioReactivity(visualizer || null);
    
    // Theme-specific Backgrounds
    const renderBackground = () => {
        if (!isStageMode) return null;

        switch (stageTheme) {
            case 'neon-tokyo':
                return (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-0 pointer-events-none overflow-hidden bg-black"
                    >
                        {/* Grid */}
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_50%_50%,black_40%,transparent_100%)]" />
                        
                        {/* Magenta Aura */}
                        <motion.div 
                            style={{
                                scale: useSpring(useTransform(energy, [0, 1], [0.8, 1.4]), { stiffness: 40, damping: 10 }),
                                opacity: useTransform(energy, [0, 1], [0.2, 0.5]),
                                background: 'radial-gradient(circle at 50% 50%, rgba(225, 29, 72, 0.4) 0%, transparent 70%)'
                            }}
                            className="absolute inset-[-50%] z-0"
                        />
                        
                        {/* Cyan Aura */}
                        <motion.div 
                            style={{
                                scale: useSpring(useTransform(bass, [0, 1], [1, 1.6]), { stiffness: 30, damping: 15 }),
                                opacity: useTransform(bass, [0, 1], [0.1, 0.3]),
                                background: 'radial-gradient(circle at 50% 50%, rgba(34, 211, 238, 0.3) 0%, transparent 60%)'
                            }}
                            className="absolute inset-[-50%] z-0 mix-blend-screen"
                        />
                    </motion.div>
                );

            case 'acoustic-lounge':
                return (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-0 pointer-events-none overflow-hidden bg-[#1a0f0a]"
                    >
                        {/* Wooden Texture simulation */}
                        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')]" />
                        
                        {/* Warm Glows */}
                        <motion.div 
                            style={{
                                opacity: useTransform(energy, [0, 1], [0.3, 0.6]),
                                background: 'radial-gradient(circle at 50% 50%, rgba(217, 119, 6, 0.3) 0%, transparent 80%)'
                            }}
                            className="absolute inset-[-20%] z-0"
                        />

                        {/* Bokeh Particles */}
                        {[...Array(6)].map((_, i) => (
                            <motion.div
                                key={i}
                                animate={{
                                    y: [0, -40, 0],
                                    x: [0, 20, 0],
                                    opacity: [0.1, 0.3, 0.1],
                                }}
                                transition={{
                                    duration: 5 + i,
                                    repeat: Infinity,
                                    ease: "easeInOut",
                                }}
                                style={{
                                    left: `${15 + i * 15}%`,
                                    top: `${20 + (i % 3) * 20}%`,
                                    width: 100 + i * 20,
                                    height: 100 + i * 20,
                                    background: 'radial-gradient(circle, rgba(251, 191, 36, 0.2) 0%, transparent 70%)',
                                    borderRadius: '50%',
                                }}
                                className="absolute z-0 blur-xl"
                            />
                        ))}
                    </motion.div>
                );

            case 'grand-opera':
                return (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-0 pointer-events-none overflow-hidden bg-[#2d0000]"
                    >
                        {/* Curtain Gradients */}
                        <div className="absolute inset-0 flex">
                            <div className="w-1/2 h-full bg-linear-to-r from-red-900/80 to-transparent" />
                            <div className="w-1/2 h-full bg-linear-to-l from-red-900/80 to-transparent" />
                        </div>

                        {/* Spotlight */}
                        <motion.div 
                            style={{
                                x: useTransform(treble, [0, 1], ['-20%', '20%']),
                                opacity: useTransform(energy, [0, 1], [0.4, 0.8]),
                                background: 'radial-gradient(ellipse at 50% 0%, rgba(254, 240, 138, 0.3) 0%, transparent 60%)'
                            }}
                            className="absolute inset-0 z-0"
                        />
                        
                        {/* Floor Glow */}
                        <div className="absolute bottom-0 inset-x-0 h-1/4 bg-linear-to-t from-red-950 to-transparent opacity-50" />
                    </motion.div>
                );

            default:
                return null;
        }
    };

    return (
        <motion.div
            data-testid="visualizer-container"
            ref={containerRef}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ 
                opacity: 1, 
                y: 0,
                backgroundColor: isStageMode ? 'rgba(0, 0, 0, 1)' : 'rgba(255, 255, 255, 0.02)'
            }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={`glass-premium relative rounded-3xl overflow-hidden flex flex-col items-center justify-center p-6 md:p-8 group transition-all duration-700 ${
                isStageMode ? 'flex-1 min-h-[60vh] md:min-h-0 aspect-auto border-none shadow-[0_0_100px_rgba(0,0,0,0.5)]' : 'aspect-4/3 md:aspect-21/9'
            }`}
        >
            <AnimatePresence mode="wait">
                {renderBackground()}
            </AnimatePresence>

            <VisualizerCanvas 
                canvasRef={canvasRef}
                visualSettings={visualSettings}
                stageTheme={stageTheme}
                isStageMode={isStageMode}
            />

            {children}
        </motion.div>
    );
};
