import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SyncProgress } from '@/utils/ml/lyricSync';

interface WhisperProgressIndicatorProps {
    progress: SyncProgress | null;
    isProcessing: boolean;
}

export const WhisperProgressIndicator: React.FC<WhisperProgressIndicatorProps> = ({ progress, isProcessing }) => {
    if (!isProcessing && !progress) return null;

    const percentage = progress?.progress ?? 0;
    const stage = progress?.stage ?? 'loading-model';
    const message = progress?.message ?? 'Initializing...';

    // Premium gradient based on stage
    const bgGradient = stage === 'error' 
        ? 'from-red-500 to-rose-600'
        : stage === 'done'
            ? 'from-emerald-400 to-teal-500'
            : 'from-purple-500 to-blue-500';

    return (
        <AnimatePresence>
            {(isProcessing || stage === 'done') && (
                <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    className="w-full bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-2xl overflow-hidden relative"
                >
                    {/* Background glow */}
                    <div className={`absolute inset-0 bg-gradient-to-r ${bgGradient} opacity-10 blur-xl`} />

                    <div className="relative z-10 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {/* Spinning icon depending on stage */}
                                <div className="relative w-8 h-8 flex items-center justify-center">
                                    {stage === 'error' ? (
                                        <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    ) : stage === 'done' ? (
                                        <motion.svg 
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className="w-6 h-6 text-emerald-400" 
                                            fill="none" 
                                            viewBox="0 0 24 24" 
                                            stroke="currentColor"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </motion.svg>
                                    ) : (
                                        <motion.div
                                            animate={{ rotate: 360 }}
                                            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                                            className="absolute inset-0 border-2 border-t-purple-400 border-white/10 rounded-full"
                                        />
                                    )}
                                </div>
                                
                                <div>
                                    <h3 className="text-white font-bold tracking-wide">AI Auto-Sync</h3>
                                    <p className="text-white/60 text-sm font-medium">{message}</p>
                                </div>
                            </div>
                            
                            <div className="text-right">
                                <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">
                                    {Math.round(percentage * 100)}%
                                </span>
                            </div>
                        </div>

                        {/* Progress Bar Container */}
                        <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-white/5 relative">
                            {/* Animated pattern over the filled part */}
                            <motion.div
                                className={`h-full bg-gradient-to-r ${bgGradient} rounded-full relative overflow-hidden`}
                                initial={{ width: "0%" }}
                                animate={{ width: `${percentage * 100}%` }}
                                transition={{ ease: "easeOut", duration: 0.3 }}
                            >
                                {isProcessing && stage !== 'done' && (
                                    <motion.div 
                                        animate={{ x: ['-100%', '200%'] }}
                                        transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                                        className="absolute top-0 bottom-0 w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-[-20deg]"
                                    />
                                )}
                            </motion.div>
                        </div>
                        
                        {/* Subtext info */}
                        {stage === 'loading-model' && (
                            <p className="text-xs text-white/40 text-center uppercase tracking-wider">
                                Downloading Whisper Tiny Model (Browser-side)
                            </p>
                        )}
                        {stage === 'transcribing' && (
                            <p className="text-xs text-white/40 text-center uppercase tracking-wider">
                                High-performance WebGPU/WASM Inference
                            </p>
                        )}
                        {stage === 'aligning' && (
                            <p className="text-xs text-white/40 text-center uppercase tracking-wider">
                                Dynamic Time Warping Alignment
                            </p>
                        )}

                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
