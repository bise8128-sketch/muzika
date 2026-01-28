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

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            const parsed = parseLRC(content);
            setLyrics(parsed);
        };
        reader.readAsText(file);
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
                <div className="relative z-10 w-full">
                    <LyricDisplay lyrics={lyrics} currentTime={playback.currentTime} />
                </div>

                {/* Upload LRC Overlay (visible on hover if no lyrics) */}
                {!lyrics && (
                    <label className="absolute inset-0 flex items-center justify-center cursor-pointer group-hover:bg-black/20 transition-colors">
                        <input type="file" accept=".lrc" onChange={handleLRCUpload} className="hidden" />
                        <div className="bg-white/10 backdrop-blur-md px-6 py-3 rounded-full border border-white/20 hover:bg-white/20 transition-all">
                            Add LRC Lyrics
                        </div>
                    </label>
                )}
            </div>

            {/* Controls */}
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
