/**
 * Component: KaraokePlayer
 * Main orchestrator for the karaoke experience.
 */

import React, { useState, useEffect, useRef } from 'react';
import { LRCData, VisualSettings } from '@/types/karaoke';
import { usePlayback } from '@/hooks/usePlayback';
import { AudioVisualizer } from '@/utils/audio/audioVisualizer';
import { getWorkletManager } from '@/utils/audio/audioContext';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { usePitchAnalysis } from '@/hooks/usePitchAnalysis';
import { getSettings, saveSettings } from '@/utils/storage/settingsStore';
import { useTranslations } from 'next-intl';
import { usePractice } from '@/hooks/usePractice';
import { useKaraokeRoom } from '@/hooks/useKaraokeRoom';
import { useVoiceTransform } from '@/hooks/useVoiceTransform';
import { useKaraokeShortcuts } from '@/hooks/useKaraokeShortcuts';

// Custom Hooks
import { useKaraokeExport } from '@/hooks/useKaraokeExport';
import { useKaraokeEffects } from '@/hooks/useKaraokeEffects';
import { useKaraokeEngine } from '@/hooks/useKaraokeEngine';

// Sub-components
import { VisualizerContainer } from './Visualizer/VisualizerContainer';
import { KaraokeControls } from './Controls/KaraokeControls';
import { EffectsPanel } from './EffectsPanel';
import { StemIsolationPanel } from './StemIsolationPanel';
import { PitchVisualizer } from './PitchVisualizer';
import { LyricTheme } from './LyricDisplay';
import { PlaybackController } from '@/utils/audio/playbackController';

interface KaraokePlayerProps {
    controller: PlaybackController;
}

export const KaraokePlayer: React.FC<KaraokePlayerProps> = ({ controller }) => {
    const t = useTranslations('KaraokePlayer');
    const [lyrics, setLyrics] = useState<LRCData | null>(null);
    const [cdgData, setCdgData] = useState<Uint8Array | null>(null);
    const playback = usePlayback(controller);
    const recorder = useVoiceRecorder();
    const pitchAnalysis = usePitchAnalysis(controller);
    
    // UI State
    const [showEditor, setShowEditor] = useState(false);
    const [theme, setTheme] = useState<LyricTheme>('modern');
    const [isStageMode, setIsStageMode] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showPractice, setShowPractice] = useState(false);
    const [showRoom, setShowRoom] = useState(false);
    const [showVoiceFx, setShowVoiceFx] = useState(false);
    const [showPitchAnalysis, setShowPitchAnalysis] = useState(false);
    const [isVisualSettingsOpen, setIsVisualSettingsOpen] = useState(false);

    const [visualSettings, setVisualSettings] = useState<VisualSettings>({
        highlightColor: 'text-yellow-400',
        fontSize: 'base',
        fontWeight: 'bold',
        textShadow: true,
        offset: 0,
        showDualText: false,
        visualizationMode: 'bars',
        autoQuality: true
    });

    // Domain Logic Hooks
    const { lyricState, handleCanvasReady } = useKaraokeEngine({
        controller,
        lyrics,
        visualSettings,
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

    // Visualizer Setup
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const visualizerRef = useRef<AudioVisualizer | null>(null);

    useEffect(() => {
        if (!visualizerRef.current) {
            visualizerRef.current = new AudioVisualizer();
        }
        visualizerRef.current.setAutoQuality(visualSettings.autoQuality);

        if (canvasRef.current) {
            visualizerRef.current.start();
            
            // Start the appropriate visualization based on mode
            const { visualizationMode } = visualSettings;
            switch (visualizationMode) {
                case 'waveform':
                    visualizerRef.current.drawWaveform(canvasRef.current);
                    break;
                case '3d-landscape':
                    visualizerRef.current.draw3DLandscape(canvasRef.current);
                    break;
                case 'spectrogram':
                    visualizerRef.current.drawSpectrogram(canvasRef.current);
                    break;
                case 'bars':
                default:
                    visualizerRef.current.drawSpectrum(canvasRef.current);
                    break;
            }
        }

        return () => {
            visualizerRef.current?.stop();
        };
    }, [controller, visualSettings.visualizationMode, visualSettings.autoQuality]);

    // Handle metrics updates
    useEffect(() => {
        const workletManager = getWorkletManager();
        if (!workletManager || !visualizerRef.current) return;
        
        workletManager.onMetricsUpdate((metrics: { cpuUsage: number; latency: number; bufferUnderruns: number }) => {
            visualizerRef.current?.setPerformanceMetrics(metrics);
        });
    }, [controller]);

    useEffect(() => {
        const gainNodes = controller.getGainNodes();
        if (gainNodes.length > 0 && visualizerRef.current) {
            gainNodes.forEach(node => visualizerRef.current?.setSource(node));
        }
    }, [controller, playback.vocalsVolume, playback.instrumentalVolume]);

    // Cleanup and Sync
    useEffect(() => {
        if (recorder.recordedBuffer) {
            controller.setVoiceBuffer(recorder.recordedBuffer);
        }
    }, [recorder.recordedBuffer, controller]);

    useEffect(() => {
        const settings = getSettings();
        setTheme(settings.theme);
        setIsStageMode(settings.stageModeEnabled);

        const bal = settings.defaultVolumeBalance;
        const vVol = Math.min(1, bal * 2);
        const iVol = Math.min(1, (1 - bal) * 2);
        playback.setVolume(vVol, 0); 
        playback.setVolume(iVol, 1); 
    }, [playback]);

    // Shortcuts
    useKaraokeShortcuts({
        playback,
        showEditor,
        setIsStageMode
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
            const { parseLRC } = require('@/utils/karaoke/lrcParser');
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
        <div className={`flex flex-col gap-4 md:gap-8 w-full ${isStageMode ? 'fixed inset-0 z-[100] bg-black p-4 md:p-12 overflow-y-auto' : ''}`}>
            
            <button
                onClick={() => {
                    setIsStageMode(false);
                    saveSettings({ stageModeEnabled: false });
                }}
                className={`absolute top-4 md:top-8 left-4 md:left-8 z-[110] p-3 md:p-4 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-xl transition-all focus-ring ${!isStageMode ? 'hidden' : ''}`}
                title="Exit Stage Mode (F)"
                aria-label="Exit Stage Mode"
            >
                <svg className="w-6 h-6 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>

            <VisualizerContainer
                canvasRef={canvasRef}
                lyrics={lyrics}
                cdgData={cdgData}
                currentLineIndex={lyricState.lineIndex}
                currentWordIndex={lyricState.wordIndex}
                theme={theme}
                visualSettings={visualSettings}
                isStageMode={isStageMode}
                showEditor={showEditor}
                showPractice={showPractice}
                showRoom={showRoom}
                showVoiceFx={showVoiceFx}
                showSettings={showSettings}
                isVisualSettingsOpen={isVisualSettingsOpen}
                recorder={recorder}
                
                voiceFxProps={{
                    currentPreset: useVoiceHook.currentPreset,
                    settings: useVoiceHook.settings,
                    isMonitoring: useVoiceHook.isMonitoring,
                    onPresetChange: useVoiceHook.setPreset,
                    onSettingsChange: useVoiceHook.updateSettings,
                    onToggleMonitoring: useVoiceHook.toggleMonitoring
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
                onThemeChange={(t) => {
                    setTheme(t);
                    saveSettings({ theme: t });
                }}
                onToggleStageMode={(val) => {
                    setIsStageMode(val);
                    saveSettings({ stageModeEnabled: val });
                }}
                onTogglePractice={() => setShowPractice(!showPractice)}
                onToggleRoom={() => setShowRoom(!showRoom)}
                onToggleVoiceFx={async () => {
                    if (!useVoiceHook.isInitialized) await useVoiceHook.initProcessor();
                    setShowVoiceFx(!showVoiceFx);
                }}
                onToggleSettings={() => setShowSettings(!showSettings)}
                onToggleEditor={setShowEditor}
                onSaveLRC={(data) => {
                    setLyrics(data);
                    setShowEditor(false);
                }}
                onVisualSettingsChange={setVisualSettings}
                onCloseVisualSettings={() => setIsVisualSettingsOpen(false)}
                onCloseVoiceFx={() => setShowVoiceFx(false)}
                onClosePractice={() => setShowPractice(false)}
                onCloseRoom={() => setShowRoom(false)}
            />

            <KaraokeControls
                playback={playback}
                recorder={recorder}
                lyrics={lyrics}
                isExporting={isExportingVideo}
                isExportingAudio={isExportingAudio}
                exportProgress={exportProgress}
                isStageMode={isStageMode}
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

            <EffectsPanel
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
                onReset={() => resetEffects(() => playback.setEQ(0, 0, 0))}
            />

            <StemIsolationPanel controller={controller} />

            <div className="space-y-2">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            if (pitchAnalysis.isListening) {
                                pitchAnalysis.stopAnalysis();
                            } else {
                                setShowPitchAnalysis(true);
                                pitchAnalysis.startAnalysis();
                            }
                        }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                            pitchAnalysis.isListening
                                ? 'bg-purple-500/30 text-purple-300 ring-1 ring-purple-500/40'
                                : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80 border border-white/10'
                        }`}
                    >
                        🎯 {pitchAnalysis.isListening ? t('stopAnalysis') || 'Stop Analysis' : t('pitchAnalysis') || 'Pitch Analysis'}
                    </button>
                    {pitchAnalysis.overallScore && (
                        <button
                            onClick={() => {
                                pitchAnalysis.resetAnalysis();
                                setShowPitchAnalysis(false);
                            }}
                            className="text-xs text-white/40 hover:text-white/60 transition-colors"
                        >
                            {t('resetScore') || 'Reset'}
                        </button>
                    )}
                    {pitchAnalysis.error && (
                        <span className="text-xs text-red-400">{pitchAnalysis.error}</span>
                    )}
                </div>
                {showPitchAnalysis && (
                    <PitchVisualizer
                        pitchHistory={pitchAnalysis.pitchHistory}
                        currentScore={pitchAnalysis.currentScore}
                        currentPitch={pitchAnalysis.currentPitch}
                        overallScore={pitchAnalysis.overallScore}
                        isListening={pitchAnalysis.isListening}
                    />
                )}
            </div>
        </div>
    );
};
