/**
 * PlayerControls Component
 * Provides UI for play/pause, seek, and volume mixing
 */

import React from 'react';

interface PlayerControlsProps {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    vocalsVolume: number;
    instrumentalVolume: number;
    onPlay: () => void;
    onPause: () => void;
    onSeek: (time: number) => void;
    onVocalsVolumeChange: (volume: number) => void;
    onInstrumentalVolumeChange: (volume: number) => void;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
    isPlaying,
    currentTime,
    duration,
    vocalsVolume,
    instrumentalVolume,
    onPlay,
    onPause,
    onSeek,
    onVocalsVolumeChange,
    onInstrumentalVolumeChange,
}) => {
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="bg-white/5 backdrop-blur-md p-6 rounded-2xl border border-white/10 w-full max-w-4xl mx-auto">
            {/* Progress Bar */}
            <div className="flex items-center gap-4 mb-6">
                <span className="text-xs font-mono text-gray-400 w-10 text-right">
                    {formatTime(currentTime)}
                </span>
                <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    value={currentTime}
                    onChange={(e) => onSeek(parseFloat(e.target.value))}
                    className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <span className="text-xs font-mono text-gray-400 w-10">
                    {formatTime(duration)}
                </span>
            </div>

            {/* Controls */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                {/* Play/Pause */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={isPlaying ? onPause : onPlay}
                        className="w-16 h-16 flex items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-pink-500 hover:scale-105 transition-transform shadow-lg shadow-purple-500/20"
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
                        <h4 className="text-sm font-medium text-gray-300">Now Playing</h4>
                        <p className="text-xs text-gray-500">Separated Audio Track</p>
                    </div>
                </div>

                {/* Mixer */}
                <div className="flex flex-col sm:flex-row gap-8 flex-1 justify-end w-full sm:w-auto">
                    {/* Vocals Volume */}
                    <div className="flex-1 max-w-[200px]">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-purple-400 uppercase tracking-wider flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                                Vocals
                            </span>
                            <span className="text-xs text-gray-500">{Math.round(vocalsVolume * 100)}%</span>
                        </div>
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={vocalsVolume}
                            onChange={(e) => onVocalsVolumeChange(parseFloat(e.target.value))}
                            className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-400"
                        />
                    </div>

                    {/* Instrumental Volume */}
                    <div className="flex-1 max-w-[200px]">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-pink-400 uppercase tracking-wider flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-pink-400"></span>
                                Instrumental
                            </span>
                            <span className="text-xs text-gray-500">{Math.round(instrumentalVolume * 100)}%</span>
                        </div>
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={instrumentalVolume}
                            onChange={(e) => onInstrumentalVolumeChange(parseFloat(e.target.value))}
                            className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-pink-400"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
