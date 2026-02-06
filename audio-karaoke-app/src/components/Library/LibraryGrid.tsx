'use client';

import React, { useEffect, useState } from 'react';
import { SongEntry } from '@/types/storage';
import { songsStorage } from '@/utils/storage/songsStorage';
import { useRouter } from '@/i18n/routing';
import { LibraryPlayer } from './LibraryPlayer';

export const LibraryGrid = () => {
    const [songs, setSongs] = useState<SongEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [playingSong, setPlayingSong] = useState<SongEntry | null>(null);
    const router = useRouter();

    const loadSongs = async () => {
        setIsLoading(true);
        try {
            const allSongs = await songsStorage.getAllSongs();
            setSongs(allSongs);
        } catch (e) {
            console.error("Failed to load songs", e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadSongs();
    }, []);

    const handleDelete = async (e: React.MouseEvent, id?: number) => {
        e.stopPropagation();
        if (!id) return;
        if (confirm('Are you sure you want to delete this song?')) {
            await songsStorage.deleteSong(id);
            loadSongs();
        }
    };

    const handlePlay = (song: SongEntry) => {
        setPlayingSong(song);
    };

    if (isLoading) return <div className="text-center py-12 text-muted-foreground">Loading library...</div>;

    return (
        <div className="w-full">
            {playingSong && (
                <LibraryPlayer
                    song={playingSong}
                    onClose={() => setPlayingSong(null)}
                />
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {songs.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center p-12 bg-white/5 rounded-3xl border border-white/10 text-center">
                        <div className="w-16 h-16 mb-4 rounded-full bg-white/10 flex items-center justify-center text-3xl">
                            🎵
                        </div>
                        <h3 className="text-xl font-bold mb-2">Your library is empty</h3>
                        <p className="text-muted-foreground mb-6 max-w-sm">
                            Upload songs to start building your karaoke collection.
                        </p>
                        <button
                            onClick={() => router.push('/')}
                            className="px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold transition-colors"
                        >
                            Upload Songs
                        </button>
                    </div>
                )}

                {songs.map(song => (
                    <div
                        key={song.id}
                        onClick={() => handlePlay(song)}
                        className="group relative bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary/50 rounded-2xl p-5 flex flex-col gap-3 transition-all cursor-pointer overflow-hidden"
                    >
                        <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-lg truncate pr-2 group-hover:text-primary transition-colors">
                                    {song.title}
                                </h3>
                                <p className="text-sm text-muted-foreground truncate">
                                    {song.artist || 'Unknown Artist'}
                                </p>
                            </div>
                            <div className={`
                                px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider
                                ${song.type === 'ai_separated' ? 'bg-purple-500/20 text-purple-300' : 'bg-emerald-500/20 text-emerald-300'}
                            `}>
                                {song.type === 'ai_separated' ? 'AI' : 'KARAOKE'}
                            </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                            <div className="flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}
                            </div>
                            <div>
                                {new Date(song.createdAt).toLocaleDateString()}
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                            <button
                                className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1"
                            >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-1.5a1 1 0 000-1.664l-3-1.5z" clipRule="evenodd" />
                                </svg>
                                Play Now
                            </button>

                            <button
                                onClick={(e) => handleDelete(e, song.id)}
                                className="p-2 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                                aria-label="Delete song"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
