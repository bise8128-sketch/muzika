import React, { useState, useEffect } from 'react';
import { playlistStorage } from '@/utils/storage/playlistStorage';
import type { Playlist } from '@/types/storage';

interface AddToPlaylistModalProps {
    songIds: number[];
    onClose: () => void;
    onComplete: () => void;
}

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({ songIds, onClose, onComplete }) => {
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadPlaylists();
    }, []);

    const loadPlaylists = async () => {
        try {
            const all = await playlistStorage.getAllPlaylists();
            // Only manual playlists allow adding songs
            setPlaylists(all.filter(p => p.type !== 'smart'));
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelect = async (playlistId: number) => {
        try {
            for (const songId of songIds) {
                await playlistStorage.addSongToPlaylist(playlistId, songId);
            }
            onComplete();
        } catch (e) {
            console.error(e);
            alert('Failed to add songs to playlist');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold">Add to Playlist</h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-white">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="max-h-[60vh] overflow-y-auto space-y-2">
                    {isLoading ? (
                        <div className="text-center py-8 text-muted-foreground">Loading...</div>
                    ) : playlists.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No manual playlists found. Create one in the Playlist Manager first.
                        </div>
                    ) : (
                        playlists.map(playlist => (
                            <button
                                key={playlist.id}
                                onClick={() => handleSelect(playlist.id!)}
                                className="w-full text-left p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all group"
                            >
                                <div className="font-semibold text-white group-hover:text-primary transition-colors">
                                    {playlist.name}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    {playlist.songIds.length} songs
                                </div>
                            </button>
                        ))
                    )}
                </div>

                <div className="mt-6 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-white/10 transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};
