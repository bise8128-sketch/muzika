'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { PlaybackController } from '@/utils/audio/playback/PlaybackCore';
import type { StemSettings, StemPreset } from '@/types/audio';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    SlidersHorizontal, 
    ChevronDown, 
    Volume2, 
    Scissors, 
    Mic2, 
    Drum, 
    Guitar, 
    Music2, 
    RefreshCcw,
    Activity
} from 'lucide-react';

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

const PRESETS: { id: StemPreset; label: string; icon: React.ReactNode }[] = [
    { id: 'full-mix', label: 'Full Mix', icon: <Music2 className="w-3.5 h-3.5" /> },
    { id: 'karaoke', label: 'Karaoke', icon: <Mic2 className="w-3.5 h-3.5" /> },
    { id: 'a-capella', label: 'A Capella', icon: <Activity className="w-3.5 h-3.5" /> },
    { id: 'drums-only', label: 'Drums', icon: <Drum className="w-3.5 h-3.5" /> },
    { id: 'bass-only', label: 'Bass', icon: <Guitar className="w-3.5 h-3.5" /> },
];

interface VUMeterProps {
    level: number;
    active: boolean;
}

const VUMeter: React.FC<VUMeterProps> = ({ level, active }) => {
    // 12 segments for the VU meter
    const segments = Array.from({ length: 12 }, (_, i) => i);
    
    return (
        <div className="flex flex-col-reverse gap-0.5 h-full w-1.5 py-1">
            {segments.map(i => {
                const threshold = (i + 1) / segments.length;
                const isLit = active && level >= threshold;
                // Color gradient: Green -> Yellow -> Red
                const color = i > 9 ? 'bg-red-500' : i > 7 ? 'bg-yellow-400' : 'bg-emerald-400';
                
                return (
                    <motion.div
                        key={i}
                        animate={{ 
                            opacity: isLit ? 1 : 0.1,
                            scaleX: isLit ? 1.2 : 1,
                        }}
                        className={`w-full h-1.5 rounded-full transition-all duration-75 ${color} ${isLit ? 'shadow-[0_0_8px_rgba(52,211,153,0.5)]' : ''}`}
                    />
                );
            })}
        </div>
    );
};

const StemSlider: React.FC<StemSliderProps & { level: number }> = ({
    stem,
    index,
    level,
    onVolumeChange,
    onMuteToggle,
    onSoloToggle,
}) => {
    const effectivelyMuted = stem.muted || stem.volume === 0;

    return (
        <motion.div 
            layout
            className="flex flex-col items-center gap-4 p-4 rounded-3xl bg-white/5 hover:bg-white/10 transition-all group border border-white/5 w-24"
        >
            {/* Mixer Buttons at Top */}
            <div className="flex flex-col gap-1.5 w-full">
                <MixerButton 
                    active={stem.solo} 
                    onClick={() => onSoloToggle(index)} 
                    label="S" 
                    color="yellow" 
                />
                <MixerButton 
                    active={stem.muted} 
                    onClick={() => onMuteToggle(index)} 
                    label="M" 
                    color="red" 
                />
            </div>

            {/* Fader + Meter Area (Vertical) */}
            <div className="flex gap-4 h-48 py-2">
                <div className="relative w-8 flex justify-center">
                    <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={Math.round(stem.volume * 100)}
                        onChange={e => onVolumeChange(index, parseInt(e.target.value) / 100)}
                        className="range-premium-vertical h-full"
                        style={{ 
                            writingMode: 'vertical-lr',
                            direction: 'rtl',
                            appearance: 'slider-vertical'
                        } as any}
                    />
                </div>
                <VUMeter level={level} active={!effectivelyMuted} />
            </div>

            {/* Label Block */}
            <div className="flex flex-col items-center gap-2 mt-auto">
                <div className="p-2.5 rounded-xl bg-black/20 text-primary group-hover:shadow-[0_0_15px_rgba(124,58,237,0.3)] transition-all">
                    <StemIcon type={stem.type} />
                </div>
                <span className="text-[9px] font-black uppercase tracking-tighter text-white/50 text-center leading-tight">
                    {stem.label}
                </span>
            </div>
        </motion.div>
    );
};

const StemIcon = ({ type }: { type: string }) => {
    switch(type) {
        case 'vocals': return <Mic2 className="w-4 h-4" />;
        case 'drums': return <Drum className="w-4 h-4" />;
        case 'bass': return <Guitar className="w-4 h-4" />;
        case 'other': return <Scissors className="w-4 h-4" />;
        default: return <Music2 className="w-4 h-4" />;
    }
}

const MixerButton = ({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color: string }) => (
    <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        className={`w-full h-7 rounded-lg flex items-center justify-center text-[9px] font-black italic transition-all border
            ${active
                ? `bg-${color}-500/30 text-${color}-400 border-${color}-500/40 shadow-lg shadow-${color}-500/20`
                : 'bg-white/5 text-white/20 border-white/5 hover:border-white/10 hover:text-white/40'
            }`}
    >
        {label}
    </motion.button>
);

export const StemIsolationPanel: React.FC<StemIsolationPanelProps> = ({ controller }) => {
    const t = useTranslations('StemIsolation');
    const [stems, setStems] = useState<StemSettings[]>([]);
    const [stemLevels, setStemLevels] = useState<number[]>([]);
    const [activePreset, setActivePreset] = useState<StemPreset>('full-mix');
    const [isExpanded, setIsExpanded] = useState(true);

    const refreshStems = useCallback(() => {
        setStems(controller.getStemStates());
    }, [controller]);

    useEffect(() => {
        refreshStems();

        let animationId: number;
        const updateLevels = () => {
            setStemLevels(controller.getStemLevels());
            animationId = requestAnimationFrame(updateLevels);
        };
        animationId = requestAnimationFrame(updateLevels);

        return () => cancelAnimationFrame(animationId);
    }, [refreshStems, controller]);

    const handleVolumeChange = useCallback((index: number, volume: number) => {
        controller.setStemVolume(index, volume);
        setActivePreset('full-mix');
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
        <motion.div 
            layout
            className="rounded-[2.5rem] glass-premium border border-white/10 overflow-hidden"
        >
            {/* Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between px-8 py-6 hover:bg-white/5 transition-all group"
            >
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-2xl text-primary group-hover:scale-110 transition-transform">
                        <SlidersHorizontal className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-white italic tracking-tighter uppercase whitespace-nowrap">
                            {t('title') || 'Stem Mixer'}
                        </h3>
                        <p className="text-[10px] font-black text-white/20 tracking-[0.2em]">{t('subtitle') || 'SUB-TRACK ISOLATION'}</p>
                    </div>
                </div>
                <motion.div 
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                    className="text-white/20 p-2"
                >
                    <ChevronDown className="w-6 h-6" />
                </motion.div>
            </button>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="px-8 pb-8 space-y-8">
                            {/* Presets Slider */}
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                                {PRESETS.filter(p => {
                                    if (p.id === 'drums-only') return stems.some(s => s.type === 'drums');
                                    if (p.id === 'bass-only') return stems.some(s => s.type === 'bass');
                                    return true;
                                }).map(preset => (
                                    <motion.button
                                        key={preset.id}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => handlePreset(preset.id)}
                                        className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border
                                            ${activePreset === preset.id
                                                ? 'bg-primary/20 text-primary border-primary/40 shadow-xl shadow-primary/10'
                                                : 'bg-white/5 text-white/40 border-white/5 hover:border-white/10 hover:text-white/60'
                                            }`}
                                    >
                                        {preset.icon}
                                        {preset.label}
                                    </motion.button>
                                ))}
                            </div>

                            {/* Stem Sliders (Mixer Deck) */}
                            <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-thin scrollbar-track-white/5 scrollbar-thumb-white/10">
                                {stems.map((stem, index) => (
                                    <StemSlider
                                        key={`${stem.type}-${index}`}
                                        stem={stem}
                                        index={index}
                                        level={stemLevels[index] || 0}
                                        onVolumeChange={handleVolumeChange}
                                        onMuteToggle={handleMuteToggle}
                                        onSoloToggle={handleSoloToggle}
                                    />
                                ))}
                            </div>

                            {/* Reset Action */}
                            <motion.button
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.99 }}
                                onClick={() => handlePreset('full-mix')}
                                className="w-full py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.3em] text-white/30 bg-white/5 hover:bg-white/10 hover:text-white/60 transition-all flex items-center justify-center gap-3 border border-white/5"
                            >
                                <RefreshCcw className="w-4 h-4" />
                                {t('reset') || 'RESET MIXER DECK'}
                            </motion.button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};
