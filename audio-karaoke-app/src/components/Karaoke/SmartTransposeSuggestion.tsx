'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { KeyInfo } from '@/utils/audio/keyDetection';
import { VOCAL_RANGES, VocalRangeType } from '@/utils/audio/vocalRange';

interface SmartTransposeSuggestionProps {
    detectedKey: KeyInfo | null;
    vocalRange: VocalRangeType;
    suggestedShift: number | null;
    onApply: () => void;
}

/**
 * SmartTransposeSuggestion — A premium, non-intrusive suggestion badge.
 * 
 * Appears when a musical key is detected that might be out of 
 * the user's comfortable vocal range.
 */
export const SmartTransposeSuggestion: React.FC<SmartTransposeSuggestionProps> = ({
    detectedKey,
    vocalRange,
    suggestedShift,
    onApply
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [hasBeenDismissed, setHasBeenDismissed] = useState(false);

    useEffect(() => {
        // Show if we have a significant recommendation and haven't dismissed it yet
        if (detectedKey && suggestedShift !== null && suggestedShift !== 0 && !hasBeenDismissed) {
            const timer = setTimeout(() => setIsVisible(true), 1500); // Delay for dramatic effect
            return () => clearTimeout(timer);
        } else {
            // Use requestAnimationFrame to avoid synchronous setState warning
            requestAnimationFrame(() => setIsVisible(false));
        }
    }, [detectedKey, suggestedShift, hasBeenDismissed]);

    const handleApply = () => {
        onApply();
        setIsVisible(false);
        setHasBeenDismissed(true);
    };

    const rangeName = VOCAL_RANGES[vocalRange]?.name || vocalRange;

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                    className="absolute bottom-28 left-1/2 -translate-x-1/2 z-50"
                >
                    <div className="glass-premium flex items-center gap-4 px-5 py-3 rounded-2xl border border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.15)] max-w-sm">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400 mb-0.5">
                                Pro Suggestion
                            </span>
                            <p className="text-sm text-white/80 leading-tight">
                                This song is in <span className="text-white font-bold">{detectedKey?.tonic} {detectedKey?.scale}</span>. 
                                Shift <span className="text-cyan-400 font-bold">{suggestedShift! > 0 ? `+${suggestedShift}` : suggestedShift}</span> semitones for your <span className="font-bold">{rangeName}</span> range?
                            </p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleApply}
                                className="bg-cyan-500 hover:bg-cyan-400 text-black px-4 py-2 rounded-xl text-xs font-black transition-all active:scale-95 shadow-lg shadow-cyan-500/20"
                            >
                                APPLY
                            </button>
                            <button
                                onClick={() => {
                                    setIsVisible(false);
                                    setHasBeenDismissed(true);
                                }}
                                className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
