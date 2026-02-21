import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlaybackController } from '@/utils/audio/playbackController';
import { StemSettings } from '@/types/audio';
import { useTranslations } from 'next-intl';

interface MultiTrackMixerProps {
    controller: PlaybackController;
    onClose: () => void;
}

const VUMeter: React.FC<{ level: number }> = ({ level }) => {
    // LED-style meter with 12 segments
    const segments = 12;
    const activeSegments = Math.ceil(level * segments);

    return (
        <div className="flex flex-col-reverse gap-0.5 h-32 w-1.5 bg-black/40 rounded-full p-0.5 overflow-hidden border border-white/5">
            {Array.from({ length: segments }).map((_, i) => {
                const isActive = i < activeSegments;
                const isPeak = i > segments * 0.8;
                const isWarning = i > segments * 0.6;

                let color = 'bg-emerald-500/20';
                if (isActive) {
                    if (isPeak) color = 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]';
                    else if (isWarning) color = 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]';
                    else color = 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]';
                }

                return (
                    <div 
                        key={i} 
                        className={`flex-1 rounded-sm transition-all duration-75 ${color}`}
                    />
                );
            })}
        </div>
    );
};

const Fader: React.FC<{
    label: string;
    icon: string;
    value: number;
    level: number;
    muted: boolean;
    solo: boolean;
    onChange: (val: number) => void;
    onToggleMute: () => void;
    onToggleSolo: () => void;
}> = ({ label, icon, value, level, muted, solo, onChange, onToggleMute, onToggleSolo }) => {
    return (
        <div className="flex flex-col items-center gap-4 group">
            {/* Level Meter + Slider Container */}
            <div className="relative flex gap-3 h-48 items-end p-3 bg-white/5 rounded-2xl border border-white/10 group-hover:bg-white/8 transition-colors">
                <VUMeter level={level} />
                
                <div className="relative h-full w-8 flex flex-col items-center">
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={value}
                        onChange={(e) => onChange(parseFloat(e.target.value))}
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-1 bg-transparent appearance-none rotate-[-90deg] cursor-pointer"
                        style={{
                            WebkitAppearance: 'none',
                        }}
                    />
                    {/* Custom Fader Track Styling via CSS in globals would be better, but let's do inline for now */}
                    <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 bg-black/40 rounded-full pointer-events-none" />
                </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col items-center gap-1 w-full">
                <div className="flex gap-1">
                    <button
                        onClick={onToggleSolo}
                        className={`w-8 h-6 rounded text-[10px] font-bold transition-all ${
                            solo ? 'bg-amber-500 text-black shadow-[0_0_10px_rgba(245,158,11,0.4)]' : 'bg-white/5 text-white/40 hover:bg-white/10'
                        }`}
                    >
                        SOLO
                    </button>
                    <button
                        onClick={onToggleMute}
                        className={`w-8 h-6 rounded text-[10px] font-bold transition-all ${
                            muted ? 'bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.4)]' : 'bg-white/5 text-white/40 hover:bg-white/10'
                        }`}
                    >
                        MUTE
                    </button>
                </div>
                <div className="text-[10px] font-medium uppercase tracking-widest text-white/60 mt-1 whitespace-nowrap">
                    {icon} {label}
                </div>
                <div className="text-[9px] font-mono text-white/30">
                    {Math.round(value * 100)}%
                </div>
            </div>
        </div>
    );
};

export const MultiTrackMixer: React.FC<MultiTrackMixerProps> = ({ controller, onClose }) => {
    const [stems, setStems] = useState<StemSettings[]>([]);
    const [levels, setLevels] = useState<number[]>([]);
    const requestRef = useRef<number>(0);

    useEffect(() => {
        const update = () => {
            setStems(controller.getStemStates());
            setLevels(controller.getStemLevels());
            requestRef.current = requestAnimationFrame(update);
        };
        requestRef.current = requestAnimationFrame(update);
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [controller]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 p-6 rounded-3xl bg-black/60 backdrop-blur-2xl border border-white/10 shadow-2xl overflow-hidden min-w-[400px]"
        >
            {/* Glassmorphic Background Glows */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-purple-500/20 blur-[80px] -z-10" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-blue-500/20 blur-[80px] -z-10" />

            <div className="flex items-center justify-between mb-8">
                <div>
                    <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                        STUDIO MIXER
                        <span className="text-[10px] bg-white/10 text-white/60 px-2 py-0.5 rounded-full font-mono uppercase tracking-tighter">
                            Live v1.0
                        </span>
                    </h3>
                    <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-medium">Stem Isolation Console</p>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/60 transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="flex gap-8 items-start">
                <AnimatePresence mode="popLayout">
                    {stems.map((stem, index) => (
                        <Fader
                            key={stem.type + index}
                            label={stem.label}
                            icon={stem.icon}
                            value={stem.volume}
                            level={levels[index] || 0}
                            muted={stem.muted}
                            solo={stem.solo}
                            onChange={(val) => controller.setStemVolume(index, val)}
                            onToggleMute={() => controller.toggleStemMute(index)}
                            onToggleSolo={() => controller.toggleStemSolo(index)}
                        />
                    ))}
                </AnimatePresence>

                {/* Master Section Spacer */}
                <div className="w-[1px] h-48 bg-white/10 mx-2 self-start" />

                {/* Master Fader Placeholder (could integrate with MasterGain from EffectsChain) */}
                <Fader
                    label="MASTER"
                    icon="🎚️"
                    value={1.0} // Need to track master volume state
                    level={Math.max(...levels, 0)} // Sum/Avg level for master? Max for now.
                    muted={false}
                    solo={false}
                    onChange={(val) => controller.setMasterGain(val)}
                    onToggleMute={() => {}}
                    onToggleSolo={() => {}}
                />
            </div>
            
            <div className="mt-8 pt-4 border-t border-white/5 flex justify-center">
                <button 
                    onClick={() => controller.resetStems()}
                    className="text-[10px] font-bold text-white/40 hover:text-white uppercase tracking-widest transition-colors flex items-center gap-2"
                >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Reset Console
                </button>
            </div>
        </motion.div>
    );
};
