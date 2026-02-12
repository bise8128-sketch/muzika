import React from 'react';
import { PlayerControls } from '../../PlayerControls/PlayerControls';
import { LRCData } from '@/types/karaoke';
import { useTranslations } from 'next-intl';

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
        setVolume: (v: number, i: number) => void;
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
        getProcessedStream: () => MediaStream | undefined;
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
        recorder.startRecording(stream);
    };

    return (
        <div className={`flex flex-col gap-4 ${isStageMode ? 'max-w-4xl mx-auto w-full' : ''}`}>
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

            {/* Recording Controls */}
            <div className="flex justify-center items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10">
                {!recorder.isRecording ? (
                    <button
                        onClick={handleRecordClick}
                        className="flex items-center gap-2 px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-full font-bold transition-all shadow-lg shadow-red-500/20"
                    >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                        </svg>
                        {t('recordVocals')}
                    </button>
                ) : (
                    <button
                        onClick={recorder.stopRecording}
                        className="flex items-center gap-2 px-6 py-2 bg-white text-black rounded-full font-bold transition-all animate-pulse"
                    >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                        </svg>
                        {t('stopRecording')}
                    </button>
                )}

                {recorder.recordedBuffer && (
                    <div className="flex items-center gap-4 ml-4 pl-4 border-l border-white/10">
                        <span className="text-white/60 text-sm">{t('voiceRecorded')}</span>
                        <button
                            onClick={recorder.clearRecording}
                            className="text-white/40 hover:text-red-400 transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                )}

                {lyrics && (
                    <div className="ml-auto flex items-center gap-2">
                        <div className="flex bg-white/5 rounded-full p-1 border border-white/10">
                            <button
                                disabled={isExportingAudio}
                                onClick={() => onAudioDownload('wav')}
                                className="px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all hover:bg-white/10 text-white flex items-center gap-2 disabled:opacity-50"
                            >
                                {isExportingAudio ? (
                                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                )}
                                WAV
                            </button>
                            <button
                                disabled={isExportingAudio}
                                onClick={() => onAudioDownload('mp3')}
                                className="px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all hover:bg-white/10 text-white flex items-center gap-2 disabled:opacity-50"
                            >
                                {isExportingAudio ? (
                                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                )}
                                MP3
                            </button>
                        </div>

                        <button
                            disabled={isExporting}
                            onClick={onVideoExport}
                            className="flex items-center gap-2 px-6 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-full font-bold transition-all disabled:opacity-50"
                        >
                            {isExporting ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                    {t('exporting', { progress: Math.round(exportProgress * 100) })}
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                    {t('video')}
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
