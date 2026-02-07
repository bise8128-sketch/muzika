import React, { useState, useEffect } from 'react';
import { effectsManager } from '../../utils/audio/effectsManager';
import { useTranslations } from 'next-intl';

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
    <div className="bg-white/5 rounded-xl p-4 border border-white/5 hover:border-white/10 transition-colors group">
        <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2 text-gray-300">
                <div className="p-1.5 rounded-lg bg-black/20 text-primary">
                    {icon}
                </div>
                <span className="text-sm font-medium">{label}</span>
            </div>
            <div className="font-mono text-xs text-primary bg-primary/10 px-2 py-1 rounded">
                {displayValue || `${value}${unit || ''}`}
            </div>
        </div>

        <div className="relative h-6">
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="range-premium absolute top-1/2 -translate-y-1/2 w-full"
            />
        </div>

        <div className="flex justify-between text-[10px] text-gray-600 mt-1 uppercase tracking-wider font-semibold">
            <span>{t('min')}</span>
            <span>{t('max')}</span>
        </div>
    </div>
);

export const EffectsPanel: React.FC<EffectsPanelProps> = ({
    pitch, tempo, reverb, echo, bass, mid, treble,
    onPitchChange, onTempoChange, onReverbChange, onEchoChange,
    onBassChange, onMidChange, onTrebleChange, onReset
}) => {
    const t = useTranslations('EffectsPanel');

    return (
        <div className="glass-card rounded-3xl p-8 backdrop-blur-3xl space-y-8">
            {/* DSP Effects Section */}
            <div>
                <div className="flex items-center justify-between mb-8">
                    <div className="space-y-1">
                        <h3 className="text-xl font-bold text-gradient">
                            {t('studioEffects')}
                        </h3>
                        <p className="text-xs text-muted-foreground">{t('realTimeProcessing')}</p>
                    </div>
                    <button
                        onClick={onReset}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-white/5 hover:bg-white/10 rounded-full transition-all border border-white/10 hover:border-white/20"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        {t('reset')}
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ControlSlider
                        label={t('pitchShift')}
                        value={pitch}
                        min={-12}
                        max={12}
                        step={1}
                        onChange={onPitchChange}
                        displayValue={`${pitch > 0 ? '+' : ''}${pitch} ${t('semitones')}`}
                        icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>}
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
                        icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
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
                        icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>}
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
                        icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.536 8.464a5 5 0 000 7.072m-2.828-9.9a9 9 0 000 12.728" /></svg>}
                        t={t}
                    />
                </div>
            </div>

            {/* EQ Section */}
            <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-6">{t('equalizer')}</h3>
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white/5 rounded-2xl p-4 flex flex-col items-center gap-4">
                        <div className="h-32 w-2 bg-white/10 rounded-full relative">
                            <input
                                type="range"
                                min="-10"
                                max="10"
                                value={bass}
                                onChange={(e) => onBassChange(Number(e.target.value))}
                                className="range-vertical absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div
                                className="absolute bottom-0 left-0 w-full bg-primary rounded-full transition-all"
                                style={{ height: `${((bass + 10) / 20) * 100}%` }}
                            />
                            <div
                                className="absolute left-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full shadow-lg pointer-events-none transition-all"
                                style={{ bottom: `calc(${((bass + 10) / 20) * 100}% - 8px)` }}
                            />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider">{t('bass')}</span>
                        <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded">{bass > 0 ? '+' : ''}{bass}dB</span>
                    </div>

                    <div className="bg-white/5 rounded-2xl p-4 flex flex-col items-center gap-4">
                        <div className="h-32 w-2 bg-white/10 rounded-full relative">
                            <input
                                type="range"
                                min="-10"
                                max="10"
                                value={mid}
                                onChange={(e) => onMidChange(Number(e.target.value))}
                                className="range-vertical absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div
                                className="absolute bottom-0 left-0 w-full bg-accent rounded-full transition-all"
                                style={{ height: `${((mid + 10) / 20) * 100}%` }}
                            />
                            <div
                                className="absolute left-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full shadow-lg pointer-events-none transition-all"
                                style={{ bottom: `calc(${((mid + 10) / 20) * 100}% - 8px)` }}
                            />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider">{t('mid')}</span>
                        <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded">{mid > 0 ? '+' : ''}{mid}dB</span>
                    </div>

                    <div className="bg-white/5 rounded-2xl p-4 flex flex-col items-center gap-4">
                        <div className="h-32 w-2 bg-white/10 rounded-full relative">
                            <input
                                type="range"
                                min="-10"
                                max="10"
                                value={treble}
                                onChange={(e) => onTrebleChange(Number(e.target.value))}
                                className="range-vertical absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div
                                className="absolute bottom-0 left-0 w-full bg-purple-500 rounded-full transition-all"
                                style={{ height: `${((treble + 10) / 20) * 100}%` }}
                            />
                            <div
                                className="absolute left-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full shadow-lg pointer-events-none transition-all"
                                style={{ bottom: `calc(${((treble + 10) / 20) * 100}% - 8px)` }}
                            />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider">{t('treble')}</span>
                        <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded">{treble > 0 ? '+' : ''}{treble}dB</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
