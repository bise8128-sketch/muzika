'use client';

import React, { useEffect, useState } from 'react';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { usePlaybackQueue } from '@/hooks/usePlaybackQueue';
import { StudioController } from '@/components/Karaoke/StudioController';
import { QueuePanel } from './QueuePanel';
import { SongEntry } from '@/types/storage';

interface LibraryPlayerProps {
    song: SongEntry;
    onClose: () => void;
}

export const LibraryPlayer: React.FC<LibraryPlayerProps> = ({ song, onClose }) => {
    const engine = useAudioEngine();
    const [isLoading, setIsLoading] = useState(true);
    const [showQueue, setShowQueue] = useState(false);
    const [currentPlayingSong, setCurrentPlayingSong] = useState<SongEntry>(song);
    const {
        queue,
        songs: queueSongs,
        currentSong: queueCurrentSong,
        playNext,
        playPrevious,
        playAtIndex,
        removeFromQueue,
        clearQueue,
        setShuffle,
        setRepeat
    } = usePlaybackQueue();

    // Update current playing song when queue current song changes
    useEffect(() => {
        if (queueCurrentSong) {
            setCurrentPlayingSong(queueCurrentSong);
        }
    }, [queueCurrentSong]);

    useEffect(() => {
        const loadAudio = async () => {
            setIsLoading(true);
            try {
                // engine.load handles decoding
                // For now, load instrumental data (which is full backing track for karaoke)
                const bufferToLoad = currentPlayingSong.instrumentalData;

                if (bufferToLoad) {
                    await engine.load(bufferToLoad);
                }
            } catch (e) {
                console.error("Failed to load audio", e);
            } finally {
                setIsLoading(false);
            }
        };

        if (currentPlayingSong) {
            loadAudio();
        }
    }, [currentPlayingSong, engine.load]);

    // Handle song end to play next
    useEffect(() => {
        // The engine handles ended events internally and updates isPlaying state
        // We can use isPlaying state to detect when a song ends
        if (!engine.isPlaying && engine.currentTime > 0 && engine.currentTime >= engine.duration - 0.1) {
            // Song has ended, play next
            playNext();
        }
    }, [engine.isPlaying, engine.currentTime, engine.duration, playNext]);

    const handleShuffleToggle = () => {
        setShuffle(queue.shuffleMode === 'off');
    };

    const handleRepeatToggle = () => {
        const modes: ('off' | 'all' | 'one')[] = ['off', 'all', 'one'];
        const currentIndex = modes.indexOf(queue.repeatMode);
        const nextIndex = (currentIndex + 1) % modes.length;
        setRepeat(modes[nextIndex]);
    };

    const getRepeatIcon = () => {
        switch (queue.repeatMode) {
            case 'all':
                return (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                );
            case 'one':
                return (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        <text x="12" y="14" fontSize="8" textAnchor="middle" fill="currentColor">1</text>
                    </svg>
                );
            default:
                return (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                );
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <div className="bg-zinc-900 border border-white/10 rounded-3xl p-6 w-full max-w-4xl flex flex-col gap-6 relative shadow-2xl">
                <button
                    onClick={() => { engine.stop(); onClose(); }}
                    className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors z-10"
                >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <div className="text-center mt-2">
                    <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-linear-to-r from-primary to-purple-400">
                        {currentPlayingSong.title}
                    </h2>
                    <p className="text-muted-foreground">{currentPlayingSong.artist || 'Unknown Artist'}</p>
                    {currentPlayingSong.versionName && <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full mt-1 inline-block">{currentPlayingSong.versionName}</span>}
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    </div>
                ) : (
                    <div className="flex gap-6">
                        {/* Main Player Controls */}
                        <div className="flex-1 space-y-6">
                            {/* Playback Controls */}
                            <div className="flex flex-col items-center gap-4">
                                <div className="flex items-center gap-3">
                                    {/* Previous Button */}
                                    <button
                                        onClick={playPrevious}
                                        disabled={queueSongs.length === 0}
                                        className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z" />
                                        </svg>
                                    </button>

                                    {/* Play/Pause Button */}
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

                                    {/* Next Button */}
                                    <button
                                        onClick={playNext}
                                        disabled={queueSongs.length === 0}
                                        className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4A1 1 0 0010 6v2.798l-5.445-3.63z" />
                                        </svg>
                                    </button>
                                </div>

                                {/* Time Display */}
                                <div className="text-sm font-mono text-muted-foreground">
                                    {Math.floor(engine.currentTime / 60)}:{(Math.floor(engine.currentTime) % 60).toString().padStart(2, '0')} /
                                    {Math.floor(engine.duration / 60)}:{(Math.floor(engine.duration) % 60).toString().padStart(2, '0')}
                                </div>

                                {/* Shuffle and Repeat Controls */}
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={handleShuffleToggle}
                                        className={`
                                            p-2 rounded-full transition-colors
                                            ${queue.shuffleMode === 'on' ? 'bg-primary text-white' : 'bg-white/10 text-muted-foreground hover:text-white'}
                                        `}
                                        aria-label={queue.shuffleMode === 'on' ? 'Shuffle on' : 'Shuffle off'}
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                        </svg>
                                    </button>

                                    <button
                                        onClick={handleRepeatToggle}
                                        className={`
                                            p-2 rounded-full transition-colors
                                            ${queue.repeatMode !== 'off' ? 'bg-primary text-white' : 'bg-white/10 text-muted-foreground hover:text-white'}
                                        `}
                                        aria-label={`Repeat: ${queue.repeatMode}`}
                                    >
                                        {getRepeatIcon()}
                                    </button>

                                    <button
                                        onClick={() => setShowQueue(!showQueue)}
                                        className={`
                                            p-2 rounded-full transition-colors
                                            ${showQueue ? 'bg-primary text-white' : 'bg-white/10 text-muted-foreground hover:text-white'}
                                        `}
                                        aria-label={showQueue ? 'Hide queue' : 'Show queue'}
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <StudioController
                                engine={engine}
                                originalHash={currentPlayingSong.originalHash}
                                fileName={currentPlayingSong.title}
                                vocals={currentPlayingSong.vocalData}
                                instrumentals={currentPlayingSong.instrumentalData}
                                duration={currentPlayingSong.duration}
                            />
                        </div>

                        {/* Queue Panel */}
                        {showQueue && (
                            <div className="w-80 border-l border-white/10 pl-6">
                                <QueuePanel
                                    songs={queueSongs}
                                    currentIndex={queue.currentIndex}
                                    onPlayAtIndex={playAtIndex}
                                    onRemoveFromQueue={removeFromQueue}
                                    onClearQueue={clearQueue}
                                    onReorderQueue={async (fromIndex, toIndex) => {
                                        // Reorder logic would be implemented here
                                        console.log('Reorder queue:', fromIndex, toIndex);
                                    }}
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
