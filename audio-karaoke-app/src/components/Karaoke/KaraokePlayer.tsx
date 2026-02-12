/**
 * Komponenta KaraokePlayer
 * Glavni kontejner za karaoke iskustvo
 */

import React, { useState, useEffect, useRef } from 'react';
import { LRCData, VisualSettings } from '@/types/karaoke';
import { parseLRC } from '@/utils/karaoke/lrcParser';
import { PlaybackController } from '@/utils/audio/playbackController';
import { usePlayback } from '@/hooks/usePlayback';
import { AudioVisualizer } from '@/utils/audio/audioVisualizer';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { usePitchAnalysis } from '@/hooks/usePitchAnalysis';
import { VideoExporter } from '@/utils/audio/videoExport';
import { getSettings, saveSettings } from '@/utils/storage/settingsStore';
import { exportAudio, renderProcessedAudio, MP3ExportError, getErrorMessage } from '@/utils/audio/audioExporter';
import { useTranslations } from 'next-intl';
import { usePractice } from '@/hooks/usePractice';
import { useKaraokeRoom } from '@/hooks/useKaraokeRoom';
import { useVoiceTransform } from '@/hooks/useVoiceTransform';
import { useKaraokeShortcuts } from '@/hooks/useKaraokeShortcuts';

// New Components
import { VisualizerContainer } from './Visualizer/VisualizerContainer';
import { KaraokeControls } from './Controls/KaraokeControls';
import { EffectsPanel } from './EffectsPanel';
import { StemIsolationPanel } from './StemIsolationPanel';
import { PitchVisualizer } from './PitchVisualizer';
import { LyricTheme } from './LyricDisplay';

interface KaraokePlayerProps {
    controller: PlaybackController;
}

export const KaraokePlayer: React.FC<KaraokePlayerProps> = ({ controller }) => {
    const t = useTranslations('KaraokePlayer');
    const [lyrics, setLyrics] = useState<LRCData | null>(null);
    const playback = usePlayback(controller);

    // Worker State
    const workerRef = useRef<Worker | null>(null);
    const [lyricState, setLyricState] = useState({ lineIndex: -1, wordIndex: -1 });
    const isCanvasTransferredRef = useRef(false);

    // Stanje efekata
    const [pitch, setPitch] = useState(0);
    const [tempo, setTempo] = useState(1.0);
    const [reverb, setReverb] = useState(0);
    const [echo, setEcho] = useState(0);
    const [showEditor, setShowEditor] = useState(false);
    const [theme, setTheme] = useState<LyricTheme>('modern');
    const [isStageMode, setIsStageMode] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isExportingAudio, setIsExportingAudio] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);
    const [cdgData, setCdgData] = useState<Uint8Array | null>(null);

    const [visualSettings, setVisualSettings] = useState<VisualSettings>({
        highlightColor: 'text-yellow-400',
        fontSize: 'base',
        fontWeight: 'bold',
        textShadow: true,
        offset: 0,
        showDualText: false
    });
    const [isVisualSettingsOpen, setIsVisualSettingsOpen] = useState(false);

    const recorder = useVoiceRecorder();
    const pitchAnalysis = usePitchAnalysis(controller);
    const [showPitchAnalysis, setShowPitchAnalysis] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const visualizerRef = useRef<AudioVisualizer | null>(null);

    // Use Shortcut Hook
    useKaraokeShortcuts({
        playback,
        showEditor,
        setIsStageMode
    });

    // Initialize Worker
    useEffect(() => {
        workerRef.current = new Worker(new URL('../../workers/karaokeEngine.worker.ts', import.meta.url));

        workerRef.current.onmessage = (e) => {
            const { type, payload } = e.data;
            if (type === 'LYRIC_UPDATE') {
                setLyricState({
                    lineIndex: payload.lineIndex,
                    wordIndex: payload.wordIndex
                });
            }
        };

        return () => {
            workerRef.current?.terminate();
        };
    }, []);

    // Sync Worker with Controller
    useEffect(() => {
        if (!workerRef.current || !controller) return;

        const handlePlay = () => workerRef.current?.postMessage({ type: 'PLAY', payload: { startTime: controller.getCurrentTime() } });
        const handlePause = () => workerRef.current?.postMessage({ type: 'PAUSE' });
        const handleSeek = (data: any) => {
            workerRef.current?.postMessage({ type: 'SYNC_TIME', payload: { currentTime: data.currentTime } });
            if (controller.getIsPlaying()) {
                workerRef.current?.postMessage({ type: 'PLAY', payload: { startTime: data.currentTime } });
            }
        };

        controller.on('play', handlePlay);
        controller.on('pause', handlePause);
        controller.on('seeked', handleSeek);

        return () => {
            controller.off('play', handlePlay);
            controller.off('pause', handlePause);
            controller.off('seeked', handleSeek);
        };
    }, [controller]);

    // Send Data to Worker
    useEffect(() => {
        if (!workerRef.current) return;

        setLyricState({ lineIndex: -1, wordIndex: -1 });

        workerRef.current.postMessage({
            type: 'INIT_ENGINE',
            payload: {
                lrcData: lyrics,
                visualSettings
            }
        });
    }, [lyrics, visualSettings]);

    const handleCanvasReady = (canvas: HTMLCanvasElement) => {
        if (!workerRef.current || isCanvasTransferredRef.current) return;

        try {
            const offscreen = canvas.transferControlToOffscreen();
            workerRef.current.postMessage({
                type: 'INIT_ENGINE',
                payload: {
                    cdgData: cdgData,
                    canvas: offscreen
                }
            }, [offscreen]);
            isCanvasTransferredRef.current = true;
        } catch (e) {
            console.error("Failed to transfer canvas control:", e);
        }
    };

    // If cdgData changes but canvas is already transferred, update worker
    useEffect(() => {
        if (!cdgData) {
            isCanvasTransferredRef.current = false;
            return;
        }

        if (workerRef.current && isCanvasTransferredRef.current) {
            workerRef.current.postMessage({
                type: 'INIT_ENGINE',
                payload: {
                    cdgData: cdgData
                }
            });
        }
    }, [cdgData]);


    // Load persisted settings
    useEffect(() => {
        const settings = getSettings();
        setTheme(settings.theme);
        setIsStageMode(settings.stageModeEnabled);

        const bal = settings.defaultVolumeBalance;
        const vVol = Math.min(1, bal * 2);
        const iVol = Math.min(1, (1 - bal) * 2);
        playback.setVolume(vVol, 0); // Vocals
        playback.setVolume(iVol, 1); // Instrumental
    }, [playback]);

    useEffect(() => {
        if (recorder.recordedBuffer) {
            controller.setVoiceBuffer(recorder.recordedBuffer);
        }
    }, [recorder.recordedBuffer, controller]);

    // Inicijalizacija vizualizera
    useEffect(() => {
        if (!visualizerRef.current) {
            visualizerRef.current = new AudioVisualizer();
        }

        const gainNodes = controller.getGainNodes();
        if (gainNodes.length > 0) {
            gainNodes.forEach(node => visualizerRef.current?.setSource(node));
        }

        if (canvasRef.current) {
            visualizerRef.current.start();
            visualizerRef.current.drawSpectrum(canvasRef.current);
        }

        return () => {
            visualizerRef.current?.stop();
        };
    }, [controller]);

    // Update visualizer when tracks change
    useEffect(() => {
        const gainNodes = controller.getGainNodes();
        if (gainNodes.length > 0 && visualizerRef.current) {
            gainNodes.forEach(node => visualizerRef.current?.setSource(node));
        }
    }, [controller, playback.vocalsVolume, playback.instrumentalVolume]);

    // Handle Effects Changes
    const handlePitchChange = React.useCallback((val: number) => {
        setPitch(val);
        controller.setPitch(val);
    }, [controller]);

    const handleTempoChange = React.useCallback((val: number) => {
        setTempo(val);
        controller.setTempo(val);
    }, [controller]);

    const handleReverbChange = React.useCallback((val: number) => {
        setReverb(val);
        controller.setReverbLevel(val);
    }, [controller]);

    const handleEchoChange = React.useCallback((val: number) => {
        setEcho(val);
        controller.setEchoLevel(val);
    }, [controller]);

    const handleResetEffects = React.useCallback(() => {
        setPitch(0);
        controller.setPitch(0);
        setTempo(1.0);
        controller.setTempo(1.0);
        setReverb(0);
        controller.setReverbLevel(0);
        setEcho(0);
        controller.setEchoLevel(0);
        playback.setEQ(0, 0, 0);
    }, [controller, playback]);

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
            const parsed = parseLRC(content);
            setLyrics(parsed);
        };
        reader.readAsText(file);
    };

    const [showSettings, setShowSettings] = useState(false);
    const [showPractice, setShowPractice] = useState(false);

    const usePracticeHook = usePractice(controller);
    const {
        isPracticing,
        currentSection,
        pitchHistory: practicePitchHistory,
        recordAttempt
    } = usePracticeHook;

    const useRoomHook = useKaraokeRoom(controller);
    const [showRoom, setShowRoom] = useState(false);

    const useVoiceHook = useVoiceTransform();
    const {
        isInitialized: isVoiceFxInitialized,
        initProcessor: initVoiceFx
    } = useVoiceHook;
    const [showVoiceFx, setShowVoiceFx] = useState(false);

    // Auto-record practice attempts when section ends
    useEffect(() => {
        if (isPracticing && currentSection) {
            const currentTime = controller.getCurrentTime();
            if (Math.abs(currentTime - currentSection.endTime) < 0.5) {
               const recentFrames = pitchAnalysis.pitchHistory.slice(-currentSection.frameCount);
               if (recentFrames.length > 0) {
                   const avgAccuracy = recentFrames.reduce((s, f) => s + f.accuracy, 0) / recentFrames.length;
                   recordAttempt(avgAccuracy);
               }
            }
        }
    }, [isPracticing, currentSection, controller, pitchAnalysis.pitchHistory, recordAttempt]);

    const handleVideoExport = async () => {
        if (!lyrics) return;
        setIsExporting(true);
        setExportProgress(0);

        try {
            const exporter = new VideoExporter({
                width: 1280,
                height: 720,
                fps: 30,
                lyrics,
                audioBuffers: controller.getAudioBuffers(),
                voiceBuffer: recorder.recordedBuffer
            });

            const blob = await exporter.export((p) => setExportProgress(p));
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'karaoke.webm';
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Export failed:', error);
        } finally {
            setIsExporting(false);
        }
    };

    const handleAudioDownload = async (format: 'wav' | 'mp3') => {
        setIsExportingAudio(true);
        try {
            const processedBuffer = await renderProcessedAudio(
                controller.getAudioBuffers(),
                [playback.vocalsVolume, playback.instrumentalVolume],
                {
                    pitch,
                    tempo,
                    bass: playback.bass,
                    mid: playback.mid,
                    treble: playback.treble
                }
            );

            const filename = `karaoke_processed_${Date.now()}.${format}`;
            await exportAudio(processedBuffer, format, filename);
        } catch (error) {
            console.error('Audio export failed:', error);
            if (error instanceof MP3ExportError) {
                alert(getErrorMessage(error));
            } else {
                alert('Failed to export audio. Check console for details.');
            }
        } finally {
            setIsExportingAudio(false);
        }
    };

    const handleSaveLRC = (data: LRCData) => {
        setLyrics(data);
        setShowEditor(false);
    };

    const handleBalanceChange = React.useCallback((balance: number) => {
        const vVol = Math.min(1, balance * 2);
        const iVol = Math.min(1, (1 - balance) * 2);
        playback.setVolume(vVol, 0); // Vocals
        playback.setVolume(iVol, 1); // Instrumental
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
                
                // Props for sub-panels
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
                    startPractice: usePracticeHook.startPractice // ensure bound
                }}
                roomProps={{
                    ...useRoomHook,
                    onJoin: useRoomHook.joinRoom,
                    onLeave: useRoomHook.leaveRoom
                }}

                // Handlers
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
                    if (!isVoiceFxInitialized) await initVoiceFx();
                    setShowVoiceFx(!showVoiceFx);
                }}
                onToggleSettings={() => setShowSettings(!showSettings)}
                onToggleEditor={setShowEditor}
                onSaveLRC={handleSaveLRC}
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
                isExporting={isExporting}
                isExportingAudio={isExportingAudio}
                exportProgress={exportProgress}
                isStageMode={isStageMode}
                voiceFx={{
                    isInitialized: isVoiceFxInitialized,
                    init: initVoiceFx,
                    getProcessedStream: useVoiceHook.getProcessedStream
                }}
                onBalanceChange={handleBalanceChange}
                onAudioDownload={handleAudioDownload}
                onVideoExport={handleVideoExport}
            />

            {/* Advanced Effects & Global Controls */}
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
                onReset={handleResetEffects}
            />

            <StemIsolationPanel controller={controller} />

            {/* Pitch Analysis Indicator */}
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
