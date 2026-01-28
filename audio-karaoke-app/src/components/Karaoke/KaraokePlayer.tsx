/**
 * KaraokePlayer Component
 * Main container for the karaoke experience
 */

import React, { useState, useEffect, useRef } from 'react';
import { LRCData } from '@/types/karaoke';
import { parseLRC } from '@/utils/karaoke/lrcParser';
import { PlaybackController } from '@/utils/audio/playbackController';
import { usePlayback } from '@/hooks/usePlayback';
import { AudioVisualizer } from '@/utils/audio/audioVisualizer';
import { PlayerControls } from '../PlayerControls/PlayerControls';
import { EffectsPanel } from './EffectsPanel';
import { LyricDisplay, LyricTheme } from './LyricDisplay';
import { LyricEditor } from './LyricEditor';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { VideoExporter } from '@/utils/audio/videoExport';
import { CDGRenderer } from './CDGRenderer';

interface KaraokePlayerProps {
    controller: PlaybackController;
}

export const KaraokePlayer: React.FC<KaraokePlayerProps> = ({ controller }) => {
    const [lyrics, setLyrics] = useState<LRCData | null>(null);
    const playback = usePlayback(controller);

    // Effects State
    const [pitch, setPitch] = useState(0);
    const [tempo, setTempo] = useState(1.0);
    const [reverb, setReverb] = useState(0);
    const [echo, setEcho] = useState(0);
    const [showEditor, setShowEditor] = useState(false);
    const [theme, setTheme] = useState<LyricTheme>('modern');
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);
    const [cdgData, setCdgData] = useState<Uint8Array | null>(null);

    const recorder = useVoiceRecorder();

    useEffect(() => {
        if (recorder.recordedBuffer) {
            controller.setVoiceBuffer(recorder.recordedBuffer);
        }
    }, [recorder.recordedBuffer, controller]);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const visualizerRef = useRef<AudioVisualizer | null>(null);

    // Initialize visualizer
    useEffect(() => {
        if (!visualizerRef.current) {
            visualizerRef.current = new AudioVisualizer();
        }

        const gainNodes = controller.getGainNodes();
        if (gainNodes.length > 0) {
            // Connect all gain nodes to visualizer
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
    }, [controller]);

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
                audioBuffers: controller['audioBuffers'], // Accessing private for demo
                voiceBuffer: recorder.recordedBuffer
            });

            const blob = await exporter.export((p) => setExportProgress(p));
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'karaoke.webm';
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Export failed:', error);
        } finally {
            setIsExporting(false);
        }
    };

    const handleSaveLRC = (data: LRCData) => {
        setLyrics(data);
        setShowEditor(false);
    };

    return (
        <div className="flex flex-col gap-8 w-full">
            {/* Visualizer and Lyrics Area */}
            <div className="relative bg-black/40 rounded-3xl overflow-hidden border border-white/10 aspect-video md:aspect-[21/9] flex flex-col items-center justify-center p-8 group">
                {/* Background Visualizer */}
                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full opacity-30 pointer-events-none"
                    width={1200}
                    height={400}
                />

                {/* Lyrics Layer */}
                <div className="relative z-10 w-full flex flex-col items-center">
                    {cdgData && (
                        <div className="mb-4 scale-150 transform">
                            <CDGRenderer cdgData={cdgData} currentTime={playback.currentTime} />
                        </div>
                    )}

                    {showEditor ? (
                        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-xl p-4 overflow-y-auto">
                            <div className="flex justify-end mb-4">
                                <button
                                    onClick={() => setShowEditor(false)}
                                    className="p-2 hover:bg-white/10 rounded-full text-white"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            <LyricEditor
                                currentTime={playback.currentTime}
                                onSave={handleSaveLRC}
                                initialLRC={lyrics}
                            />
                        </div>
                    ) : (
                        <LyricDisplay lyrics={lyrics} currentTime={playback.currentTime} theme={theme} />
                    )}
                </div>

                {/* Overlays */}
                {!lyrics && !cdgData && !showEditor && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                        <div className="flex gap-4">
                            <label className="cursor-pointer group-hover:bg-black/20 transition-colors">
                                <input type="file" accept=".lrc,.cdg" onChange={handleLRCUpload} className="hidden" />
                                <div className="bg-white/10 backdrop-blur-md px-6 py-3 rounded-full border border-white/20 hover:bg-white/20 transition-all text-white">
                                    Upload .LRC / .CDG
                                </div>
                            </label>
                            <button
                                onClick={() => setShowEditor(true)}
                                className="bg-primary/20 backdrop-blur-md px-6 py-3 rounded-full border border-primary/20 hover:bg-primary/30 transition-all text-white"
                            >
                                Create Lyrics
                            </button>
                        </div>
                    </div>
                )}

                {(lyrics || cdgData) && !showEditor && (
                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex bg-black/40 backdrop-blur-md rounded-full p-1 border border-white/10">
                            {(['modern', 'neon', 'classic', 'retro'] as LyricTheme[]).map(t => (
                                <button
                                    key={t}
                                    onClick={() => setTheme(t)}
                                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${theme === t ? 'bg-primary text-white shadow-lg' : 'text-white/40 hover:text-white/60'
                                        }`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => setShowEditor(true)}
                            className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md ml-2"
                            title="Edit Lyrics"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                    </div>
                )}

                {/* Recording Status */}
                {recorder.isRecording && (
                    <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-500/20 text-red-500 px-3 py-1 rounded-full border border-red-500/30 animate-pulse font-bold text-xs uppercase tracking-widest">
                        <div className="w-2 h-2 bg-red-500 rounded-full" />
                        Recording
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="flex flex-col gap-4">
                <PlayerControls
                    isPlaying={playback.isPlaying}
                    currentTime={playback.currentTime}
                    duration={playback.duration}
                    vocalsVolume={playback.vocalsVolume}
                    instrumentalVolume={playback.instrumentalVolume}
                    onPlay={playback.play}
                    onPause={playback.pause}
                    onSeek={playback.seek}
                    onVocalsVolumeChange={(v) => playback.setVolume(v, 0)}
                    onInstrumentalVolumeChange={(v) => playback.setVolume(v, 1)}
                />

                {/* Recording Controls */}
                <div className="flex justify-center items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10">
                    {!recorder.isRecording ? (
                        <button
                            onClick={recorder.startRecording}
                            className="flex items-center gap-2 px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-full font-bold transition-all shadow-lg shadow-red-500/20"
                        >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                            </svg>
                            Record Vocals
                        </button>
                    ) : (
                        <button
                            onClick={recorder.stopRecording}
                            className="flex items-center gap-2 px-6 py-2 bg-white text-black rounded-full font-bold transition-all animate-pulse"
                        >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                            </svg>
                            Stop Recording
                        </button>
                    )}

                    {recorder.recordedBuffer && (
                        <div className="flex items-center gap-4 ml-4 pl-4 border-l border-white/10">
                            <span className="text-white/60 text-sm">Voice recorded</span>
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
                        <button
                            disabled={isExporting}
                            onClick={handleVideoExport}
                            className="ml-auto flex items-center gap-2 px-6 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-full font-bold transition-all disabled:opacity-50"
                        >
                            {isExporting ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                    Exporting {Math.round(exportProgress * 100)}%
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                    Export Video
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Advanced Effects */}
            <EffectsPanel
                pitch={pitch}
                tempo={tempo}
                reverb={reverb}
                echo={echo}
                onPitchChange={handlePitchChange}
                onTempoChange={handleTempoChange}
                onReverbChange={handleReverbChange}
                onEchoChange={handleEchoChange}
                onReset={handleResetEffects}
            />
        </div>
    );
};
