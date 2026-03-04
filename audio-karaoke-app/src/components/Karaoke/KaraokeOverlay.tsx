import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { LRCData } from '@/types/karaoke';
import { PitchAnalysisResult } from '@/types/audio';
import { PlaybackController } from '@/utils/audio/playbackController';
import { AudioVisualizer } from '@/utils/audio/audioVisualizer';
import { KaraokeUIState, KaraokeUIActions } from '@/hooks/useKaraokeUI';
import { usePlayback } from '@/hooks/usePlayback';

import { LyricsContainer } from './Visualizer/LyricsContainer';
import { KaraokeToolbar } from './Visualizer/KaraokeToolbar';
import { PanelsOverlay } from './Visualizer/PanelsOverlay';
import { SmartTransposeSuggestion } from './SmartTransposeSuggestion';
import { SettingsPanel } from '../UI/SettingsPanel';
import { StemSeparationPanel } from './StemSeparationPanel';
import { ModelType, MODELS } from '@/types/model';
import { ProcessingProgress } from '@/types/audio';
import { StateFrom } from 'xstate';
import { karaokeMachine } from '@/machines/karaokeMachine';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/utils/storage/audioDatabase';
import { offlineQueueManager } from '@/utils/processing/OfflineQueueManager';
import { audioCache } from '@/utils/storage/audioCache';
import { StorageManager } from '@/utils/storage/StorageManager';
import { decodeArrayBuffer } from '@/utils/audio/audioDecoder';

interface KaraokeOverlayProps {
    uiState: KaraokeUIState;
    uiActions: KaraokeUIActions;
    
    // Data
    lyrics: LRCData | null;
    cdgData: Uint8Array | null;
    controller: PlaybackController;
    visualizer: AudioVisualizer | null;
    playback?: ReturnType<typeof usePlayback>;
    
    // Playback State (needed for LyricsContainer)
    currentLineIndex: number;
    currentWordIndex: number;
    pitchHistory: PitchAnalysisResult[];

    // Recorder State
    recorder: {
        isRecording: boolean;
    };
    
    // Feature Props (Grouped)
    /* eslint-disable @typescript-eslint/no-explicit-any */
    voiceFxProps: Record<string, any>;
    practiceProps: Record<string, any>;
    roomProps: Record<string, any>;
    autoKeyProps: Record<string, any>;
    lyricSyncProps: Record<string, any>;
    /* eslint-enable @typescript-eslint/no-explicit-any */

    // Callbacks
    onCanvasReady: (canvas: HTMLCanvasElement) => void;
    onLRCUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSaveLRC: (data: LRCData) => void;
    
    // Mix Recording
    isRecordingMix: boolean;
    recordedMixBlob: Blob | null;
    onStartRecordingMix: () => void;
    onStopRecordingMix: () => void;
    onClearMixRecording: () => void;
    
    // XState
    machineState: StateFrom<typeof karaokeMachine>;
}

export const KaraokeOverlay: React.FC<KaraokeOverlayProps> = ({
    uiState,
    uiActions,
    lyrics,
    cdgData,
    controller,
    visualizer,
    currentLineIndex,
    currentWordIndex,
    pitchHistory,
    recorder,
    voiceFxProps,
    practiceProps,
    roomProps,
    autoKeyProps,
    lyricSyncProps,
    onCanvasReady,
    onLRCUpload,
    onSaveLRC,
    isRecordingMix,
    recordedMixBlob,
    onStartRecordingMix,
    onStopRecordingMix,
    onClearMixRecording,
    machineState
}) => {
    const t = useTranslations('KaraokePlayer');

    const [showSeparation, setShowSeparation] = React.useState(false);
    const [separationError, setSeparationError] = React.useState<Error | null>(null);

    // Reactive query for the current file's separation job
    const activeJob = useLiveQuery(async () => {
        const file = controller.getOriginalFile();
        if (!file) return null;
        const hash = await audioCache.hashFile(file);
        const job = await db.processingQueue
            .where('fileHash')
            .equals(hash)
            .last(); // get most recent
        return job;
    }, [controller]);

    // Map `ProcessingJob` to `ProcessingProgress` for the UI
    const separationProgress: ProcessingProgress | null = React.useMemo(() => {
        if (!activeJob) return null;
        return {
            phase: activeJob.status === 'processing' ? 'separating' : (activeJob.status === 'completed' ? 'done' : activeJob.status) as any,
            percentage: activeJob.progress,
            message: activeJob.status === 'pending' ? 'Queued...' : `Background processing: ${Math.round(activeJob.progress)}%`,
            currentSegment: 0,
            totalSegments: 1,
            executionBackend: 'wasm'
        };
    }, [activeJob]);

    // Handle completed jobs - hot swap buffers
    React.useEffect(() => {
        const handleJobCompleted = async (e: Event) => {
            const customEvent = e as CustomEvent;
            const file = controller.getOriginalFile();
            if (!file) return;
            const currentHash = await audioCache.hashFile(file);
            
            if (customEvent.detail?.fileHash === currentHash) {
                // Job finished for our CURRENT song! Load from cache!
                const cached = await audioCache.getCachedAudio(currentHash, MODELS[ModelType.DEMUCS].id);
                if (cached) {
                    const vBuf = await decodeArrayBuffer(cached.vocals);
                    const iBuf = await decodeArrayBuffer(cached.instrumentals);
                    controller.setAudioBuffers([vBuf, iBuf]);
                    console.log('Hot-swapped separated audio from background job!');
                }
            }
        };

        window.addEventListener('muzika-job-completed', handleJobCompleted);
        return () => window.removeEventListener('muzika-job-completed', handleJobCompleted);
    }, [controller]);

    const handleStartSeparation = async () => {
        setSeparationError(null);
        
        try {
            const file = controller.getOriginalFile();
            if (!file) {
                throw new Error('No audio file found for separation');
            }

            const fileHash = await audioCache.hashFile(file);
            
            // First, store the file in db.audioFiles so the background worker can read it
            const fileId = `${fileHash}_${Date.now()}`;
            await StorageManager.storeFile(file, fileId);

            // Add job to the OfflineQueueManager
            await offlineQueueManager.addJob(
                file,
                MODELS[ModelType.DEMUCS].id
            );
            
            // Allow user to close panel immediately
            setShowSeparation(false);
            
            // (Optional) Toast notification that job was queued here...
        } catch (err) {
            setSeparationError(err instanceof Error ? err : new Error(String(err)));
        }
    };

    if (machineState.matches('loading')) {
        return (
            <div className="absolute inset-0 z-100 flex flex-col items-center justify-center bg-black/80 backdrop-blur-xl">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    className="w-16 h-16 border-4 border-t-purple-500 border-white/10 rounded-full mb-6 shadow-[0_0_30px_rgba(168,85,247,0.3)]"
                />
                <h2 className="text-2xl font-bold text-white tracking-widest animate-pulse">PREPARING STUDIO...</h2>
                <p className="text-white/40 mt-2 font-mono text-sm uppercase tracking-widest">Optimizing audio buffers</p>
            </div>
        );
    }

    return (
        <>
            <LyricsContainer
                cdgData={cdgData}
                lyrics={lyrics}
                showEditor={uiState.showEditor}
                isStageMode={uiState.isStageMode}
                theme={uiState.theme}
                stageTheme={uiState.stageTheme}
                visualSettings={uiState.visualSettings}
                currentLineIndex={currentLineIndex}
                currentWordIndex={currentWordIndex}
                visualizer={visualizer || null}
                controller={controller}
                pitchHistory={pitchHistory}
                onCanvasReady={onCanvasReady}
                onToggleEditor={uiActions.toggleEditor}
                onSaveLRC={onSaveLRC}
                onLRCUpload={onLRCUpload}
            />

            <SmartTransposeSuggestion
                detectedKey={autoKeyProps.detectedKey}
                vocalRange={autoKeyProps.vocalRange}
                suggestedShift={autoKeyProps.suggestedShift}
                onApply={autoKeyProps.onApply}
            />

            <KaraokeToolbar
                lyrics={lyrics}
                cdgData={cdgData}
                showEditor={uiState.showEditor}
                theme={uiState.theme}
                showPractice={uiState.showPractice}
                showRoom={uiState.showRoom}
                showVoiceFx={uiState.showVoiceFx}
                showAutoKey={uiState.showAutoKey}
                showLyricSync={uiState.showLyricSync}
                isVisualSettingsOpen={uiState.isVisualSettingsOpen}
                visualSettings={uiState.visualSettings}
                isRecordingMix={isRecordingMix}
                recordedMixBlob={recordedMixBlob}
                onStartRecordingMix={onStartRecordingMix}
                onStopRecordingMix={onStopRecordingMix}
                onClearMixRecording={onClearMixRecording}
                onThemeChange={uiActions.updateTheme}
                onTogglePractice={uiActions.togglePractice}
                onToggleRoom={uiActions.toggleRoom}
                onToggleVoiceFx={uiActions.toggleVoiceFx}
                onToggleAutoKey={uiActions.toggleAutoKey}
                onToggleLyricSync={uiActions.toggleLyricSync}
                onToggleEditor={uiActions.toggleEditor}
                onToggleStageMode={uiActions.toggleStageMode}
                onVisualSettingsChange={uiActions.updateVisualSettings}
                showSeparation={showSeparation}
                onToggleSeparation={() => setShowSeparation(prev => !prev)}
            />

            <PanelsOverlay
                showVoiceFx={uiState.showVoiceFx}
                showPractice={uiState.showPractice}
                showRoom={uiState.showRoom}
                showAutoKey={uiState.showAutoKey}
                showLyricSync={uiState.showLyricSync}
                voiceFxProps={voiceFxProps}
                practiceProps={practiceProps}
                roomProps={roomProps}
                autoKeyProps={autoKeyProps}
                lyricSyncProps={lyricSyncProps}
                onCloseVoiceFx={() => uiActions.setShowVoiceFx(false)}
                onClosePractice={() => uiActions.setShowPractice(false)}
                onCloseRoom={() => uiActions.setShowRoom(false)}
                onCloseAutoKey={() => uiActions.setShowAutoKey(false)}
                onCloseLyricSync={() => uiActions.setShowLyricSync(false)}
            />

            <AnimatePresence>
                {(recorder.isRecording || isRecordingMix) && (
                    <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="absolute top-6 left-6 flex items-center gap-2 bg-red-500/20 text-red-500 px-4 py-2 rounded-full border border-red-500/30 font-black text-[10px] uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(239,68,68,0.2)] z-50 pointer-events-none"
                    >
                        <motion.div 
                            animate={{ scale: [1, 1.4, 1] }}
                            transition={{ repeat: Infinity, duration: 1.5 }}
                            className="w-2 h-2 bg-red-500 rounded-full" 
                        />
                        {isRecordingMix ? t('recordingSession') || 'RECORDING SESSION' : t('recording')}
                    </motion.div>
                )}
            </AnimatePresence>

            <SettingsPanel
                isOpen={uiState.isVisualSettingsOpen}
                onClose={uiActions.toggleVisualSettings}
                visualSettings={uiState.visualSettings}
                onVisualSettingsChange={uiActions.updateVisualSettings}
            />

            <StemSeparationPanel
                isOpen={showSeparation}
                onClose={() => setShowSeparation(false)}
                progress={separationProgress}
                modelInfo={MODELS[ModelType.DEMUCS]}
                error={separationError}
                onStart={handleStartSeparation}
            />
        </>
    );
};
