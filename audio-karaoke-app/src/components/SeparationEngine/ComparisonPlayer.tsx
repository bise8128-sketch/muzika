'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { PlaybackController } from '@/utils/audio/playbackController';

interface ComparisonPlayerProps {
    tracks: {
        id: string;
        name: string;
        blob: Blob | AudioBuffer | null;
    }[];
}

export const ComparisonPlayer: React.FC<ComparisonPlayerProps> = ({ tracks }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [solos, setSolos] = useState<Record<string, boolean>>({});

    // We'll use a local controller for comparison playback
    const controllerRef = useRef<PlaybackController | null>(null);

    useEffect(() => {
        const controller = new PlaybackController();
        controllerRef.current = controller;

        const loadTracks = async () => {
            const buffers: AudioBuffer[] = [];
            for (const track of tracks) {
                if (track.blob instanceof AudioBuffer) {
                    buffers.push(track.blob);
                } else if (track.blob instanceof Blob) {
                    const arrayBuffer = await track.blob.arrayBuffer();
                    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                    const decoded = await audioContext.decodeAudioData(arrayBuffer);
                    buffers.push(decoded);
                }
            }
            if (buffers.length > 0) {
                controller.setAudioBuffers(buffers);
                setDuration(buffers[0].duration);
            }
        };

        loadTracks();

        const interval = setInterval(() => {
            if (controllerRef.current) {
                setCurrentTime(controllerRef.current.getCurrentTime());
            }
        }, 100);

        return () => {
            clearInterval(interval);
            controller.dispose();
        };
    }, [tracks]);

    const handlePlayPause = () => {
        if (!controllerRef.current) return;
        if (isPlaying) {
            controllerRef.current.pause();
        } else {
            controllerRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        if (controllerRef.current) {
            controllerRef.current.setCurrentTime(time);
            setCurrentTime(time);
        }
    };

    const toggleSolo = (id: string, index: number) => {
        if (!controllerRef.current) return;

        const newSolos = { ...solos, [id]: !solos[id] };
        setSolos(newSolos);

        const anySolo = Object.values(newSolos).some(v => v);

        tracks.forEach((t, i) => {
            const volume = anySolo ? (newSolos[t.id] ? 1 : 0) : 1;
            controllerRef.current?.setVolume(volume, i);
        });
    };

    const formatTime = (time: number) => {
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="glass-card p-6 rounded-3xl border-primary/20 bg-primary/5 mb-8">
            <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handlePlayPause}
                            className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20 hover:scale-105 transition-all"
                        >
                            {isPlaying ? (
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                            ) : (
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                </svg>
                            )}
                        </button>
                        <div>
                            <h4 className="font-bold">Sync Comparison</h4>
                            <p className="text-xs text-muted-foreground">Switch between tracks in real-time</p>
                        </div>
                    </div>
                    <div className="text-sm font-mono text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                        {formatTime(currentTime)} / {formatTime(duration)}
                    </div>
                </div>

                <div className="relative h-2 w-full bg-white/5 rounded-full overflow-hidden group">
                    <input
                        type="range"
                        min="0"
                        max={duration}
                        step="0.1"
                        value={currentTime}
                        onChange={handleSeek}
                        className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
                    />
                    <div
                        className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-100 relative"
                        style={{ width: `${(currentTime / duration) * 100}%` }}
                    >
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg scale-0 group-hover:scale-100 transition-transform"></div>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {tracks.map((track, index) => (
                        <button
                            key={track.id}
                            onClick={() => toggleSolo(track.id, index)}
                            className={`
                                flex items-center justify-between px-4 py-3 rounded-2xl border transition-all
                                ${solos[track.id]
                                    ? 'bg-primary/20 border-primary text-white'
                                    : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10 hover:text-white/60'}
                            `}
                        >
                            <span className="text-sm font-bold uppercase tracking-wider">{track.name}</span>
                            <div className={`w-2 h-2 rounded-full ${solos[track.id] ? 'bg-primary animate-pulse' : 'bg-white/20'}`}></div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
