/**
 * PlayerControls Component
 * Provides UI for play/pause, seek, and volume mixing
 */

import React, { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { LRCData } from '@/types/karaoke';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Music, Volume2, Settings2 } from 'lucide-react';

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

    const progress = (currentTime / (duration || 1)) * 100;

    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-premium p-6 rounded-3xl w-full max-w-4xl mx-auto"
        >
            {/* Progress Bar Area */}
            <div className="flex items-center gap-6 mb-8 relative">
                <span className="text-xs font-black text-white/30 w-12 text-right tracking-tighter">
                    {formatTime(currentTime)}
                </span>

                <div className="flex-1 relative group">
                    {/* Tooltip */}
                    <AnimatePresence>
                        {previewTime !== null && (
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.9 }}
                                className="absolute bottom-full left-0 mb-3 transform -translate-x-1/2 glass-premium p-3 rounded-xl border border-white/10 whitespace-nowrap z-50 pointer-events-none shadow-2xl"
                                style={{ left: `${(previewTime / (duration || 1)) * 100}%` }}
                            >
                                <div className="font-black mb-1 text-center text-primary text-[10px] tracking-widest">{formatTime(previewTime)}</div>
                                {previewLyric && <div className="font-bold text-xs text-white/90">{previewLyric}</div>}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Custom Progress Bar Background */}
                    <div className="absolute inset-0 h-2 my-auto bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                            className="h-full bg-linear-to-r from-purple-500 to-pink-500 shadow-[0_0_15px_rgba(147,51,234,0.3)]"
                            initial={false}
                            animate={{ width: `${progress}%` }}
                            transition={{ type: "spring", bounce: 0, duration: 0.1 }}
                        />
                    </div>

                    <input
                        ref={progressBarRef}
                        type="range"
                        min={0}
                        max={duration || 100}
                        value={currentTime}
                        onChange={(e) => onSeek(parseFloat(e.target.value))}
                        onMouseMove={handleMouseMove}
                        onMouseLeave={handleMouseLeave}
                        className="w-full h-2 rounded-lg appearance-none cursor-pointer opacity-0 relative z-10"
                    />
                </div>

                <span className="text-xs font-black text-white/30 w-12 tracking-tighter">
                    {formatTime(duration)}
                </span>
            </div>

            {/* Controls Layer */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-10">
                {/* Playback Primary */}
                <div className="flex items-center gap-6">
                    <motion.button
                        data-testid="play-pause-button"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={isPlaying ? onPause : onPlay}
                        className="w-20 h-20 flex items-center justify-center rounded-3xl bg-linear-to-br from-primary to-accent text-white shadow-[0_8px_32px_rgba(147,51,234,0.4)] relative overflow-hidden group"
                    >
                        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <AnimatePresence mode="wait">
                            {isPlaying ? (
                                <motion.div
                                    key="pause"
                                    initial={{ opacity: 0, rotate: -90 }}
                                    animate={{ opacity: 1, rotate: 0 }}
                                    exit={{ opacity: 0, rotate: 90 }}
                                >
                                    <Pause className="w-8 h-8 fill-current" />
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="play"
                                    initial={{ opacity: 0, rotate: 90 }}
                                    animate={{ opacity: 1, rotate: 0 }}
                                    exit={{ opacity: 0, rotate: -90 }}
                                    className="ml-1"
                                >
                                    <Play className="w-8 h-8 fill-current" />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.button>

                    <div className="hidden md:block">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-1 flex items-center gap-2">
                             <Music className="w-3 h-3 text-primary" />
                             {t('nowPlaying')}
                        </div>
                        <p className="text-sm font-bold text-white/90">{lyrics?.metadata?.title || t('track')}</p>
                    </div>
                </div>

                {/* Mixing Mixer */}
                <div className="flex-1 max-w-md w-full">
                    <div className="flex justify-between mb-3 text-[10px] font-black uppercase tracking-widest text-white/30">
                        <span className="flex items-center gap-1.5"><Settings2 className="w-3 h-3" /> {t('instrumental')}</span>
                        <span className="text-primary italic">Live Mix</span>
                        <span className="flex items-center gap-1.5">{t('vocals')} <Volume2 className="w-3 h-3" /></span>
                    </div>
                    
                    <div className="relative pt-1">
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={vocalsVolume / (vocalsVolume + instrumentalVolume || 1)}
                            onChange={(e) => onBalanceChange?.(parseFloat(e.target.value))}
                            className="range-premium"
                        />
                    </div>
                </div>
            </div>
        </motion.div>
    );
};
