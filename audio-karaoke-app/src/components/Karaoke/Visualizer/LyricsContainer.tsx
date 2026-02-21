import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Edit3, X } from 'lucide-react';
import { LRCData, VisualSettings, StageTheme, PitchAnalysisResult } from '@/types/karaoke';
import type { PlaybackController } from '@/utils/audio/playback/PlaybackCore';
import { LyricTheme, LyricDisplay } from '../LyricDisplay';
import { LyricEditor } from '../LyricEditor';
import { CDGRenderer } from '../CDGRenderer';
import { NoteHighway } from './NoteHighway';
import { AudioVisualizer } from '@/utils/audio/audioVisualizer';
import { useTranslations } from 'next-intl';

interface LyricsContainerProps {
    cdgData: Uint8Array | null;
    lyrics: LRCData | null;
    showEditor: boolean;
    isStageMode: boolean;
    theme: LyricTheme;
    stageTheme: StageTheme;
    visualSettings: VisualSettings;
    currentLineIndex: number;
    currentWordIndex: number;
    visualizer: AudioVisualizer | null;
    controller: PlaybackController;
    pitchHistory: PitchAnalysisResult[];
    onCanvasReady: (canvas: HTMLCanvasElement) => void;
    onToggleEditor: (show: boolean) => void;
    onSaveLRC: (data: LRCData) => void;
    onLRCUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const LyricsContainer: React.FC<LyricsContainerProps> = ({
    cdgData,
    lyrics,
    showEditor,
    isStageMode,
    theme,
    stageTheme,
    visualSettings,
    currentLineIndex,
    currentWordIndex,
    visualizer,
    controller,
    pitchHistory,
    onCanvasReady,
    onToggleEditor,
    onSaveLRC,
    onLRCUpload
}) => {
    const t = useTranslations('KaraokePlayer');

    return (
        <>
            {/* Lyrics Layer */}
            <motion.div 
                layout
                className={`relative z-10 w-full flex flex-col items-center transition-all duration-700 ${
                    isStageMode ? 'scale-110' : ''
                }`}
                style={{
                    perspective: isStageMode ? '1200px' : 'none',
                    transformStyle: 'preserve-3d'
                }}
            >
                {cdgData && (
                    <motion.div 
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1.5, opacity: 1 }}
                        className="mb-4 transform"
                    >
                        <CDGRenderer onCanvasReady={onCanvasReady} />
                    </motion.div>
                )}

                {isStageMode && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="w-full h-48 mb-8 relative z-20"
                    >
                        <NoteHighway
                            controller={controller}
                            pitchHistory={pitchHistory}
                            stageTheme={stageTheme}
                            height={192}
                        />
                    </motion.div>
                )}

                <AnimatePresence mode="wait">
                    {showEditor ? (
                        <motion.div 
                            key="editor"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="absolute inset-0 z-50 bg-black/90 backdrop-blur-3xl p-6 overflow-y-auto"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Edit3 className="w-5 h-5 text-primary" />
                                    {t('editLyrics') || 'Lyric Editor'}
                                </h2>
                                <button
                                    onClick={() => onToggleEditor(false)}
                                    className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            <LyricEditor
                                currentTime={0}
                                onSave={onSaveLRC}
                                initialLRC={lyrics}
                                controller={controller}
                            />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="display"
                            layout
                            className="w-full flex justify-center"
                        >
                                <LyricDisplay
                                    visualizer={visualizer}
                                    lyrics={lyrics}
                                    currentLineIndex={currentLineIndex}
                                currentWordIndex={currentWordIndex}
                                theme={theme}
                                visualSettings={{
                                        ...visualSettings,
                                        // Override some settings for Stage Mode for extra punch
                                        fontWeight: isStageMode ? 'extrabold' : visualSettings.fontWeight
                                    }}
                                    isStageMode={isStageMode}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            {/* Redesigned Empty State Overlays */}
            {!lyrics && !cdgData && !showEditor && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-12 z-20 px-8"
                >
                    {/* Dynamic Graphic Element */}
                    <div className="relative w-64 h-64 flex items-center justify-center">
                        <motion.div 
                            animate={{ 
                                scale: [1, 1.1, 1],
                                rotate: [0, 90, 180, 270, 360],
                                borderRadius: ["40% 60% 70% 30% / 40% 50% 60% 50%", "30% 60% 70% 40% / 50% 60% 30% 60%", "40% 60% 70% 30% / 40% 50% 60% 50%"]
                            }}
                            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                            className="absolute inset-0 bg-linear-to-tr from-primary/20 to-blue-500/20 blur-3xl"
                        />
                        <svg className="w-full h-full text-primary" viewBox="0 0 200 200">
                            <motion.path
                                animate={{
                                    d: [
                                        "M100,50 Q120,80 150,100 Q120,120 100,150 Q80,120 50,100 Q80,80 100,50",
                                        "M100,40 Q130,80 160,100 Q130,120 100,160 Q70,120 40,100 Q70,80 100,40",
                                        "M100,50 Q120,80 150,100 Q120,120 100,150 Q80,120 50,100 Q80,80 100,50"
                                    ]
                                }}
                                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="0.5"
                                strokeDasharray="2 2"
                                opacity="0.3"
                            />
                            <motion.circle 
                                cx="100" cy="100" r="30" 
                                fill="url(#grad)" 
                                animate={{ r: [30, 35, 30] }} 
                                transition={{ duration: 2, repeat: Infinity }}
                            />
                            <defs>
                                <radialGradient id="grad" cx="50%" cy="50%" r="50%">
                                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.8" />
                                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
                                </radialGradient>
                            </defs>
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Upload className="w-12 h-12 text-white/20 animate-pulse" />
                        </div>
                    </div>

                    <div className="text-center space-y-4 max-w-md">
                        <h3 className="text-4xl font-black text-white tracking-tighter italic">
                            READY TO <span className="text-karaoke-effect">SHINE?</span>
                        </h3>
                        <p className="text-white/40 text-lg font-medium leading-tight">
                            Elevate your performance. Upload tracks, sync lyrics, or create your own magic.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-6">
                        <label className="cursor-pointer group">
                            <input type="file" accept=".lrc,.cdg" onChange={onLRCUpload} className="sr-only" />
                            <div className="bg-white text-black px-10 py-5 rounded-full font-black text-sm uppercase tracking-[0.2em] flex items-center gap-3 shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:shadow-[0_0_60px_rgba(255,255,255,0.4)] transition-all active:scale-95">
                                <Upload className="w-5 h-5" />
                                {t('uploadLrc')}
                            </div>
                        </label>
                        <button
                            onClick={() => onToggleEditor(true)}
                            className="bg-white/5 backdrop-blur-3xl px-10 py-5 rounded-full border border-white/10 hover:bg-white/10 transition-all text-white font-black text-sm uppercase tracking-[0.2em] flex items-center gap-3 active:scale-95"
                        >
                            <Edit3 className="w-5 h-5" />
                            {t('createLyrics')}
                        </button>
                    </div>
                </motion.div>
            )}
        </>
    );
};
