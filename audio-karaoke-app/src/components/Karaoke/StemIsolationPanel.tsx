'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { PlaybackController } from '@/utils/audio/playback/PlaybackCore';
import type { StemSettings, StemPreset } from '@/types/audio';
import { useTranslations } from 'next-intl';

interface StemIsolationPanelProps {
    controller: PlaybackController;
}

interface StemSliderProps {
    stem: StemSettings;
    index: number;
    onVolumeChange: (index: number, volume: number) => void;
    onMuteToggle: (index: number) => void;
    onSoloToggle: (index: number) => void;
}

const PRESETS: { id: StemPreset; label: string; icon: string }[] = [
    { id: 'full-mix', label: 'Full Mix', icon: '🎶' },
    { id: 'karaoke', label: 'Karaoke', icon: '🎤' },
    { id: 'a-capella', label: 'A Capella', icon: '🗣️' },
    { id: 'drums-only', label: 'Drums Only', icon: '🥁' },
    { id: 'bass-only', label: 'Bass Only', icon: '🎸' },
];

const StemSlider: React.FC<StemSliderProps> = ({
    stem,
    index,
    onVolumeChange,
    onMuteToggle,
    onSoloToggle,
}) => {
    const effectivelyMuted = stem.muted || stem.volume === 0;

    return (
        <div className="flex items-center gap-3 p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group">
            {/* Icon + Label */}
            <div className="flex items-center gap-2 min-w-[90px]">
                <span className="text-lg">{stem.icon}</span>
                <span className="text-sm font-medium text-white/80 truncate">
                    {stem.label}
                </span>
            </div>

            {/* Volume Slider */}
            <div className="flex-1 relative">
                <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(stem.volume * 100)}
                    onChange={e => onVolumeChange(index, parseInt(e.target.value) / 100)}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer
                        bg-white/10
                        [&::-webkit-slider-thumb]:appearance-none
                        [&::-webkit-slider-thumb]:w-4
                        [&::-webkit-slider-thumb]:h-4
                        [&::-webkit-slider-thumb]:rounded-full
                        [&::-webkit-slider-thumb]:bg-purple-400
                        [&::-webkit-slider-thumb]:shadow-lg
                        [&::-webkit-slider-thumb]:shadow-purple-500/30
                        [&::-webkit-slider-thumb]:hover:bg-purple-300
                        [&::-webkit-slider-thumb]:transition-all"
                    style={{
                        background: `linear-gradient(to right, rgb(192 132 252) ${stem.volume * 100}%, rgba(255,255,255,0.1) ${stem.volume * 100}%)`,
                    }}
                    disabled={effectivelyMuted}
                />
                <span className="absolute right-0 -top-5 text-xs text-white/40 opacity-0 group-hover:opacity-100 transition-opacity">
                    {Math.round(stem.volume * 100)}%
                </span>
            </div>

            {/* Mute Button */}
            <button
                onClick={() => onMuteToggle(index)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all
                    ${stem.muted
                        ? 'bg-red-500/30 text-red-400 ring-1 ring-red-500/50'
                        : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70'
                    }`}
                title={stem.muted ? 'Unmute' : 'Mute'}
            >
                M
            </button>

            {/* Solo Button */}
            <button
                onClick={() => onSoloToggle(index)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all
                    ${stem.solo
                        ? 'bg-yellow-500/30 text-yellow-400 ring-1 ring-yellow-500/50'
                        : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70'
                    }`}
                title={stem.solo ? 'Unsolo' : 'Solo'}
            >
                S
            </button>
        </div>
    );
};

export const StemIsolationPanel: React.FC<StemIsolationPanelProps> = ({ controller }) => {
    const t = useTranslations('StemIsolation');
    const [stems, setStems] = useState<StemSettings[]>([]);
    const [activePreset, setActivePreset] = useState<StemPreset>('full-mix');
    const [isExpanded, setIsExpanded] = useState(true);

    // Sync state from controller
    const refreshStems = useCallback(() => {
        setStems(controller.getStemStates());
    }, [controller]);

    useEffect(() => {
        refreshStems();
    }, [refreshStems]);

    const handleVolumeChange = useCallback((index: number, volume: number) => {
        controller.setStemVolume(index, volume);
        setActivePreset('full-mix'); // custom = no preset
        refreshStems();
    }, [controller, refreshStems]);

    const handleMuteToggle = useCallback((index: number) => {
        controller.toggleStemMute(index);
        setActivePreset('full-mix');
        refreshStems();
    }, [controller, refreshStems]);

    const handleSoloToggle = useCallback((index: number) => {
        controller.toggleStemSolo(index);
        setActivePreset('full-mix');
        refreshStems();
    }, [controller, refreshStems]);

    const handlePreset = useCallback((preset: StemPreset) => {
        controller.applyStemPreset(preset);
        setActivePreset(preset);
        refreshStems();
    }, [controller, refreshStems]);

    if (stems.length === 0) return null;

    return (
        <div className="rounded-2xl bg-linear-to-b from-white/8 to-white/3 border border-white/10 backdrop-blur-sm overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <span className="text-lg">🎛️</span>
                    <h3 className="text-sm font-semibold text-white/90">
                        {t('title') || 'Stem Isolation'}
                    </h3>
                </div>
                <span className={`text-white/40 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                    ▾
                </span>
            </button>

            {isExpanded && (
                <div className="px-4 pb-4 space-y-3">
                    {/* Presets */}
                    <div className="flex gap-1.5 flex-wrap">
                        {PRESETS.filter(p => {
                            // Only show drum/bass presets if those stems exist
                            if (p.id === 'drums-only') return stems.some(s => s.type === 'drums');
                            if (p.id === 'bass-only') return stems.some(s => s.type === 'bass');
                            return true;
                        }).map(preset => (
                            <button
                                key={preset.id}
                                onClick={() => handlePreset(preset.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                                    ${activePreset === preset.id
                                        ? 'bg-purple-500/30 text-purple-300 ring-1 ring-purple-500/40'
                                        : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70'
                                    }`}
                            >
                                {preset.icon} {preset.label}
                            </button>
                        ))}
                    </div>

                    {/* Stem Sliders */}
                    <div className="space-y-1.5">
                        {stems.map((stem, index) => (
                            <StemSlider
                                key={`${stem.type}-${index}`}
                                stem={stem}
                                index={index}
                                onVolumeChange={handleVolumeChange}
                                onMuteToggle={handleMuteToggle}
                                onSoloToggle={handleSoloToggle}
                            />
                        ))}
                    </div>

                    {/* Reset */}
                    <button
                        onClick={() => handlePreset('full-mix')}
                        className="w-full py-2 rounded-lg text-xs font-medium text-white/40 bg-white/5 hover:bg-white/10 hover:text-white/60 transition-all"
                    >
                        {t('reset') || 'Reset All Stems'}
                    </button>
                </div>
            )}
        </div>
    );
};
