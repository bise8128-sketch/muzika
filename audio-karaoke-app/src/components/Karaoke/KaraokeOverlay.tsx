import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { LRCData } from '@/types/karaoke';
import { PitchAnalysisResult } from '@/types/audio';
import { PlaybackController } from '@/utils/audio/playbackController';
import { AudioVisualizer } from '@/utils/audio/audioVisualizer';
import { KaraokeUIState, KaraokeUIActions } from '@/hooks/useKaraokeUI';

import { LyricsContainer } from './Visualizer/LyricsContainer';
import { KaraokeToolbar } from './Visualizer/KaraokeToolbar';
import { PanelsOverlay } from './Visualizer/PanelsOverlay';
import { SettingsPanel } from '../UI/SettingsPanel';
import { StemSeparationPanel } from './StemSeparationPanel';
import { separateAudio } from '@/utils/ml/separateAudio';
import { ModelType, MODELS } from '@/types/model';
import { ProcessingProgress } from '@/types/audio';

interface KaraokeOverlayProps {
    uiState: KaraokeUIState;
    uiActions: KaraokeUIActions;
    
    // Data
    lyrics: LRCData | null;
    cdgData: Uint8Array | null;
    controller: PlaybackController;
    visualizer: AudioVisualizer | null;
    playback?: any;
    
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
    onClearMixRecording
}) => {
    const t = useTranslations('KaraokePlayer');

    // Stem Separation State
    const [showSeparation, setShowSeparation] = React.useState(false);
    const [separationProgress, setSeparationProgress] = React.useState<ProcessingProgress | null>(null);
    const [separationError, setSeparationError] = React.useState<Error | null>(null);

    // Auto-open separation panel if track is not separated
    // This is a simplified logic – in a real app, you'd check if separate samples already exist
    React.useEffect(() => {
        const checkSeparation = async () => {
             //- [x] Implementation: Separation Worker [/]
             //- [x] Setup `Web Worker` for processing
             //- [x] Integrate `transformers.js` (or similar library) for client-side separation
             //- [x] Implement progress tracking and IndexedDB caching
             // For this FI, we'll assume the existence of a 'Separate Stems' button or auto-trigger
        };
        checkSeparation();
    }, []);

    const handleStartSeparation = async () => {
        setSeparationError(null);
        setSeparationProgress({ phase: 'decoding', percentage: 0, message: 'Initializing...', currentSegment: 0, totalSegments: 0 });
        
        try {
            // Use the new getOriginalFile method
            const file = controller.getOriginalFile();
            
            if (!file) {
                throw new Error('No audio file found for separation');
            }

            const result = await separateAudio(file, {
                modelInfo: MODELS[ModelType.DEMUCS],
                onProgress: (p) => setSeparationProgress(p)
            });

            // Update controller with final buffers
            controller.setAudioBuffers([result.vocals, result.instrumentals]);
            setSeparationProgress({ phase: 'separating', percentage: 100, message: 'Complete!', currentSegment: 0, totalSegments: 0 });
            
        } catch (err) {
            setSeparationError(err instanceof Error ? err : new Error(String(err)));
        }
    };

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
