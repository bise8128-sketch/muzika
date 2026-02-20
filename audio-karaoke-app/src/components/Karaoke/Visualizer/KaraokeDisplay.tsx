import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { VisualSettings } from '@/types/karaoke';
import { VisualizerCanvas } from './VisualizerCanvas';

interface KaraokeDisplayProps {
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    visualSettings: VisualSettings;
    isStageMode: boolean;
    children?: React.ReactNode;
}

export const KaraokeDisplay: React.FC<KaraokeDisplayProps> = ({
    canvasRef,
    visualSettings,
    isStageMode,
    children
}) => {
    const containerRef = useRef<HTMLDivElement>(null);

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
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={`glass-premium relative rounded-3xl overflow-hidden flex flex-col items-center justify-center p-6 md:p-8 group transition-all duration-700 ${
                isStageMode ? 'flex-1 min-h-[60vh] md:min-h-0 aspect-auto border-none bg-black' : 'aspect-4/3 md:aspect-21/9'
            }`}
        >
            <VisualizerCanvas 
                canvasRef={canvasRef}
                visualSettings={visualSettings}
                isStageMode={isStageMode}
            />

            {children}
        </motion.div>
    );
};
