import React from 'react';
import { PlayerControls } from '../../PlayerControls/PlayerControls';
import { LRCData } from '@/types/karaoke';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Mic, 
    Square, 
    Trash2, 
    Download, 
    Video, 
    Music,
    Loader2
} from 'lucide-react';

interface KaraokeControlsProps {
    playback: {
        isPlaying: boolean;
        currentTime: number;
        duration: number;
        vocalsVolume: number;
        instrumentalVolume: number;
        play: () => void;
        pause: () => void;
        seek: (time: number) => void;
        setVolume: (v: number, trackIndex?: number) => void;
    };
    recorder: {
        isRecording: boolean;
        recordedBuffer: AudioBuffer | null;
        startRecording: (stream?: MediaStream) => Promise<void>;
        stopRecording: () => void;
        clearRecording: () => void;
    };
    lyrics: LRCData | null;
    isExporting: boolean;
    isExportingAudio: boolean;
    exportProgress: number;
    isStageMode: boolean;
    voiceFx: {
        isInitialized: boolean;
        init: () => Promise<void>;
        getProcessedStream: () => MediaStream | null | undefined;
    };
    onBalanceChange: (balance: number) => void;
    onAudioDownload: (format: 'wav' | 'mp3') => void;
    onVideoExport: () => void;
}

export const KaraokeControls: React.FC<KaraokeControlsProps> = ({
    playback,
    recorder,
    lyrics,
    isExporting,
    isExportingAudio,
    exportProgress,
    isStageMode,
    voiceFx,
    onBalanceChange,
    onAudioDownload,
    onVideoExport
}) => {
    const t = useTranslations('KaraokePlayer');

    const handleRecordClick = async () => {
        if (!voiceFx.isInitialized) await voiceFx.init();
        const stream = voiceFx.getProcessedStream();
        recorder.startRecording(stream || undefined);
    };

    return (
        <div className={`flex flex-col gap-6 ${isStageMode ? 'max-w-4xl mx-auto w-full pb-10' : ''}`}>
            <PlayerControls
                isPlaying={playback.isPlaying}
                currentTime={playback.currentTime}
                duration={playback.duration}
                vocalsVolume={playback.vocalsVolume}
                instrumentalVolume={playback.instrumentalVolume}
                lyrics={lyrics}
                onPlay={playback.play}
                onPause={playback.pause}
                onSeek={playback.seek}
                onBalanceChange={onBalanceChange}
            />

            {/* Sub Controls: Recording & Export */}
            <motion.div 
                layout
                className="flex flex-wrap md:flex-nowrap justify-center items-center gap-4 glass-premium p-4 md:p-2 rounded-[2.5rem] w-full max-w-4xl mx-auto border border-white/10"
            >
                {/* Recording Group */}
                <div className="flex items-center gap-3 p-1">
                    <AnimatePresence mode="wait">
                        {!recorder.isRecording ? (
                            <motion.button
                                key="start"
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleRecordClick}
                                className="flex items-center gap-2 px-8 py-3 bg-red-500 hover:bg-red-600 text-white rounded-full font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-red-500/30"
                            >
                                <Mic className="w-4 h-4 fill-current" />
                                {t('recordVocals')}
                            </motion.button>
                        ) : (
                            <motion.button
                                key="stop"
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={recorder.stopRecording}
                                className="flex items-center gap-2 px-8 py-3 bg-white text-black rounded-full font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-white/20"
                            >
                                <Square className="w-4 h-4 fill-current" />
                                {t('stopRecording')}
                            </motion.button>
                        )}
                    </AnimatePresence>

                    {recorder.recordedBuffer && (
                        <motion.div 
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center gap-3 ml-2 pl-4 border-l border-white/10"
                        >
                            <span className="text-white/40 text-[10px] font-black uppercase tracking-tighter">{t('voiceRecorded')}</span>
                            <button
                                onClick={recorder.clearRecording}
                                className="p-2 hover:bg-red-500/20 text-white/40 hover:text-red-500 transition-all rounded-full"
                                title="Clear Recording"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </motion.div>
                    )}
                </div>

                {/* Export Group */}
                {lyrics && (
                    <div className="ml-auto flex items-center gap-4 p-1">
                        <div className="flex bg-white/5 rounded-2xl p-1 gap-1 border border-white/5">
                            <ExportButton 
                                format="WAV" 
                                loading={isExportingAudio} 
                                onClick={() => onAudioDownload('wav')} 
                            />
                            <ExportButton 
                                format="MP3" 
                                loading={isExportingAudio} 
                                onClick={() => onAudioDownload('mp3')} 
                            />
                        </div>

                        <motion.button
                            disabled={isExporting}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={onVideoExport}
                            className="flex items-center gap-3 px-8 py-3 bg-primary/20 hover:bg-primary/30 text-primary rounded-full font-black text-[10px] uppercase tracking-[0.2em] transition-all border border-primary/20 disabled:opacity-50 relative overflow-hidden group min-w-[140px]"
                        >
                            {isExporting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>{Math.round(exportProgress * 100)}%</span>
                                    <motion.div 
                                        className="absolute bottom-0 left-0 h-1 bg-primary"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${exportProgress * 100}%` }}
                                    />
                                </>
                            ) : (
                                <>
                                    <Video className="w-4 h-4" />
                                    <span>{t('video')}</span>
                                </>
                            )}
                        </motion.button>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

const ExportButton: React.FC<{ format: string; loading: boolean; onClick: () => void }> = ({ format, loading, onClick }) => (
    <button
        disabled={loading}
        onClick={onClick}
        className="px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all hover:bg-white/10 text-white/60 hover:text-white flex items-center gap-2 disabled:opacity-50"
    >
        {loading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
            <Download className="w-3 h-3" />
        )}
        {format}
    </button>
);
