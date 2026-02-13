import React from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Music2, 
    Activity, 
    RotateCcw, 
    Volume2, 
    Layers, 
    Settings,
    Zap,
    Wind,
    Waves
} from 'lucide-react';

interface EffectsPanelProps {
    pitch: number;
    tempo: number;
    reverb: number;
    echo: number;
    bass: number;
    mid: number;
    treble: number;
    onPitchChange: (value: number) => void;
    onTempoChange: (value: number) => void;
    onReverbChange: (value: number) => void;
    onEchoChange: (value: number) => void;
    onBassChange: (value: number) => void;
    onMidChange: (value: number) => void;
    onTrebleChange: (value: number) => void;
    onReset: () => void;
}

const ControlSlider: React.FC<{
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    unit?: string;
    onChange: (val: number) => void;
    icon: React.ReactNode;
    displayValue?: string;
    t: any;
}> = ({ label, value, min, max, step, unit, onChange, icon, displayValue, t }) => (
    <motion.div 
        whileHover={{ scale: 1.02 }}
        className="glass-premium p-5 rounded-3xl border border-white/5 hover:border-white/10 transition-all group"
    >
        <div className="flex justify-between items-center mb-5">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                    {icon}
                </div>
                <span className="text-[11px] font-black uppercase tracking-widest text-white/50">{label}</span>
            </div>
            <div className="font-black text-[10px] text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                {displayValue || `${value}${unit || ''}`}
            </div>
        </div>

        <div className="relative h-6 flex items-center">
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="range-premium w-full"
            />
        </div>

        <div className="flex justify-between text-[9px] text-white/20 mt-2 font-black uppercase tracking-widest">
            <span>{min}{unit}</span>
            <span>{max}{unit}</span>
        </div>
    </motion.div>
);

export const EffectsPanel: React.FC<EffectsPanelProps> = ({
    pitch, tempo, reverb, echo, bass, mid, treble,
    onPitchChange, onTempoChange, onReverbChange, onEchoChange,
    onBassChange, onMidChange, onTrebleChange, onReset
}) => {
    const t = useTranslations('EffectsPanel');

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-premium rounded-[3rem] p-10 space-y-12"
        >
            {/* Header Section */}
            <div className="flex items-end justify-between">
                <div className="space-y-2">
                    <div className="flex items-center gap-3 text-primary">
                        <Zap className="w-5 h-5 fill-current" />
                        <span className="text-[10px] font-black uppercase tracking-[0.4em]">{t('realTimeProcessing')}</span>
                    </div>
                    <h3 className="text-4xl font-black text-white italic tracking-tighter">
                        {t('studioEffects')}
                    </h3>
                </div>
                <motion.button
                    whileHover={{ rotate: -180, scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={onReset}
                    className="p-4 rounded-3xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all border border-white/10 shadow-xl"
                >
                    <RotateCcw className="w-6 h-6" />
                </motion.button>
            </div>

            {/* DSP Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <ControlSlider
                    label={t('pitchShift')}
                    value={pitch}
                    min={-12}
                    max={12}
                    step={1}
                    onChange={onPitchChange}
                    displayValue={`${pitch > 0 ? '+' : ''}${pitch} sem`}
                    icon={<Music2 className="w-4 h-4" />}
                    t={t}
                />
                <ControlSlider
                    label={t('tempo')}
                    value={tempo}
                    min={0.5}
                    max={2.0}
                    step={0.05}
                    onChange={onTempoChange}
                    displayValue={`${Math.round(tempo * 100)}%`}
                    icon={<Activity className="w-4 h-4" />}
                    t={t}
                />
                <ControlSlider
                    label={t('reverb')}
                    value={reverb}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={onReverbChange}
                    displayValue={`${Math.round(reverb * 100)}%`}
                    icon={<Waves className="w-4 h-4" />}
                    t={t}
                />
                <ControlSlider
                    label={t('echo')}
                    value={echo}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={onEchoChange}
                    displayValue={`${Math.round(echo * 100)}%`}
                    icon={<Layers className="w-4 h-4" />}
                    t={t}
                />
            </div>

            {/* Mixer/EQ Section */}
            <div className="space-y-8">
                <div className="flex items-center gap-4">
                    <div className="h-px flex-1 bg-white/10" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">{t('equalizer')}</span>
                    <div className="h-px flex-1 bg-white/10" />
                </div>
                
                <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto">
                    <EQSlider 
                        label={t('bass')} 
                        value={bass} 
                        onChange={onBassChange} 
                        color="from-primary to-accent" 
                        icon={<Volume2 className="w-3 h-3" />}
                    />
                    <EQSlider 
                        label={t('mid')} 
                        value={mid} 
                        onChange={onMidChange} 
                        color="from-accent to-pink-500" 
                        icon={<Activity className="w-3 h-3" />}
                    />
                    <EQSlider 
                        label={t('treble')} 
                        value={treble} 
                        onChange={onTrebleChange} 
                        color="from-pink-500 to-orange-500" 
                        icon={<Wind className="w-3 h-3" />}
                    />
                </div>
            </div>
        </motion.div>
    );
};

const EQSlider: React.FC<{ 
    label: string; 
    value: number; 
    onChange: (v: number) => void;
    color: string;
    icon: React.ReactNode;
}> = ({ label, value, onChange, color, icon }) => (
    <div className="flex flex-col items-center gap-6 group">
        <div className="relative h-64 w-12 glass-premium rounded-full p-1.5 border border-white/5 overflow-hidden">
            {/* Background Lines */}
            <div className="absolute inset-0 flex flex-col justify-around py-8 px-2 opacity-5 pointer-events-none">
                {[...Array(9)].map((_, i) => <div key={i} className="h-px w-full bg-white" />)}
            </div>

            {/* Active Track */}
            <motion.div
                className={`absolute bottom-0 left-0 w-full bg-linear-to-t ${color} rounded-full`}
                initial={false}
                animate={{ height: `${((value + 10) / 20) * 100}%` }}
                transition={{ type: "spring", bounce: 0, duration: 0.2 }}
            />
            <input
                type="range"
                min="-10"
                max="10"
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 vertical-slider"
                style={{ appearance: 'slider-vertical' } as any}
            />
            {/* Knob */}
            <motion.div
                className="absolute left-1/2 -translate-x-1/2 w-8 h-8 bg-white rounded-full shadow-2xl flex items-center justify-center border-4 border-black/10 z-20 pointer-events-none"
                initial={false}
                animate={{ bottom: `calc(${((value + 10) / 20) * 100}% - 16px)` }}
                transition={{ type: "spring", bounce: 0, duration: 0.2 }}
            >
                <div className="w-1 h-3 bg-black/10 rounded-full" />
            </motion.div>
        </div>
        <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1.5 text-white/40 group-hover:text-primary transition-colors">
                {icon}
                <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
            </div>
            <span className="text-[11px] font-black text-white/90">{value > 0 ? '+' : ''}{value}dB</span>
        </div>
    </div>
);
