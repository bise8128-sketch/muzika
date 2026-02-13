import React from 'react';
import { motion, useTransform, useSpring } from 'framer-motion';
import { AudioVisualizer } from '@/utils/audio/audioVisualizer';
import { useAudioReactivity } from '@/hooks/useAudioReactivity';

interface GhostModeProps {
    text: string;
    isActive: boolean;
    visualizer: AudioVisualizer | null;
}

/**
 * Ghost Mode Prototype
 * 
 * Demonstrates high-performance audio-reactive typography using:
 * 1. Direct MotionValue updates from AudioVisualizer (bypassing React render cycle)
 * 2. Hardware accelerated CSS transforms (scale, opacity, filter)
 * 3. Spring physics for organic smoothing of audio transients
 */
export const GhostModePrototype: React.FC<GhostModeProps> = ({ text, isActive, visualizer }) => {
    // 1. Hook into the audio analysis stream
    const { bass, energy, treble } = useAudioReactivity(visualizer);

    // 2. Apply physics smoothing to raw audio data to prevent jitter
    // Stiffness/damping tuned for "punchy" but smooth response
    const smoothBass = useSpring(bass, { stiffness: 200, damping: 15 });
    const smoothEnergy = useSpring(energy, { stiffness: 100, damping: 20 });
    const smoothTreble = useSpring(treble, { stiffness: 150, damping: 15 });

    // 3. Map audio features to visual properties
    
    // Scale responds to Bass (Kick drum)
    // Range: 1.0 -> 1.4
    const scale = useTransform(smoothBass, [0, 0.8], [1, 1.4]);
    
    // Opacity responds to overall Energy
    // Range: 0.6 -> 1.0
    const opacity = useTransform(smoothEnergy, [0, 1], [0.6, 1]);
    
    // Chromatic Aberration / Offset responds to Treble (Hi-hats/Sibilance)
    const xOffset = useTransform(smoothTreble, [0, 1], [0, 5]);
    const yOffset = useTransform(smoothTreble, [0, 1], [0, -5]);
    
    // Variable Font Weight (if supported) or just opacity
    // Using numeric weights for variable fonts
    const weight = useTransform(smoothBass, [0, 1], [400, 900]);

    // Derived values for ghost layers
    const ghostScaleRed = useTransform(scale, s => s * 1.05);
    const ghostOpacity = useTransform(opacity, o => o * 0.4);
    const ghostScaleCyan = useTransform(scale, s => s * 1.02);
    const ghostOffsetInv = useTransform(xOffset, x => x * -1);

    return (
        <div className="relative flex justify-center items-center py-8 overflow-visible">
            {/* Primary Text Layer */}
            <motion.h1
                style={{
                    scale: isActive ? scale : 1,
                    opacity: isActive ? opacity : 0.3,
                    fontWeight: isActive ? weight : 400,
                    // Hardware accelerated filter
                    filter: isActive ? 'blur(0px)' : 'blur(4px)',
                }}
                className="text-7xl md:text-8xl font-black text-white relative z-20 tracking-tighter text-center transition-colors duration-300"
            >
                {text}
            </motion.h1>

            {/* "Ghost" Echo Layer - Red Channel Shift */}
            {isActive && (
                <motion.h1
                    style={{
                        scale: ghostScaleRed,
                        opacity: ghostOpacity,
                        x: xOffset,
                    }}
                    className="absolute text-7xl md:text-8xl font-black text-red-500 mix-blend-screen blur-[2px] select-none pointer-events-none z-10"
                    aria-hidden="true"
                >
                    {text}
                </motion.h1>
            )}

            {/* "Ghost" Echo Layer - Cyan Channel Shift */}
            {isActive && (
                <motion.h1
                    style={{
                        scale: ghostScaleCyan,
                        opacity: ghostOpacity,
                        x: ghostOffsetInv, // Opposite shift
                    }}
                    className="absolute text-7xl md:text-8xl font-black text-cyan-500 mix-blend-screen blur-[1px] select-none pointer-events-none z-10"
                    aria-hidden="true"
                >
                    {text}
                </motion.h1>
            )}
        </div>
    );
};
