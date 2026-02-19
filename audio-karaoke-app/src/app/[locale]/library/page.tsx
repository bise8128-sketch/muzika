'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from '@/i18n/routing';
import { LibraryGrid } from '@/components/Library/LibraryGrid';
import { ServerLibrarySection } from '@/components/Library/ServerLibrarySection';
import { PlaylistManager } from '@/components/Library/PlaylistManager';
import { usePlaybackQueue } from '@/hooks/usePlaybackQueue';
import type { SongEntry } from '@/types/storage';

import { ImportModal } from '@/components/Library/ImportModal';
import { StorageSettingsModal } from '@/components/Library/StorageSettingsModal';
import { db } from '@/utils/storage/audioDatabase';

export default function LibraryPage() {
    const router = useRouter();
    const [showPlaylists, setShowPlaylists] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [showStorage, setShowStorage] = useState(false);
    const [selectedSong, setSelectedSong] = useState<SongEntry | null>(null);
    const {
        addSongsToQueue,
        playAtIndex
    } = usePlaybackQueue();

    const handleAddToQueue = useCallback(async (songIds: number[]) => {
        await addSongsToQueue(songIds);
        // If queue was empty, play the first added song
        if (songIds.length > 0) {
            await playAtIndex(0);
        }
    }, [addSongsToQueue, playAtIndex]);

    const handleSongSelect = useCallback((song: SongEntry) => {
        setSelectedSong(song);
    }, []);

    const handleImport = useCallback(async (song: SongEntry) => {
        try {
            await db.songs.add(song);
        } catch (e) {
            console.error("Failed to save song", e);
            alert("Failed to save song to library");
        }
    }, []);

    const handleClosePlayer = useCallback(() => {
        setSelectedSong(null);
    }, []);

    return (
        <div className="min-h-screen selection:bg-primary/30 flex flex-col">
            <nav className="sticky top-0 z-40 glass border-b border-white/5 h-20 shrink-0">
                <div className="container mx-auto px-6 h-full flex items-center justify-between">
                    <button
                        type="button"
                        className="flex items-center gap-3 group focus-ring rounded-xl p-1"
                        onClick={() => router.push('/')}
                        aria-label="Go to home"
                    >
                        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                            </svg>
                        </div>
                        <span className="text-2xl font-black tracking-tighter">MUZIKA</span>
                    </button>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowPlaylists(!showPlaylists)}
                            className={`
                                px-4 py-2 rounded-lg font-medium transition-colors
                                ${showPlaylists
                                    ? 'bg-primary text-white'
                                    : 'text-muted-foreground hover:text-white hover:bg-white/10'
                                }
                            `}
                        >
                            {showPlaylists ? 'Show Library' : 'Show Playlists'}
                        </button>
                        <button
                            onClick={() => router.push('/')}
                            className="text-sm font-medium text-muted-foreground hover:text-white transition-colors focus-ring rounded-lg px-2 py-1"
                        >
                            Back to Studio
                        </button>
                    </div>
                </div>
            </nav>

            <main className="container mx-auto px-6 py-12 md:py-20 flex-1">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-4xl font-bold">Song Library</h1>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowStorage(true)}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white rounded-lg font-medium transition-colors flex items-center gap-2 border border-white/5"
                            title="Storage Settings"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                            </svg>
                            Storage
                        </button>
                        <button
                            onClick={() => setShowImport(true)}
                            className="px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg font-medium transition-colors flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                            Import Local
                        </button>
                    </div>
                </div>

                <div className="flex gap-6">
                    {/* Main Content Area */}
                    <div className={`flex-1 transition-all duration-300 ${showPlaylists ? 'hidden' : 'block'}`}>
                        <LibraryGrid
                            onSongSelect={handleSongSelect}
                            selectedSong={selectedSong}
                            onClosePlayer={handleClosePlayer}
                            onAddToQueue={handleAddToQueue}
                        />
                        <div className="mt-12 pt-12 border-t border-white/5">
                            <ServerLibrarySection onSelect={handleSongSelect} />
                        </div>
                    </div>

                    {/* Playlist Panel */}
                    <div className={`w-96 transition-all duration-300 ${showPlaylists ? 'block' : 'hidden'}`}>
                        <PlaylistManager onAddToQueue={handleAddToQueue} />
                    </div>
                </div>
            </main>

            {showImport && (
                <ImportModal
                    onClose={() => setShowImport(false)}
                    onImport={handleImport}
                />
            )}

            {showStorage && (
                <StorageSettingsModal onClose={() => setShowStorage(false)} />
            )}
        </div>
    );
}
