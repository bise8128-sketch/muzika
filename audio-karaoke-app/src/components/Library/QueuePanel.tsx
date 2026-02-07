'use client';

import React from 'react';
import type { SongEntry } from '@/types/storage';

interface QueuePanelProps {
    songs: SongEntry[];
    currentIndex: number;
    onPlayAtIndex: (index: number) => void;
    onRemoveFromQueue: (index: number) => void;
    onClearQueue: () => void;
    onReorderQueue: (fromIndex: number, toIndex: number) => void;
}

export const QueuePanel: React.FC<QueuePanelProps> = ({
    songs,
    currentIndex,
    onPlayAtIndex,
    onRemoveFromQueue,
    onClearQueue,
    onReorderQueue
}) => {
    const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);

    const handleDragStart = (index: number) => {
        setDraggedIndex(index);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;
        onReorderQueue(draggedIndex, index);
        setDraggedIndex(index);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
    };

    if (songs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 bg-white/5 rounded-2xl border border-white/10 text-center">
                <div className="w-12 h-12 mb-3 rounded-full bg-white/10 flex items-center justify-center text-2xl">
                    🎵
                </div>
                <h3 className="text-lg font-semibold mb-1">Queue is empty</h3>
                <p className="text-sm text-muted-foreground">
                    Add songs to start building your queue
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Queue Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-lg font-bold">Queue</h3>
                    <p className="text-sm text-muted-foreground">
                        {songs.length} song{songs.length !== 1 ? 's' : ''}
                    </p>
                </div>
                {songs.length > 0 && (
                    <button
                        onClick={onClearQueue}
                        className="px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                    >
                        Clear All
                    </button>
                )}
            </div>

            {/* Queue List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                {songs.map((song, index) => (
                    <div
                        key={song.id}
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                        className={`
                            group relative flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer
                            ${index === currentIndex
                                ? 'bg-primary/20 border-primary/50'
                                : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                            }
                            ${draggedIndex === index ? 'opacity-50' : ''}
                        `}
                        onClick={() => onPlayAtIndex(index)}
                    >
                        {/* Drag Handle */}
                        <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-white transition-colors">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                            </svg>
                        </div>

                        {/* Song Number */}
                        <div className={`
                            w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                            ${index === currentIndex
                                ? 'bg-primary text-white'
                                : 'bg-white/10 text-muted-foreground'
                            }
                        `}>
                            {index + 1}
                        </div>

                        {/* Song Info */}
                        <div className="flex-1 min-w-0">
                            <h4 className={`
                                font-medium truncate
                                ${index === currentIndex ? 'text-primary' : 'text-white'}
                            `}>
                                {song.title}
                            </h4>
                            <p className="text-sm text-muted-foreground truncate">
                                {song.artist || 'Unknown Artist'}
                            </p>
                        </div>

                        {/* Duration */}
                        <div className="text-sm text-muted-foreground whitespace-nowrap">
                            {Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}
                        </div>

                        {/* Remove Button */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onRemoveFromQueue(index);
                            }}
                            className="p-2 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                            aria-label="Remove from queue"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        {/* Currently Playing Indicator */}
                        {index === currentIndex && (
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-xl" />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
