/**
 * PlayerControls Component
 * Provides UI for play/pause, seek, and volume mixing
 */

import React, { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { LRCData } from '@/types/karaoke';

interface PlayerControlsProps {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    vocalsVolume: number;
    instrumentalVolume: number;
    lyrics?: LRCData | null;
    onPlay: () => void;
    onPause: () => void;
    onSeek: (time: number) => void;
    onSeek: (time: number) => void;
    onBalanceChange?: (balance: number) => void;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
    isPlaying,
    currentTime,
    duration,
    vocalsVolume,
    instrumentalVolume,
    lyrics,
    onPlay,
    onPause,
    onSeek,
    onBalanceChange,
}) => {
    const t = useTranslations('PlayerControls');
    const [previewTime, setPreviewTime] = useState<number | null>(null);
    const [previewLyric, setPreviewLyric] = useState<string | null>(null);
    const progressBarRef = useRef<HTMLInputElement>(null);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLInputElement>) => {
        if (!progressBarRef.current) return;

        const rect = progressBarRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;
        const percentage = Math.max(0, Math.min(1, x / width));
        const time = percentage * (duration || 1);

        setPreviewTime(time);

        if (lyrics) {
            const line = lyrics.lines.find(l => time >= l.startTime && time < l.endTime);
            setPreviewLyric(line ? line.text : null);
        }
    };

    const handleMouseLeave = () => {
        setPreviewTime(null);
        setPreviewLyric(null);
    };

    return (
        <div className="bg-white/5 backdrop-blur-md p-6 rounded-2xl border border-white/10 w-full max-w-4xl mx-auto">
            {/* Traka napretka */}
            <div className="flex items-center gap-4 mb-6 relative">
                <span className="text-xs font-mono text-gray-400 w-10 text-right">
                    {formatTime(currentTime)}
                </span>

                <div className="flex-1 relative group">
                    {/* Tooltip */}
                    {previewTime !== null && (
                        <div
                            className="absolute bottom-full left-0 mb-2 transform -translate-x-1/2 bg-black/80 backdrop-blur text-white text-xs px-2 py-1 rounded border border-white/10 whitespace-nowrap z-50 pointer-events-none"
                            style={{ left: `${(previewTime / (duration || 1)) * 100}%` }}
                        >
                            <div className="font-mono mb-1 text-center text-gray-400">{formatTime(previewTime)}</div>
                            {previewLyric && <div className="font-bold">{previewLyric}</div>}
                        </div>
                    )}

                    <input
                        ref={progressBarRef}
                        type="range"
                        min={0}
                        max={duration || 100}
                        value={currentTime}
                        onChange={(e) => onSeek(parseFloat(e.target.value))}
                        onMouseMove={handleMouseMove}
                        onMouseLeave={handleMouseLeave}
                        className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500 relative z-10"
                    />
                </div>

                <span className="text-xs font-mono text-gray-400 w-10">
                    {formatTime(duration)}
                </span>
            </div>

            {/* Kontrole */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                {/* Reprodukcija/Pauza */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={isPlaying ? onPause : onPlay}
                        className="w-16 h-16 flex items-center justify-center rounded-full bg-linear-to-r from-purple-500 to-pink-500 hover:scale-105 transition-transform shadow-lg shadow-purple-500/20"
                    >
                        {isPlaying ? (
                            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <rect x="6" y="4" width="4" height="16" />
                                <rect x="14" y="4" width="4" height="16" />
                            </svg>
                        ) : (
                            <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                            </svg>
                        )}
                    </button>
                    <div className="hidden md:block">
                        <h4 className="text-sm font-medium text-gray-300">{t('nowPlaying')}</h4>
                        <p className="text-xs text-gray-500">{t('track')}</p>
                    </div>
                </div>

                {/* Mješalica */}
                <div className="flex-1 flex flex-col gap-4">
                    {/* Crossfader Balance */}
                    <div className="px-4">
                        <div className="flex justify-between mb-1 text-[10px] font-bold uppercase tracking-tighter text-gray-400">
                            <span>{t('instrumental')}</span>
                            <span>{t('mix')}</span>
                            <span>{t('vocals')}</span>
                        </div>
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={vocalsVolume / (vocalsVolume + instrumentalVolume || 1)}
                            onChange={(e) => onBalanceChange?.(parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
