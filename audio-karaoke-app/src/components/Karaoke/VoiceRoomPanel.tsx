'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
    Mic, 
    MicOff, 
    Headphones, 
    Volume2, 
    Sparkles, 
    User, 
    Ghost, 
    Music, 
    Cpu 
} from 'lucide-react';
import { VoicePreset, VOICE_PRESETS } from '@/types/audio';

interface VoiceRoomPanelProps {
    currentPreset: VoicePreset;
    isMonitoring: boolean;
    onPresetChange: (preset: VoicePreset) => void;
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

export const VoiceRoomPanel: React.FC<VoiceRoomPanelProps> = ({
    currentPreset,
    isMonitoring,
    onPresetChange,
    onToggleMonitoring,
    isInitialized,
    onInit,
}) => {
    return (
        <div className="p-6 space-y-8">
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
                        className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-full hover:scale-105 transition-transform"
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
                        ? 'bg-primary/10 border-primary/30' 
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
                        <div className="text-[10px] text-white/30">Hear yourself through headphones</div>
                    </div>
                </div>
                <div className={`
                    w-12 h-6 rounded-full relative transition-colors
                    ${isMonitoring ? 'bg-primary' : 'bg-white/10'}
                `}>
                    <motion.div 
                        animate={{ x: isMonitoring ? 24 : 4 }}
                        className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm" 
                    />
                </div>
            </div>

            {/* Presets Grid */}
            <div className="space-y-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/20 px-1">Vocal Presets</span>
                <div className="grid grid-cols-2 gap-3">
                    {(Object.keys(VOICE_PRESETS) as VoicePreset[]).map((preset) => (
                        <button
                            key={preset}
                            disabled={!isInitialized}
                            onClick={() => onPresetChange(preset)}
                            className={`
                                flex flex-col items-center gap-3 p-4 rounded-3xl border transition-all
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

            {/* Warning / Tip */}
            {isMonitoring && (
                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex gap-3 items-start"
                >
                    <div className="p-1.5 bg-amber-500/20 rounded-lg text-amber-400 shrink-0">
                        <Volume2 className="w-3 h-3" />
                    </div>
                    <p className="text-[10px] text-amber-500/80 leading-relaxed font-medium">
                        Use headphones to prevent feedback loops while monitoring is active.
                    </p>
                </motion.div>
            )}
        </div>
    );
};
