import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Edit3, X } from 'lucide-react';
import { LRCData, VisualSettings } from '@/types/karaoke';
import type { PlaybackController } from '@/utils/audio/playback/PlaybackCore';
import { LyricTheme, LyricDisplay } from '../LyricDisplay';
import { LyricEditor } from '../LyricEditor';
import { CDGRenderer } from '../CDGRenderer';
import { AudioVisualizer } from '@/utils/audio/audioVisualizer';
import { useTranslations } from 'next-intl';

interface LyricsContainerProps {
    cdgData: Uint8Array | null;
    lyrics: LRCData | null;
    showEditor: boolean;
    isStageMode: boolean;
    theme: LyricTheme;
    visualSettings: VisualSettings;
    currentLineIndex: number;
    currentWordIndex: number;
    visualizer: AudioVisualizer | null;
    controller: PlaybackController;
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
    visualSettings,
    currentLineIndex,
    currentWordIndex,
    visualizer,
    controller,
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
                className={`relative z-10 w-full flex flex-col items-center transition-all duration-700 ${isStageMode ? 'scale-125' : ''}`}
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
                                visualSettings={visualSettings}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            {/* Empty State Overlays */}
            {!lyrics && !cdgData && !showEditor && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-6 z-20"
                >
                    <div className="text-center space-y-2">
                        <h3 className="text-2xl font-bold text-white">Ready to Shine?</h3>
                        <p className="text-white/40 text-sm">Upload an LRC file or CDG data to begin</p>
                    </div>
                    <div className="flex gap-4">
                        <label className="cursor-pointer interactive-scale">
                            <input type="file" accept=".lrc,.cdg" onChange={onLRCUpload} className="sr-only" />
                            <div className="bg-primary/20 backdrop-blur-xl px-8 py-4 rounded-full border border-primary/30 text-white font-bold text-sm uppercase tracking-widest flex items-center gap-2 shadow-[0_0_20px_rgba(147,51,234,0.3)]">
                                <Upload className="w-4 h-4" />
                                {t('uploadLrc')}
                            </div>
                        </label>
                        <button
                            onClick={() => onToggleEditor(true)}
                            className="bg-white/5 backdrop-blur-xl px-8 py-4 rounded-full border border-white/10 hover:bg-white/10 transition-all text-white/80 font-bold text-sm uppercase tracking-widest interactive-scale"
                        >
                            {t('createLyrics')}
                        </button>
                    </div>
                </motion.div>
            )}
        </>
    );
};
