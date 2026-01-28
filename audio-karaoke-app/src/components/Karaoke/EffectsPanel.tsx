import React, { useState, useEffect } from 'react';
import { effectsManager } from '../../utils/audio/effectsManager';

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
}> = ({ label, value, min, max, step, unit, onChange, icon, displayValue }) => (
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
            <span>Min</span>
            <span>Max</span>
        </div>
    </div>
);

export const EffectsPanel: React.FC<EffectsPanelProps> = ({
    pitch, tempo, reverb, echo, bass, mid, treble,
    onPitchChange, onTempoChange, onReverbChange, onEchoChange,
    onBassChange, onMidChange, onTrebleChange, onReset
}) => {
    return (
        <div className="glass-card rounded-3xl p-8 backdrop-blur-3xl space-y-8">
            {/* DSP Effects Section */}
            <div>
                <div className="flex items-center justify-between mb-8">
                    <div className="space-y-1">
                        <h3 className="text-xl font-bold text-gradient">
                            Studio Effects
                        </h3>
                        <p className="text-xs text-muted-foreground">Real-time DSP audio processing</p>
                    </div>
                    <button
                        onClick={onReset}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-white/5 hover:bg-white/10 rounded-full transition-all border border-white/10 hover:border-white/20"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        RESET
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ControlSlider
                        label="Pitch Shift"
                        value={pitch}
                        min={-1200}
                        max={1200}
                        step={100}
                        onChange={onPitchChange}
                        displayValue={`${pitch > 0 ? '+' : ''}${Math.round(pitch / 100)} Semitones`}
                        icon={
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                            </svg>
                        }
                    />

                    <ControlSlider
                        label="Tempo / Speed"
                        value={tempo}
                        min={0.5}
                        max={2.0}
                        step={0.05}
                        onChange={onTempoChange}
                        displayValue={`${Math.round(tempo * 100)}%`}
                        icon={
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        }
                    />

                    <ControlSlider
                        label="Reverb"
                        value={reverb}
                        min={0}
                        max={1}
                        step={0.05}
                        onChange={onReverbChange}
                        displayValue={`${Math.round(reverb * 100)}%`}
                        icon={
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                            </svg>
                        }
                    />

                    <ControlSlider
                        label="Echo / Delay"
                        value={echo}
                        min={0}
                        max={1}
                        step={0.05}
                        onChange={onEchoChange}
                        displayValue={`${Math.round(echo * 100)}%`}
                        icon={
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                            </svg>
                        }
                    />
                </div>
            </div>

            {/* EQ Section */}
            <div>
                <h3 className="text-xl font-bold text-gradient mb-6">
                    Master EQ
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <ControlSlider
                        label="Bass (Low)"
                        value={bass}
                        min={-12}
                        max={12}
                        step={1}
                        onChange={onBassChange}
                        displayValue={`${bass > 0 ? '+' : ''}${bass} dB`}
                        icon={
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        }
                    />
                    <ControlSlider
                        label="Mid (Freq)"
                        value={mid}
                        min={-12}
                        max={12}
                        step={1}
                        onChange={onMidChange}
                        displayValue={`${mid > 0 ? '+' : ''}${mid} dB`}
                        icon={
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        }
                    />
                    <ControlSlider
                        label="Treble (High)"
                        value={treble}
                        min={-12}
                        max={12}
                        step={1}
                        onChange={onTrebleChange}
                        displayValue={`${treble > 0 ? '+' : ''}${treble} dB`}
                        icon={
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                        }
                    />
                </div>
            </div>
        </div>
    );
};

