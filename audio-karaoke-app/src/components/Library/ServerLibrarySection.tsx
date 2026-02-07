'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

interface ServerSong {
    filename: string;
    path: string;
    stems: Record<string, string>;
}

interface ServerLibrarySectionProps {
    onSelect: (song: ServerSong) => void;
}

export const ServerLibrarySection: React.FC<ServerLibrarySectionProps> = ({ onSelect }) => {
    const [songs, setSongs] = useState<ServerSong[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchSongs = async () => {
            try {
                const res = await fetch('/api/backend-library');
                if (!res.ok) throw new Error('Failed to fetch from backend');
                const data = await res.json();
                setSongs(data.songs || []);
            } catch (err) {
                console.error('Library fetch error:', err);
                setError('Could not connect to the processing server library.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchSongs();
    }, []);

    if (isLoading) return <div className="text-center py-12 text-muted-foreground animate-pulse">Scanning server library...</div>;

    if (error) {
        return (
            <div className="p-6 rounded-3xl bg-red-500/5 border border-red-500/10 text-red-400 text-sm text-center">
                {error}
            </div>
        );
    }

    if (songs.length === 0) {
        return (
            <div className="col-span-full flex flex-col items-center justify-center p-12 bg-white/5 rounded-3xl border border-white/10 text-center">
                <div className="w-16 h-16 mb-4 rounded-full bg-white/10 flex items-center justify-center text-3xl">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {songs.map((song, i) => (
                <div
                    key={i}
                    onClick={() => onSelect(song)}
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
                            Download & Play
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};
