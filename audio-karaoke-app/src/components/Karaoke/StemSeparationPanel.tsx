
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ModelInfo } from '@/types/model';
import { ProcessingProgress } from '@/types/audio';
import { Loader2, Music, Mic2, CheckCircle2, AlertCircle, Cpu } from 'lucide-react';

interface StemSeparationPanelProps {
    isOpen: boolean;
    onClose: () => void;
    progress: ProcessingProgress | null;
    modelInfo: ModelInfo | null;
    error: Error | null;
    onStart: () => void;
}

export const StemSeparationPanel: React.FC<StemSeparationPanelProps> = ({
    isOpen,
    onClose,
    progress,
    modelInfo,
    error,
    onStart
}) => {
    if (!isOpen) return null;

    const isProcessing = progress && progress.percentage < 100 && !error;
    const isComplete = progress && progress.percentage === 100;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-0 z-200 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-sm"
            >
                <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl">
                    {/* Header */}
                    <div className="p-6 border-b border-white/10 bg-gradient-to-br from-purple-500/10 to-blue-500/10">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-linear-to-r from-primary/20 to-blue-500/20 rounded-2xl border border-white/5 shadow-inner">
                                <Mic2 className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white tracking-tight">AI Vocal Removal</h3>
                                <p className="text-sm text-white/50 font-medium">Private • Offline • Precise</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-8 space-y-6">
                        {!progress && !error ? (
                            <div className="space-y-6 text-center">
                                <div className="p-6 rounded-2xl bg-white/5 border border-white/5">
                                    <Music className="w-12 h-12 text-purple-400 mx-auto mb-4 opacity-50" />
                                    <p className="text-white/80 leading-relaxed">
                                        Use the <span className="text-purple-400 font-semibold">{modelInfo?.name || 'Demucs v4'}</span> model to separate vocals from your music. 
                                        Processing happens entirely on your device.
                                    </p>
                                </div>
                                <button
                                    onClick={onStart}
                                    className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-400 hover:to-blue-500 text-white font-bold text-lg shadow-xl shadow-purple-500/20 transition-all active:scale-[0.98]"
                                >
                                    Start Separation
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Status Icon & Text */}
                                <div className="flex items-center justify-between px-2">
                                    <div className="flex items-center gap-3">
                                        {isProcessing ? (
                                            <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                                        ) : error ? (
                                            <AlertCircle className="w-5 h-5 text-red-400" />
                                        ) : (
                                            <CheckCircle2 className="w-5 h-5 text-green-400" />
                                        )}
                                        <span className="font-semibold text-white">
                                            {error ? 'Separation Failed' : isComplete ? 'Success' : progress?.phase === 'loading-model' ? 'Loading AI Model' : 'Separating Audio'}
                                        </span>
                                    </div>
                                    <span className="text-sm font-mono text-white/40">
                                        {Math.round(progress?.percentage || 0)}%
                                    </span>
                                </div>

                                {/* Progress Bar */}
                                <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                                    <motion.div
                                       className="h-full bg-gradient-to-r from-primary via-blue-400 to-primary bg-[length:200%_100%] rounded-full shadow-[0_0_15px_rgba(147,51,234,0.3)]"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progress?.percentage || 0}%` }}
                                        transition={{ duration: 0.5, ease: "easeOut" }}
                                    />
                                </div>

                                {/* Details */}
                                <div className="space-y-3 px-1">
                                    <p className="text-sm text-white/60 font-medium">
                                        {progress?.message || (error ? error.message : 'Starting process...')}
                                    </p>
                                    
                                    <div className="flex items-center gap-2 py-1 px-3 rounded-xl bg-white/5 border border-white/5 w-fit">
                                        <Cpu className="w-3.5 h-3.5 text-blue-400" />
                                        <span className="text-[10px] uppercase tracking-widest font-bold text-blue-400/80">
                                            {progress?.executionBackend || 'Detecting Hardware...'}
                                        </span>
                                    </div>
                                </div>

                                {isComplete && (
                                    <button
                                        onClick={onClose}
                                        className="w-full py-3 px-6 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold transition-all"
                                    >
                                        Enjoy Karaoke
                                    </button>
                                )}

                                {error && (
                                    <button
                                        onClick={onStart}
                                        className="w-full py-3 px-6 rounded-2xl bg-red-500/20 hover:bg-red-500/30 text-red-200 font-bold border border-red-500/20 transition-all"
                                    >
                                        Try Again
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};
