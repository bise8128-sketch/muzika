/**
 * Component: KaraokePlayer
 * Main orchestrator for the karaoke experience.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from '@/i18n/routing';
import { useAudio } from '@/context/AudioProvider';
import { useParams } from 'next/navigation';
import { LRCData } from '@/types/karaoke';
import { usePlayback } from '@/hooks/usePlayback';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { usePitchAnalysis } from '@/hooks/usePitchAnalysis';
import { getSettings, saveSettings } from '@/utils/storage/settingsStore';
import { usePractice } from '@/hooks/usePractice';
import { useKaraokeRoom } from '@/hooks/useKaraokeRoom';
import { useKaraokeShortcuts } from '@/hooks/useKaraokeShortcuts';
import { useAutoKey } from '@/hooks/useAutoKey';
import { useHarmonyGuide } from '@/hooks/useHarmonyGuide';
import { useMixRecorder } from '@/hooks/useMixRecorder';
import { parseLRC } from '@/utils/karaoke/lrcParser';
import { generatePitchTargets } from '@/utils/audio/pitchAnalysis';
import { useKaraokeUI } from '@/hooks/useKaraokeUI';

// Custom Hooks
import { useKaraokeExport } from '@/hooks/useKaraokeExport';
import { useKaraokeEffects } from '@/hooks/useKaraokeEffects';
import { useKaraokeEngine } from '@/hooks/useKaraokeEngine';
import { useVisualizerOrchestrator } from '@/hooks/useVisualizerOrchestrator';
import { useVoiceTransform } from '@/hooks/useVoiceTransform';
import { useLyricSync } from '@/hooks/useLyricSync';
import { useReferencePitchMap } from '@/hooks/useReferencePitchMap';

// Sub-components
import { KaraokeDisplay } from './Visualizer/KaraokeDisplay';
import { KaraokeOverlay } from './KaraokeOverlay';
import { KaraokeControls } from './Controls/KaraokeControls';
import { EffectsController } from './EffectsController';
import { PlaybackController } from '@/utils/audio/playbackController';
import { PlayerHeader } from './PlayerHeader';
import { ErrorBoundary } from '../UI/ErrorBoundary';

interface KaraokePlayerProps {
    controller: PlaybackController;
}

export const KaraokePlayer: React.FC<KaraokePlayerProps> = ({ controller }) => {
    return (
        <ErrorBoundary>
            <KaraokePlayerContent controller={controller} />
        </ErrorBoundary>
    );
};

const KaraokePlayerContent: React.FC<KaraokePlayerProps> = ({ controller }) => {
    const router = useRouter();
    const { id } = useParams();
    const { setPerformanceScore } = useAudio();

    // UI State Management
    const { state: uiState, actions: uiActions } = useKaraokeUI();
    
    // Core Data State
    const [lyrics, setLyrics] = useState<LRCData | null>(null);
    const [cdgData, setCdgData] = useState<Uint8Array | null>(null);

    // Audio Hooks
    const playback = usePlayback(controller);
    const recorder = useVoiceRecorder();
    const mixRecorder = useMixRecorder();
    const useAutoKeyHook = useAutoKey(controller);
    const harmonyGuide = useHarmonyGuide(useAutoKeyHook.detectedKey);
    const pitchAnalysis = usePitchAnalysis(controller, harmonyGuide.activeKeyInfo);
    
    // Domain Logic Hooks
    const { lyricState, handleCanvasReady } = useKaraokeEngine({
        controller,
        lyrics,
        visualSettings: uiState.visualSettings,
        cdgData
    });

    const {
        pitch,
        tempo,
        reverb,
        echo,
        handlePitchChange,
        handleTempoChange,
        handleReverbChange,
        handleEchoChange,
        resetEffects
    } = useKaraokeEffects(controller);

    const {
        isExportingVideo,
        isExportingAudio,
        exportProgress,
        handleVideoExport,
        handleAudioDownload
    } = useKaraokeExport({
        controller,
        lyrics,
        recordedBuffer: recorder.recordedBuffer
    });

    // Other Feature Hooks
    const usePracticeHook = usePractice(controller);
    const useRoomHook = useKaraokeRoom(controller);
    const useVoiceHook = useVoiceTransform();
    const lyricSync = useLyricSync(controller);
    const { pitchMap } = useReferencePitchMap(controller);

    // Visualizer Setup
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const visualizerInstance = useVisualizerOrchestrator({
        controller,
        visualSettings: uiState.visualSettings,
        canvasRef,
        vocalsVolume: playback.vocalsVolume,
        instrumentalVolume: playback.instrumentalVolume,
        vocalEnergy: 0, // Energy will be pulled via useAudioReactivity in sub-components
        voicePreset: useVoiceHook.currentPreset
    });
    
    // Auto-update lyrics when AI sync finishes
    useEffect(() => {
        if (lyricSync.result) {
            setLyrics(prev => ({
                lines: lyricSync.result!.lines,
                metadata: prev?.metadata || {}
            }));
        }
    }, [lyricSync.result]);

    // Cleanup and Sync
    useEffect(() => {
        if (recorder.recordedBuffer) {
            controller.setVoiceBuffer(recorder.recordedBuffer);
        }
    }, [recorder.recordedBuffer, controller]);

    // Handle song end to show performance score
    useEffect(() => {
        const handleEnded = () => {
            if (pitchAnalysis.overallScore) {
                setPerformanceScore(pitchAnalysis.overallScore);
                router.push(`/karaoke/${id}/score`);
            }
        };

        controller.on('ended', handleEnded);
        return () => {
            controller.off('ended', handleEnded);
        };
    }, [controller, pitchAnalysis.overallScore, setPerformanceScore, router, id]);

    // Mix Bus Routing Setup
    useEffect(() => {
        const dest = mixRecorder.getMixDestination();
        
        // Internal hack/bypass or expose explicitly
        const systemDest = controller['effects']?.getDestination?.(); 
        if (systemDest) {
            systemDest.connect(dest);
        }

        const voiceStream = useVoiceHook.getProcessedStream();
        let micSource: MediaStreamAudioSourceNode | null = null;
        if (voiceStream) {
            const ctx = controller['audioContext'];
            micSource = ctx.createMediaStreamSource(voiceStream);
            micSource.connect(dest);
        }

        return () => {
            if (systemDest) systemDest.disconnect(dest);
            if (micSource) micSource.disconnect();
        };
    }, [mixRecorder, controller, useVoiceHook.getProcessedStream()]);

    const vizMode = uiState.visualSettings.visualizationMode;
    const voicePreset = useVoiceHook.currentPreset;

    useEffect(() => {
        if (pitchAnalysis.isListening && visualizerInstance) {
            visualizerInstance.setMode('singstar');
        } else if (visualizerInstance) {
            visualizerInstance.setMode(vizMode);
        }
    }, [pitchAnalysis.isListening, visualizerInstance, vizMode, voicePreset]);

    useEffect(() => {
        if (visualizerInstance && pitchAnalysis.isListening && pitchAnalysis.pitchHistory.length > 0) {
            visualizerInstance.setPitchHistory(pitchAnalysis.pitchHistory);
        }
    }, [pitchAnalysis.pitchHistory, visualizerInstance, pitchAnalysis.isListening]);

    useEffect(() => {
        if (visualizerInstance && pitchMap.length > 0) {
            visualizerInstance.setReferencePitchMap(pitchMap);
        }
    }, [visualizerInstance, pitchMap]);

    useEffect(() => {
        if (visualizerInstance && pitchAnalysis.isListening && lyrics) {
            const vocalBuffer = controller.getAudioBuffers()[0] || null;
            const startIndex = Math.max(0, lyricState.lineIndex);
            
            const targets = generatePitchTargets(lyrics, vocalBuffer, startIndex, 6);
            visualizerInstance.setPitchTargets(targets);
        }
    }, [lyrics, lyricState.lineIndex, visualizerInstance, pitchAnalysis.isListening, controller]);

    // Initialize volume from settings
    useEffect(() => {
        const settings = getSettings();
        const bal = settings.defaultVolumeBalance;
        const vVol = Math.min(1, bal * 2);
        const iVol = Math.min(1, (1 - bal) * 2);
        playback.setVolume(vVol, 0); 
        playback.setVolume(iVol, 1); 
    }, [playback]); // Only once on mount (ignoring playback dep safely)

    // Shortcuts
    useKaraokeShortcuts({
        playback,
        showEditor: uiState.showEditor,
        setIsStageMode: uiActions.setIsStageMode
    });

    const handleLRCUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.name.endsWith('.cdg')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const data = new Uint8Array(event.target?.result as ArrayBuffer);
                setCdgData(data);
            };
            reader.readAsArrayBuffer(file);
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            setLyrics(parseLRC(content));
        };
        reader.readAsText(file);
    };

    const handleBalanceChange = React.useCallback((balance: number) => {
        const vVol = Math.min(1, balance * 2);
        const iVol = Math.min(1, (1 - balance) * 2);
        playback.setVolume(vVol, 0); 
        playback.setVolume(iVol, 1); 
        saveSettings({ defaultVolumeBalance: balance });
    }, [playback]);

    return (
        <ErrorBoundary onReset={() => recorder.clearRecording()}>
            <div className={`flex flex-col gap-4 md:gap-8 w-full ${uiState.isStageMode ? 'fixed inset-0 z-100 bg-black p-4 md:p-12 overflow-y-auto' : ''}`}>
                
                <PlayerHeader 
                    isStageMode={uiState.isStageMode} 
                    onExitStageMode={() => uiActions.setIsStageMode(false)} 
                />

                <KaraokeDisplay
                    canvasRef={canvasRef}
                    visualSettings={uiState.visualSettings}
                    stageTheme={uiState.stageTheme}
                    isStageMode={uiState.isStageMode}
                    visualizer={visualizerInstance}
                >
                    <KaraokeOverlay
                        uiState={uiState}
                        uiActions={uiActions}
                        lyrics={lyrics}
                        cdgData={cdgData}
                        controller={controller}
                        visualizer={visualizerInstance}
                        playback={playback}
                        currentLineIndex={lyricState.lineIndex}
                        currentWordIndex={lyricState.wordIndex}
                        pitchHistory={pitchAnalysis.pitchHistory}
                        recorder={recorder}
                        
                        voiceFxProps={{
                            currentPreset: useVoiceHook.currentPreset,
                            settings: useVoiceHook.settings,
                            isMonitoring: useVoiceHook.isMonitoring,
                            onPresetChange: useVoiceHook.setPreset,
                            onSettingsChange: useVoiceHook.updateSettings,
                            onToggleMonitoring: useVoiceHook.toggleMonitoring,
                            isInitialized: useVoiceHook.isInitialized,
                            onInit: useVoiceHook.initProcessor
                        }}
                        autoKeyProps={{
                            isAnalyzing: useAutoKeyHook.isAnalyzing,
                            detectedKey: useAutoKeyHook.detectedKey,
                            vocalRange: useAutoKeyHook.vocalRange,
                            suggestedShift: useAutoKeyHook.suggestedShift,
                            onAnalyze: useAutoKeyHook.analyzeTrack,
                            onApply: useAutoKeyHook.applyShift,
                            onRangeChange: useAutoKeyHook.updateVocalRange
                        }}
                        practiceProps={{
                            ...usePracticeHook,
                            startPractice: usePracticeHook.startPractice
                        }}
                        roomProps={{
                            ...useRoomHook,
                            onJoin: useRoomHook.joinRoom,
                            onLeave: useRoomHook.leaveRoom
                        }}

                        onCanvasReady={handleCanvasReady}
                        onLRCUpload={handleLRCUpload}
                        onSaveLRC={(data) => {
                            setLyrics(data);
                            uiActions.setShowEditor(false);
                        }}
                        
                        isRecordingMix={mixRecorder.isRecordingMix}
                        recordedMixBlob={mixRecorder.recordedMixBlob}
                        onStartRecordingMix={mixRecorder.startRecordingMix}
                        onStopRecordingMix={mixRecorder.stopRecordingMix}
                        onClearMixRecording={mixRecorder.clearMixRecording}
                        
                        lyricSyncProps={{
                            isProcessing: lyricSync.isProcessing,
                            progress: lyricSync.progress,
                            result: lyricSync.result,
                            error: lyricSync.error,
                            onStartSync: () => {
                                if (lyrics) {
                                    lyricSync.startSync(lyrics.lines.map(l => l.text));
                                }
                            },
                            onCancel: lyricSync.cancelSync,
                            onReset: lyricSync.resetSync,
                            hasLyrics: !!lyrics
                        }}
                    />
                </KaraokeDisplay>

                <KaraokeControls
                    playback={{
                        ...playback,
                        pitch,
                        setPitch: handlePitchChange
                    }}
                    recorder={recorder}
                    lyrics={lyrics}
                    isExporting={isExportingVideo}
                    isExportingAudio={isExportingAudio}
                    exportProgress={exportProgress}
                    isStageMode={uiState.isStageMode}
                    voiceFx={{
                        isInitialized: useVoiceHook.isInitialized,
                        init: useVoiceHook.initProcessor,
                        getProcessedStream: useVoiceHook.getProcessedStream
                    }}
                    onBalanceChange={handleBalanceChange}
                    onAudioDownload={(format) => handleAudioDownload(format, {
                        pitch,
                        tempo,
                        bass: playback.bass,
                        mid: playback.mid,
                        treble: playback.treble,
                        volumes: [playback.vocalsVolume, playback.instrumentalVolume]
                    })}
                    onVideoExport={handleVideoExport}
                />

                <EffectsController
                    controller={controller}
                    pitch={pitch}
                    tempo={tempo}
                    reverb={reverb}
                    echo={echo}
                    bass={playback.bass}
                    mid={playback.mid}
                    treble={playback.treble}
                    onPitchChange={handlePitchChange}
                    onTempoChange={handleTempoChange}
                    onReverbChange={handleReverbChange}
                    onEchoChange={handleEchoChange}
                    onBassChange={(v) => playback.setEQ(v, playback.mid, playback.treble)}
                    onMidChange={(v) => playback.setEQ(playback.bass, v, playback.treble)}
                    onTrebleChange={(v) => playback.setEQ(playback.bass, playback.mid, v)}
                    onResetEffects={() => resetEffects(() => playback.setEQ(0, 0, 0))}
                    pitchAnalysis={pitchAnalysis}
                    harmonyGuide={harmonyGuide}
                    detectedKey={useAutoKeyHook.detectedKey}
                />
            </div>
        </ErrorBoundary>
    );
};
