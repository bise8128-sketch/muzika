/**
 * Playback queue management hook
 * Manages queue state with persistence and playback controls
 */

import { useState, useEffect, useCallback } from 'react';
import { queueStorage } from '@/utils/storage/queueStorage';
import { songsStorage } from '@/utils/storage/songsStorage';
import type { QueueState, SongEntry } from '@/types/storage';

interface UsePlaybackQueueReturn {
    queue: QueueState;
    songs: SongEntry[];
    currentSong: SongEntry | null;
    isLoading: boolean;
    playNext: () => void;
    playPrevious: () => void;
    playAtIndex: (index: number) => void;
    addToQueue: (songId: number) => Promise<void>;
    addSongsToQueue: (songIds: number[]) => Promise<void>;
    removeFromQueue: (index: number) => Promise<void>;
    setShuffle: (enabled: boolean) => Promise<void>;
    setRepeat: (mode: 'off' | 'all' | 'one') => Promise<void>;
    clearQueue: () => Promise<void>;
    loadQueue: () => Promise<void>;
}

export function usePlaybackQueue(): UsePlaybackQueueReturn {
    const [queue, setQueue] = useState<QueueState>({
        songIds: [],
        currentIndex: -1,
        shuffleMode: 'off',
        repeatMode: 'off',
        updatedAt: Date.now()
    });
    const [songs, setSongs] = useState<SongEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Load queue on mount
    useEffect(() => {
        loadQueue();
    }, []);

    // Load songs when queue songIds change
    useEffect(() => {
        const loadSongs = async () => {
            if (queue.songIds.length === 0) {
                setSongs([]);
                return;
            }

            const loadedSongs: SongEntry[] = [];
            for (const songId of queue.songIds) {
                const song = await songsStorage.getSong(songId);
                if (song) {
                    loadedSongs.push(song);
                }
            }
            setSongs(loadedSongs);
        };

        loadSongs();
    }, [queue.songIds]);

    const loadQueue = useCallback(async () => {
        setIsLoading(true);
        try {
            const loadedQueue = await queueStorage.getQueueOrDefault();
            setQueue(loadedQueue);
        } catch (error) {
            console.error('Failed to load queue:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const playNext = useCallback(async () => {
        if (songs.length === 0) return;

        let nextIndex = queue.currentIndex + 1;

        // Handle repeat modes
        if (queue.repeatMode === 'one') {
            nextIndex = queue.currentIndex;
        } else if (queue.repeatMode === 'all' && nextIndex >= songs.length) {
            nextIndex = 0;
        } else if (nextIndex >= songs.length) {
            // End of queue, no repeat
            return;
        }

        await queueStorage.updateCurrentIndex(nextIndex);
        setQueue(prev => ({ ...prev, currentIndex: nextIndex }));
    }, [queue.currentIndex, queue.repeatMode, songs.length]);

    const playPrevious = useCallback(async () => {
        if (songs.length === 0) return;

        let prevIndex = queue.currentIndex - 1;

        // Handle repeat modes
        if (queue.repeatMode === 'one') {
            prevIndex = queue.currentIndex;
        } else if (queue.repeatMode === 'all' && prevIndex < 0) {
            prevIndex = songs.length - 1;
        } else if (prevIndex < 0) {
            // Beginning of queue, no repeat
            return;
        }

        await queueStorage.updateCurrentIndex(prevIndex);
        setQueue(prev => ({ ...prev, currentIndex: prevIndex }));
    }, [queue.currentIndex, queue.repeatMode, songs.length]);

    const playAtIndex = useCallback(async (index: number) => {
        if (index < 0 || index >= songs.length) return;

        await queueStorage.updateCurrentIndex(index);
        setQueue(prev => ({ ...prev, currentIndex: index }));
    }, [songs.length]);

    const addToQueue = useCallback(async (songId: number) => {
        await queueStorage.addSongToQueue(songId);
        const updatedQueue = await queueStorage.getQueueOrDefault();
        setQueue(updatedQueue);
    }, []);

    const addSongsToQueue = useCallback(async (songIds: number[]) => {
        const current = await queueStorage.getQueueOrDefault();
        const newSongIds = [...current.songIds, ...songIds];
        await queueStorage.updateQueueSongs(newSongIds);
        setQueue(prev => ({ ...prev, songIds: newSongIds }));
    }, []);

    const removeFromQueue = useCallback(async (index: number) => {
        await queueStorage.removeSongFromQueue(index);
        const updatedQueue = await queueStorage.getQueueOrDefault();
        setQueue(updatedQueue);
    }, []);

    const setShuffle = useCallback(async (enabled: boolean) => {
        const mode = enabled ? 'on' : 'off';
        await queueStorage.updateShuffleMode(mode);
        setQueue(prev => ({ ...prev, shuffleMode: mode }));
    }, []);

    const setRepeat = useCallback(async (mode: 'off' | 'all' | 'one') => {
        await queueStorage.updateRepeatMode(mode);
        setQueue(prev => ({ ...prev, repeatMode: mode }));
    }, []);

    const clearQueue = useCallback(async () => {
        await queueStorage.clearQueue();
        setQueue({
            songIds: [],
            currentIndex: -1,
            shuffleMode: 'off',
            repeatMode: 'off',
            updatedAt: Date.now()
        });
    }, []);

    const currentSong = queue.currentIndex >= 0 && queue.currentIndex < songs.length
        ? songs[queue.currentIndex]
        : null;

    return {
        queue,
        songs,
        currentSong,
        isLoading,
        playNext,
        playPrevious,
        playAtIndex,
        addToQueue,
        addSongsToQueue,
        removeFromQueue,
        setShuffle,
        setRepeat,
        clearQueue,
        loadQueue
    };
}
