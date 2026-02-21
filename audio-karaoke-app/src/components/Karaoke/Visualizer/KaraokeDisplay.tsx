import React, { useRef } from 'react';
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';
import { VisualSettings } from '@/types/karaoke';
import { VisualizerCanvas } from './VisualizerCanvas';
import { useAudioReactivity } from '@/hooks/useAudioReactivity';
import { AudioVisualizer } from '@/utils/audio/audioVisualizer';

interface KaraokeDisplayProps {
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    visualSettings: VisualSettings;
    isStageMode: boolean;
    visualizer?: AudioVisualizer | null;
    children?: React.ReactNode;
}

export const KaraokeDisplay: React.FC<KaraokeDisplayProps> = ({
    canvasRef,
    visualSettings,
    isStageMode,
    visualizer,
    children
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const { energy } = useAudioReactivity(visualizer || null);
    
    // Pulse scale driven by energy
    const auraScale = useSpring(useTransform(energy, [0, 1], [0.8, 1.2]), { stiffness: 50, damping: 20 });
    const auraOpacity = useTransform(energy, [0, 1], [0.1, 0.4]);

    const innerAuraScale = useTransform(energy, [0, 1], [1, 1.5]);
    const innerAuraOpacity = useTransform(energy, [0, 1], [0.05, 0.2]);

    // Mouse tracking for premium glow
    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        containerRef.current.style.setProperty('--mouse-x', `${x}px`);
        containerRef.current.style.setProperty('--mouse-y', `${y}px`);
    };

    return (
        <motion.div
            data-testid="visualizer-container"
            ref={containerRef}
            onMouseMove={handleMouseMove}
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
            {/* Reactive Aura Background (Stage Mode only) */}
            <AnimatePresence>
                {isStageMode && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-0 pointer-events-none overflow-hidden"
                    >
                        <motion.div 
                            style={{
                                scale: auraScale,
                                opacity: auraOpacity,
                                background: 'radial-gradient(circle at 50% 50%, rgba(147, 51, 234, 0.4) 0%, transparent 70%)'
                            }}
                            className="absolute inset-[-50%] z-0"
                        />
                        <motion.div 
                            style={{
                                scale: innerAuraScale,
                                opacity: innerAuraOpacity,
                                background: 'radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.3) 0%, transparent 60%)'
                            }}
                            className="absolute inset-[-50%] z-0 mix-blend-screen"
                        />
                    </motion.div>
                )}
            </AnimatePresence>
            <VisualizerCanvas 
                canvasRef={canvasRef}
                visualSettings={visualSettings}
                isStageMode={isStageMode}
            />

            {children}
        </motion.div>
    );
};
