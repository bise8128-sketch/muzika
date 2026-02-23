'use client';

/**
 * LyricSyncReview — Review and edit AI-generated lyric sync results.
 *
 * Allows the user to:
 * - See the aligned lyrics with timestamps
 * - Adjust timing by dragging timestamps
 * - Accept or reject the sync
 */

import React, { useState, useCallback } from 'react';
import type { LyricLine } from '@/types/karaoke';
import type { SyncResult, SyncProgress } from '@/utils/ml/lyricSync';
import { generateLRCContent, downloadLRCFile } from '@/utils/karaoke/lrcExport';
import { useTranslations } from 'next-intl';

interface LyricSyncReviewProps {
    result: SyncResult | null;
    progress: SyncProgress | null;
    isProcessing: boolean;
    error: string | null;
    onAccept: (lines: LyricLine[]) => void;
    onReject: () => void;
    onStartSync: () => void;
}

const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
};

export const LyricSyncReview: React.FC<LyricSyncReviewProps> = ({
    result,
    progress,
    isProcessing,
    error,
    onAccept,
    onReject,
    onStartSync,
}) => {
    const t = useTranslations('LyricSync');
    const [editedLines, setEditedLines] = useState<LyricLine[] | null>(null);

    // Initialize editable state from result
    React.useEffect(() => {
        if (result) {
            setEditedLines([...result.lines]);
        }
    }, [result]);

    const handleTimestampChange = useCallback((lineIdx: number, newTime: number) => {
        setEditedLines(prev => {
            if (!prev) return prev;
            const updated = [...prev];
            updated[lineIdx] = { ...updated[lineIdx], startTime: newTime };
            return updated;
        });
    }, []);

    const handleExportLRC = useCallback(() => {
        if (!editedLines) return;
        const content = generateLRCContent(editedLines, { title: 'AI Synced Lyrics', by: 'Muzika' });
        downloadLRCFile(content, 'synced_lyrics.lrc');
    }, [editedLines]);

    // Processing view
    if (isProcessing && progress) {
        return (
            <div className="rounded-2xl bg-linear-to-b from-white/8 to-white/3 border border-white/10 p-6 space-y-4">
                <h3 className="text-sm font-semibold text-white/90 flex items-center gap-2">
                    ⚡ {t('syncing') || 'AI Lyric Sync'}
                </h3>

                <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-white/50">
                        <span>{progress.message}</span>
                        <span>{Math.round(progress.progress * 100)}%</span>
                    </div>
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-purple-500 rounded-full transition-all duration-300"
                            style={{ width: `${progress.progress * 100}%` }}
                        />
                    </div>
                </div>
            </div>
        );
    }

    // Error view
    if (error) {
        return (
            <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-4 flex items-center gap-3">
                <span className="text-red-400 text-sm">⚠️ {error}</span>
                <button
                    onClick={onStartSync}
                    className="ml-auto px-3 py-1 text-xs font-medium text-white/60 bg-white/5 rounded-lg hover:bg-white/10"
                >
                    {t('retry') || 'Retry'}
                </button>
            </div>
        );
    }

    // No result yet — show start button
    if (!result || !editedLines) {
        return (
            <button
                onClick={onStartSync}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/20 hover:bg-purple-500/30 transition-all text-sm font-semibold"
            >
                ⚡ {t('startSync') || 'Auto-Sync Lyrics with AI'}
            </button>
        );
    }

    // Review view
    return (
        <div className="rounded-2xl bg-linear-to-b from-white/8 to-white/3 border border-white/10 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 flex items-center justify-between border-b border-white/5">
                <div className="flex items-center gap-2">
                    <span className="text-lg">⚡</span>
                    <h3 className="text-sm font-semibold text-white/90">
                        {t('reviewTitle') || 'Review Sync Results'}
                    </h3>
                    <span className="text-xs text-white/30 font-mono">
                        {Math.round(result.confidence * 100)}% {t('confidence') || 'confidence'}
                    </span>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleExportLRC}
                        className="px-3 py-1.5 text-xs font-medium text-white/70 bg-white/10 rounded-lg hover:bg-white/20 transition-all flex items-center gap-1"
                        title={t('exportLrc') || 'Export LRC File'}
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Export
                    </button>
                    <button
                        onClick={onReject}
                        className="px-3 py-1.5 text-xs font-medium text-white/50 bg-white/5 rounded-lg hover:bg-white/10 hover:text-white/70 transition-all"
                    >
                        {t('reject') || 'Discard'}
                    </button>
                    <button
                        onClick={() => onAccept(editedLines)}
                        className="px-3 py-1.5 text-xs font-medium text-purple-300 bg-purple-500/20 rounded-lg hover:bg-purple-500/30 transition-all ring-1 ring-purple-500/30"
                    >
                        {t('accept') || 'Apply Sync'}
                    </button>
                </div>
            </div>

            {/* Lines list */}
            <div className="max-h-64 overflow-y-auto divide-y divide-white/5">
                {editedLines.map((line, idx) => (
                    <div key={idx} className="flex items-center gap-3 px-4 py-2 hover:bg-white/5 transition-colors group">
                        {/* Timestamp */}
                        <span className="font-mono text-xs text-purple-400/70 min-w-[65px]">
                            {formatTime(line.startTime)}
                        </span>

                        {/* Lyric text */}
                        <span className="flex-1 text-sm text-white/80 truncate">
                            {line.text}
                        </span>

                        {/* Fine-tune controls */}
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={() => handleTimestampChange(idx, Math.max(0, line.startTime - 0.1))}
                                className="w-6 h-6 rounded bg-white/5 text-white/30 hover:bg-white/10 hover:text-white/60 text-xs flex items-center justify-center"
                                title="-0.1s"
                            >
                                ◀
                            </button>
                            <button
                                onClick={() => handleTimestampChange(idx, line.startTime + 0.1)}
                                className="w-6 h-6 rounded bg-white/5 text-white/30 hover:bg-white/10 hover:text-white/60 text-xs flex items-center justify-center"
                                title="+0.1s"
                            >
                                ▶
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
