import { useEffect } from 'react';
import { useMotionValue, MotionValue } from 'framer-motion';
import { AudioVisualizer } from '@/utils/audio/audioVisualizer';

export interface AudioMetrics {
    bass: MotionValue<number>;
    mid: MotionValue<number>;
    treble: MotionValue<number>;
    energy: MotionValue<number>;
}

export const useAudioReactivity = (visualizer: AudioVisualizer | null): AudioMetrics => {
    const bass = useMotionValue(0);
    const mid = useMotionValue(0);
    const treble = useMotionValue(0);
    const energy = useMotionValue(0);

    useEffect(() => {
        if (!visualizer) return;

        // Subscribe to visualizer frame events
        // This runs in the animation loop ~60fps
        visualizer.onFrame = (metrics) => {
            // Update MotionValues directly
            // This bypasses React render cycle
            bass.set(metrics.bass);
            mid.set(metrics.mid);
            treble.set(metrics.treble);
            energy.set(metrics.energy);
        };

        return () => {
            // Cleanup subscription
            if (visualizer.onFrame) {
                visualizer.onFrame = undefined;
            }
        };
    }, [visualizer, bass, mid, treble, energy]);

    return { bass, mid, treble, energy };
};
