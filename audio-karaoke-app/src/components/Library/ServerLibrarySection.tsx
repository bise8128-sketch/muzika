'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/api/ApiClient';
import { SongEntry } from '@/api/types';

interface ServerLibrarySectionProps {
    onSelect: (song: unknown) => void;
}

export const ServerLibrarySection: React.FC<ServerLibrarySectionProps> = ({ onSelect }) => {
    const [songs, setSongs] = useState<SongEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const abortController = new AbortController();
        const fetchSongs = async () => {
            setIsLoading(true);
            try {
                const data = await apiClient.getLibrary(abortController.signal);
                setSongs(data.songs || []);
            } catch (err: any) {
                if (abortController.signal.aborted) return;
                console.error(err);
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchSongs();

        return () => {
            abortController.abort();
        };
    }, []);

    const handleSelect = (song: SongEntry) => {
        // Map to internal SongEntry structure
        onSelect({
            id: -1, // Special ID for server-side songs
            title: song.filename,
            artist: '',
            duration: 0,
            originalHash: song.path,
            vocalData: undefined,
            instrumentalData: undefined,
            createdAt: Date.now(),
            stems: song.stems // Keep stems for processing
        } as any);
    };

    const handleProcess = (e: React.MouseEvent, song: SongEntry) => {
        e.stopPropagation();
        const url = `/api/backend-files/${song.path}`;
        window.location.href = `/?source=${encodeURIComponent(url)}&title=${encodeURIComponent(song.filename)}`;
    };

    if (isLoading) {
        return (
            <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-8 text-center">
                <p className="text-rose-400 font-medium">Error loading server library</p>
                <p className="text-muted-foreground text-sm mt-1">{error}</p>
            </div>
        );
    }

    if (songs.length === 0) {
        return (
            <div className="bg-white/5 border border-white/10 rounded-3xl p-12 text-center flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-3xl">
                    📂
                </div>
                <h3 className="text-xl font-bold mb-2">Server folder is empty</h3>
                <p className="text-muted-foreground max-w-sm">
                    Processed songs on the server will appear here.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">Cloud Library</h2>
                    <p className="text-muted-foreground text-sm">Songs available on the server</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {songs.map((song, i) => (
                    <div
                        key={i}
                        onClick={() => handleSelect(song)}
                        className="group relative bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary/50 rounded-2xl p-5 flex flex-col gap-3 transition-all cursor-pointer overflow-hidden"
                    >
                        <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-lg truncate pr-2 group-hover:text-primary transition-colors">
                                    {song.filename.replace(/\.[^/.]+$/, "")}
                                </h3>
                                <p className="text-xs text-muted-foreground truncate uppercase tracking-widest mt-1">
                                    {song.filename.split('.').pop()} File
                                </p>
                            </div>
                            <div className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
                                SERVER
                            </div>
                        </div>

                        <div className="flex gap-2 mt-2">
                            {Object.keys(song.stems).length > 0 && (
                                <span className="text-[10px] bg-primary/10 text-primary-foreground px-2 py-0.5 rounded border border-primary/20">
                                    {Object.keys(song.stems).length} STEMS
                                </span>
                            )}
                        </div>

                        <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                            <button className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-1.5a1 1 0 000-1.664l-3-1.5z" clipRule="evenodd" />
                                </svg>
                                Preview
                            </button>
                            <button
                                onClick={(e) => handleProcess(e, song)}
                                className="text-xs font-medium text-purple-400 hover:text-purple-300 flex items-center gap-1"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.628.288a2 2 0 01-1.643.07L6.545 14.11a2 2 0 01-1.036-1.55l-.318-2.387a2 2 0 00-.547-1.022L3.29 7.808a2 2 0 01.547-1.022l1.354-1.354a2 2 0 011.022-.547l2.387-.318a2 2 0 001.022-.547l1.354-1.354a2 2 0 011.022.547l2.387.318a2 2 0 001.022.547l1.354 1.354a2 2 0 01.547 1.022l.318 2.387a2 2 0 00.547 1.022l1.354 1.354a2 2 0 01.547 1.022l-.318 2.387a2 2 0 00.547 1.022l-1.354 1.354a2 2 0 01-1.022.547l-2.387.318a2 2 0 00-1.022.547l-1.354 1.354z" />
                                </svg>
                                Split Vocals
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
