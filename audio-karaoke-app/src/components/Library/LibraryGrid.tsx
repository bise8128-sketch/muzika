'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { SongEntry, FilterType, SortOption, SortOrder } from '@/types/storage';
import { songsStorage } from '@/utils/storage/songsStorage';
import { useRouter } from '@/i18n/routing';
import { LibraryPlayer } from './LibraryPlayer';
import { SearchBar } from './SearchBar';
import { FilterControls } from './FilterControls';

export const LibraryGrid = () => {
    const [allSongs, setAllSongs] = useState<SongEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [playingSong, setPlayingSong] = useState<SongEntry | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<FilterType>('all');
    const [sortOption, setSortOption] = useState<SortOption>('date');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
    const [selectedSongs, setSelectedSongs] = useState<Set<number>>(new Set());
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const router = useRouter();

    const loadSongs = async () => {
        setIsLoading(true);
        try {
            const songs = await songsStorage.getAllSongs();
            setAllSongs(songs);
        } catch (e) {
            console.error("Failed to load songs", e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadSongs();
    }, []);

    // Filter, search, and sort songs
    const filteredSongs = useMemo(() => {
        let songs = [...allSongs];

        // Apply filter
        if (filterType !== 'all') {
            songs = songs.filter(song => song.type === filterType);
        }

        // Apply search
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            songs = songs.filter(song =>
                song.title.toLowerCase().includes(query) ||
                (song.artist && song.artist.toLowerCase().includes(query))
            );
        }

        // Apply sort
        songs.sort((a, b) => {
            let comparison = 0;

            switch (sortOption) {
                case 'title':
                    comparison = a.title.localeCompare(b.title);
                    break;
                case 'artist':
                    const artistA = a.artist || '';
                    const artistB = b.artist || '';
                    comparison = artistA.localeCompare(artistB);
                    break;
                case 'duration':
                    comparison = a.duration - b.duration;
                    break;
                case 'date':
                default:
                    comparison = a.createdAt - b.createdAt;
                    break;
            }

            return sortOrder === 'asc' ? comparison : -comparison;
        });

        return songs;
    }, [allSongs, searchQuery, filterType, sortOption, sortOrder]);

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

    const handleSelectSong = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        const newSelected = new Set(selectedSongs);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedSongs(newSelected);
    };

    const handleSelectAll = () => {
        if (selectedSongs.size === filteredSongs.length) {
            setSelectedSongs(new Set());
        } else {
            setSelectedSongs(new Set(filteredSongs.map(s => s.id!)));
        }
    };

    const handleDeleteSelected = async () => {
        if (selectedSongs.size === 0) return;
        if (confirm(`Are you sure you want to delete ${selectedSongs.size} song(s)?`)) {
            for (const id of selectedSongs) {
                await songsStorage.deleteSong(id);
            }
            setSelectedSongs(new Set());
            setIsSelectionMode(false);
            loadSongs();
        }
    };

    const handleAddSelectedToQueue = () => {
        // This would integrate with usePlaybackQueue hook
        console.log('Add to queue:', Array.from(selectedSongs));
        setSelectedSongs(new Set());
        setIsSelectionMode(false);
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

            {/* Search and Filter Controls */}
            <div className="mb-6 space-y-4">
                <SearchBar
                    onSearch={setSearchQuery}
                    placeholder="Search songs by title or artist..."
                />
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <FilterControls
                        filterType={filterType}
                        sortOption={sortOption}
                        sortOrder={sortOrder}
                        onFilterChange={setFilterType}
                        onSortChange={setSortOption}
                        onSortOrderToggle={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    />
                    <div className="flex items-center gap-2">
                        {isSelectionMode ? (
                            <>
                                <button
                                    onClick={handleSelectAll}
                                    className="px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                                >
                                    {selectedSongs.size === filteredSongs.length ? 'Deselect All' : 'Select All'}
                                </button>
                                {selectedSongs.size > 0 && (
                                    <>
                                        <button
                                            onClick={handleAddSelectedToQueue}
                                            className="px-3 py-1.5 text-sm bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors"
                                        >
                                            Add to Queue ({selectedSongs.size})
                                        </button>
                                        <button
                                            onClick={handleDeleteSelected}
                                            className="px-3 py-1.5 text-sm bg-destructive hover:bg-destructive/90 text-white rounded-lg transition-colors"
                                        >
                                            Delete ({selectedSongs.size})
                                        </button>
                                    </>
                                )}
                                <button
                                    onClick={() => {
                                        setIsSelectionMode(false);
                                        setSelectedSongs(new Set());
                                    }}
                                    className="px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setIsSelectionMode(true)}
                                className="px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                            >
                                Select Songs
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Results Count */}
            <div className="mb-4 text-sm text-muted-foreground">
                Showing {filteredSongs.length} song{filteredSongs.length !== 1 ? 's' : ''}
                {searchQuery && ` matching "${searchQuery}"`}
                {filterType !== 'all' && ` (${filterType === 'ai_separated' ? 'AI Separated' : 'Direct Karaoke'})`}
            </div>

            {/* Song Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredSongs.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center p-12 bg-white/5 rounded-3xl border border-white/10 text-center">
                        <div className="w-16 h-16 mb-4 rounded-full bg-white/10 flex items-center justify-center text-3xl">
                            🎵
                        </div>
                        <h3 className="text-xl font-bold mb-2">No songs found</h3>
                        <p className="text-muted-foreground mb-6 max-w-sm">
                            {searchQuery || filterType !== 'all'
                                ? 'Try adjusting your search or filter criteria.'
                                : 'Upload songs to start building your karaoke collection.'}
                        </p>
                        {!searchQuery && filterType === 'all' && (
                            <button
                                onClick={() => router.push('/')}
                                className="px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold transition-colors"
                            >
                                Upload Songs
                            </button>
                        )}
                    </div>
                )}

                {filteredSongs.map(song => (
                    <div
                        key={song.id}
                        onClick={() => handlePlay(song)}
                        className={`
                            group relative bg-white/5 hover:bg-white/10 border rounded-2xl p-5 flex flex-col gap-3 transition-all cursor-pointer overflow-hidden
                            ${selectedSongs.has(song.id!) ? 'border-primary bg-primary/10' : 'border-white/10 hover:border-primary/50'}
                        `}
                    >
                        {/* Selection Checkbox */}
                        {isSelectionMode && (
                            <div
                                onClick={(e) => handleSelectSong(e, song.id!)}
                                className="absolute top-3 right-3 z-10"
                            >
                                <div className={`
                                    w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
                                    ${selectedSongs.has(song.id!)
                                        ? 'bg-primary border-primary'
                                        : 'border-white/30 hover:border-primary'
                                    }
                                `}>
                                    {selectedSongs.has(song.id!) && (
                                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-between items-start pr-8">
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
