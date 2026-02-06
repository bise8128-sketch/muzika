'use client';

import React, { useEffect, useState } from 'react';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { StudioController } from '@/components/Karaoke/StudioController';
import { SongEntry } from '@/types/storage';

interface LibraryPlayerProps {
    song: SongEntry;
    onClose: () => void;
}

export const LibraryPlayer: React.FC<LibraryPlayerProps> = ({ song, onClose }) => {
    const engine = useAudioEngine();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadAudio = async () => {
            setIsLoading(true);
            try {
                // engine.load handles decoding
                // For now, load instrumental data (which is the full backing track for karaoke)
                const bufferToLoad = song.instrumentalData;

                if (bufferToLoad) {
                    await engine.load(bufferToLoad);
                }
            } catch (e) {
                console.error("Failed to load audio", e);
            } finally {
                setIsLoading(false);
            }
        };

        if (song) {
            loadAudio();
        }
    }, [song, engine.load]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <div className="bg-zinc-900 border border-white/10 rounded-3xl p-6 w-full max-w-2xl flex flex-col gap-6 relative shadow-2xl">
                <button
                    onClick={() => { engine.stop(); onClose(); }}
                    className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors z-10"
                >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <div className="text-center mt-2">
                    <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-400">
                        {song.title}
                    </h2>
                    <p className="text-muted-foreground">{song.artist || 'Unknown Artist'}</p>
                    {song.versionName && <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full mt-1 inline-block">{song.versionName}</span>}
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Playback Controls */}
                        <div className="flex flex-col items-center gap-4">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={engine.isPlaying ? engine.pause : engine.play}
                                    className="w-16 h-16 rounded-full bg-primary hover:bg-primary/90 flex items-center justify-center text-white transition-transform hover:scale-105 active:scale-95 shadow-lg shadow-primary/20"
                                >
                                    {engine.isPlaying ? (
                                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    ) : (
                                        <svg className="w-8 h-8 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    )}
                                </button>
                                <button
                                    onClick={engine.stop}
                                    className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                                >
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9h6v6H9z" />
                                    </svg>
                                </button>
                            </div>

                            {/* Time Display */}
                            <div className="text-sm font-mono text-muted-foreground">
                                {Math.floor(engine.currentTime / 60)}:{(Math.floor(engine.currentTime) % 60).toString().padStart(2, '0')} /
                                {Math.floor(engine.duration / 60)}:{(Math.floor(engine.duration) % 60).toString().padStart(2, '0')}
                            </div>
                        </div>

                        <StudioController
                            engine={engine}
                            originalHash={song.originalHash}
                            fileName={song.title}
                            vocals={song.vocalData}
                            instrumentals={song.instrumentalData}
                            duration={song.duration}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
