import React from 'react';
import { SyncProgress, SyncResult } from '@/utils/ml/lyricSync';
import { motion, AnimatePresence } from 'framer-motion';

interface LyricSyncPanelProps {
    isProcessing: boolean;
    progress: SyncProgress | null;
    result: SyncResult | null;
    error: string | null;
    onStartSync: () => void;
    onCancel: () => void;
    onReset: () => void;
    onClose: () => void;
    hasLyrics: boolean;
}

export const LyricSyncPanel: React.FC<LyricSyncPanelProps> = ({
    isProcessing,
    progress,
    result,
    error,
    onStartSync,
    onCancel,
    onReset,
    onClose,
    hasLyrics
}) => {
    return (
        <div className="bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl p-6 w-80 text-white shadow-2xl">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold bg-linear-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                    AI Lyric Sync
                </h3>
                <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="space-y-6">
                {!isProcessing && !result && !error && (
                    <div className="space-y-4">
                        <p className="text-sm text-white/60 leading-relaxed">
                            Automatically align lyrics with the audio using AI. This works best when you have raw lyric text without timestamps.
                        </p>
                        
                        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
                            <h4 className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-1">AI Model</h4>
                            <p className="text-[10px] text-white/40">Whisper Tiny (English) - ~40MB Download</p>
                        </div>

                        <button
                            onClick={onStartSync}
                            disabled={!hasLyrics}
                            className={`w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                                !hasLyrics
                                    ? 'bg-white/5 text-white/20 cursor-not-allowed'
                                    : 'bg-linear-to-r from-purple-500 to-pink-600 text-white shadow-lg shadow-purple-900/40 hover:scale-[1.02] active:scale-[0.98]'
                            }`}
                        >
                            <span>✨</span>
                            {hasLyrics ? 'Start AI Alignment' : 'Upload Lyrics First'}
                        </button>
                    </div>
                )}

                {isProcessing && progress && (
                    <div className="space-y-4 py-4">
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-purple-400 font-bold uppercase tracking-wider">{progress.stage}</span>
                            <span className="text-white/40">{Math.round(progress.progress * 100)}%</span>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                            <motion.div 
                                className="h-full bg-linear-to-r from-purple-500 to-pink-500"
                                initial={{ width: 0 }}
                                animate={{ width: `${progress.progress * 100}%` }}
                                transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
                            />
                        </div>
                        <p className="text-center text-sm text-white/60 italic">
                            {progress.message}
                        </p>
                        <button 
                            onClick={onCancel}
                            className="w-full py-2 text-xs text-white/40 hover:text-white/80 transition-colors"
                        >
                            Cancel AI Sync
                        </button>
                    </div>
                )}

                {result && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-500">
                        <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-4 text-center">
                            <div className="text-2xl mb-1">🎯</div>
                            <h4 className="text-green-400 font-bold">Alignment Successful!</h4>
                            <p className="text-[10px] text-green-400/60 mt-1">
                                Confidence Score: {Math.round(result.confidence * 100)}%
                            </p>
                        </div>
                        <button
                            onClick={onReset}
                            className="w-full py-3 bg-white/5 hover:bg-white/10 text-white/80 rounded-xl text-sm font-bold transition-all"
                        >
                            Sync Another File
                        </button>
                    </div>
                )}

                {error && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-500">
                        <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 text-center">
                            <div className="text-2xl mb-1">⚠️</div>
                            <h4 className="text-red-400 font-bold">Sync Failed</h4>
                            <p className="text-[10px] text-red-400/60 mt-1">{error}</p>
                        </div>
                        <button
                            onClick={onReset}
                            className="w-full py-3 bg-white/5 hover:bg-white/10 text-white/80 rounded-xl text-sm font-bold transition-all"
                        >
                            Try Again
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
