'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Mic, 
    Headphones, 
    Volume2, 
    Sparkles, 
    User, 
    Ghost, 
    Music, 
    Cpu 
} from 'lucide-react';
import { VoicePreset, VOICE_PRESETS, VoiceTransformSettings } from '@/types/audio';

interface VoiceRoomPanelProps {
    currentPreset: VoicePreset;
    settings: VoiceTransformSettings;
    isMonitoring: boolean;
    onPresetChange: (preset: VoicePreset) => void;
    onSettingsChange: (settings: Partial<VoiceTransformSettings>) => void;
    onToggleMonitoring: () => void;
    isInitialized: boolean;
    onInit: () => void;
}

const PRESET_ICONS: Record<VoicePreset, React.ReactNode> = {
    original: <User className="w-5 h-5" />,
    deep: <Volume2 className="w-5 h-5" />,
    high: <Sparkles className="w-5 h-5" />,
    robot: <Cpu className="w-5 h-5" />,
    chipmunk: <Ghost className="w-5 h-5" />,
    harmony: <Music className="w-5 h-5" />,
};

const PRESET_LABELS: Record<VoicePreset, string> = {
    original: 'Natural',
    deep: 'Deep Voice',
    high: 'Ethereal',
    robot: 'Cyborg',
    chipmunk: 'Chipmunk',
    harmony: 'Auto-Harmony',
};

const HARMONY_INTERVALS = [
    { label: '+3rd', interval: 3 },
    { label: '+5th', interval: 7 },
    { label: '-3rd', interval: -3 },
    { label: 'Octave', interval: 12 },
];

export const VoiceRoomPanel: React.FC<VoiceRoomPanelProps> = ({
    currentPreset,
    settings,
    isMonitoring,
    onPresetChange,
    onSettingsChange,
    onToggleMonitoring,
    isInitialized,
    onInit,
}) => {
    const [showAdvanced, setShowAdvanced] = React.useState(false);

    return (
        <div className="p-6 space-y-6 max-h-[85vh] overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-black text-white flex items-center gap-2">
                        <Mic className="w-5 h-5 text-primary" />
                        Voice Studio
                    </h3>
                    <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">
                        Real-time Vocal FX
                    </p>
                </div>
                
                {!isInitialized ? (
                    <button
                        onClick={onInit}
                        className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-full hover:scale-105 transition-transform shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)]"
                    >
                        Activate Mic
                    </button>
                ) : (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-tight">Active</span>
                    </div>
                )}
            </div>

            {/* Monitoring Toggle */}
            <div 
                onClick={isInitialized ? onToggleMonitoring : undefined}
                className={`
                    group relative flex items-center justify-between p-4 rounded-3xl border transition-all cursor-pointer
                    ${isMonitoring 
                        ? 'bg-primary/10 border-primary/30 shadow-[0_0_15px_rgba(var(--primary-rgb),0.1)]' 
                        : 'bg-white/5 border-white/10 opacity-60 grayscale hover:grayscale-0 hover:opacity-100'
                    }
                    ${!isInitialized && 'pointer-events-none opacity-20'}
                `}
            >
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${isMonitoring ? 'bg-primary text-white' : 'bg-white/10 text-white/40'}`}>
                        <Headphones className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-sm font-bold text-white">Live Monitoring</div>
                        <div className="text-[10px] text-white/30 font-medium">Hear yourself through headphones</div>
                    </div>
                </div>
                <div className={`
                    w-12 h-6 rounded-full relative transition-colors
                    ${isMonitoring ? 'bg-primary' : 'bg-white/10'}
                `}>
                    <motion.div 
                        animate={{ x: isMonitoring ? 28 : 4 }}
                        className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm" 
                    />
                </div>
            </div>

            {/* Presets Grid */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/20">Vocal Presets</span>
                    <button 
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className={`text-[10px] font-black uppercase tracking-widest transition-colors ${showAdvanced ? 'text-primary' : 'text-white/20 hover:text-white/40'}`}
                    >
                        {showAdvanced ? 'Simple' : 'Advanced'}
                    </button>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                    {(Object.keys(VOICE_PRESETS) as VoicePreset[]).map((preset) => (
                        <button
                            key={preset}
                            disabled={!isInitialized}
                            onClick={() => onPresetChange(preset)}
                            className={`
                                flex flex-col items-center gap-2 p-4 rounded-3xl border transition-all
                                ${currentPreset === preset 
                                    ? 'bg-white/10 border-white/20 ring-1 ring-white/20' 
                                    : 'bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-white/10'
                                }
                                ${!isInitialized && 'opacity-20 cursor-not-allowed'}
                            `}
                        >
                            <div className={`
                                p-3 rounded-2xl transition-colors
                                ${currentPreset === preset ? 'bg-primary text-white' : 'bg-white/10 text-white/40'}
                            `}>
                                {PRESET_ICONS[preset]}
                            </div>
                            <span className={`text-[11px] font-bold ${currentPreset === preset ? 'text-white' : 'text-white/40'}`}>
                                {PRESET_LABELS[preset]}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Advanced Controls */}
            <AnimatePresence>
                {showAdvanced && isInitialized && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden space-y-6 pt-2"
                    >
                        {/* Tuning Sliders */}
                        <div className="space-y-5 p-4 bg-white/5 rounded-3xl border border-white/5">
                            <div className="space-y-3">
                                <div className="flex justify-between items-center px-1">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Pitch Shift</span>
                                    <span className="text-xs font-mono font-bold text-primary">{settings.pitchShift > 0 ? '+' : ''}{settings.pitchShift} ST</span>
                                </div>
                                <input
                                    type="range"
                                    min="-12"
                                    max="12"
                                    step="1"
                                    value={settings.pitchShift}
                                    onChange={(e) => onSettingsChange({ pitchShift: Number(e.target.value) })}
                                    className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-primary"
                                />
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between items-center px-1">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Formant</span>
                                    <span className="text-xs font-mono font-bold text-primary">{settings.formantShift.toFixed(2)}x</span>
                                </div>
                                <input
                                    type="range"
                                    min="0.5"
                                    max="2.0"
                                    step="0.05"
                                    value={settings.formantShift}
                                    onChange={(e) => onSettingsChange({ formantShift: Number(e.target.value) })}
                                    className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-primary"
                                />
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between items-center px-1">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Internal Reverb</span>
                                    <span className="text-xs font-mono font-bold text-primary">{Math.round(settings.reverbMix * 100)}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    value={settings.reverbMix}
                                    onChange={(e) => onSettingsChange({ reverbMix: Number(e.target.value) })}
                                    className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-primary"
                                />
                            </div>
                        </div>

                        {/* Harmony Stack */}
                        <div className="space-y-3 px-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/20">Harmony Stack</span>
                            <div className="grid grid-cols-4 gap-2">
                                {HARMONY_INTERVALS.map(({ label, interval }) => {
                                    const isActive = settings.harmonies.some(h => h.interval === interval);
                                    return (
                                        <button
                                            key={label}
                                            onClick={() => {
                                                const newHarmonies = isActive 
                                                    ? settings.harmonies.filter(h => h.interval !== interval)
                                                    : [...settings.harmonies, { interval, volume: 0.5, pan: interval > 0 ? 0.4 : -0.4, enabled: true }];
                                                onSettingsChange({ harmonies: newHarmonies });
                                            }}
                                            className={`
                                                py-3 rounded-2xl text-[10px] font-black border transition-all
                                                ${isActive 
                                                    ? 'bg-primary/20 border-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.2)] text-primary-foreground' 
                                                    : 'bg-white/5 border-white/5 text-white/30 hover:bg-white/10 hover:border-white/20'
                                                }
                                            `}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Warning / Tip */}
            {isMonitoring && (
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-3xl flex gap-4 items-center"
                >
                    <div className="p-2 bg-amber-500/20 rounded-xl text-amber-400 shrink-0 shadow-lg shadow-amber-500/10">
                        <Volume2 className="w-4 h-4" />
                    </div>
                    <p className="text-[10px] text-amber-500/80 leading-relaxed font-bold uppercase tracking-tight">
                        Wear headphones to prevent feedback loops.
                    </p>
                </motion.div>
            )}
        </div>
    );
};
