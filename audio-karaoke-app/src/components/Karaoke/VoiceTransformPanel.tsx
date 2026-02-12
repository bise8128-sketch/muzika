import React from 'react';
import { VoiceTransformSettings, VoicePreset } from '@/types/audio';

interface VoiceTransformPanelProps {
    currentPreset: VoicePreset;
    settings: VoiceTransformSettings;
    isMonitoring: boolean;
    onPresetChange: (preset: VoicePreset) => void;
    onSettingsChange: (settings: Partial<VoiceTransformSettings>) => void;
    onToggleMonitoring: () => void;
    onClose: () => void;
}

export const VoiceTransformPanel: React.FC<VoiceTransformPanelProps> = ({
    currentPreset,
    settings,
    isMonitoring,
    onPresetChange,
    onSettingsChange,
    onToggleMonitoring,
    onClose
}) => {
    
    const presets: VoicePreset[] = ['original', 'deep', 'high', 'robot', 'chipmunk', 'harmony'];

    return (
        <div className="bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl p-6 w-80 text-white shadow-2xl">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold bg-linear-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                    Voice Effects
                </h3>
                <button onClick={onClose} className="text-white/40 hover:text-white">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Monitoring Toggle */}
            <div className="flex items-center justify-between mb-6 bg-white/5 p-3 rounded-lg">
                <span className="font-medium text-sm">Mic Monitoring</span>
                <button
                    onClick={onToggleMonitoring}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        isMonitoring ? 'bg-green-500' : 'bg-white/20'
                    }`}
                >
                    <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            isMonitoring ? 'translate-x-6' : 'translate-x-1'
                        }`}
                    />
                </button>
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-3 gap-2 mb-6">
                {presets.map(preset => (
                    <button
                        key={preset}
                        onClick={() => onPresetChange(preset)}
                        className={`p-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                            currentPreset === preset 
                                ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105' 
                                : 'bg-white/5 text-white/60 hover:bg-white/10'
                        }`}
                    >
                        {preset}
                    </button>
                ))}
            </div>

            {/* Sliders */}
            <div className="space-y-4">
                <div className="space-y-1">
                    <div className="flex justify-between text-xs text-white/60">
                        <span>Pitch Shift</span>
                        <span>{settings.pitchShift} semitones</span>
                    </div>
                    <input
                        type="range"
                        min="-12"
                        max="12"
                        step="1"
                        value={settings.pitchShift}
                        onChange={(e) => onSettingsChange({ pitchShift: Number(e.target.value) })}
                        className="w-full accent-primary h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                    />
                </div>

                <div className="space-y-1">
                    <div className="flex justify-between text-xs text-white/60">
                        <span>Formant</span>
                        <span>{settings.formantShift.toFixed(2)}x</span>
                    </div>
                    <input
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.05"
                        value={settings.formantShift}
                        onChange={(e) => onSettingsChange({ formantShift: Number(e.target.value) })}
                        className="w-full accent-primary h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                    />
                </div>

                <div className="space-y-1">
                    <div className="flex justify-between text-xs text-white/60">
                        <span>Reverb Mix</span>
                        <span>{(settings.reverbMix * 100).toFixed(0)}%</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={settings.reverbMix}
                        onChange={(e) => onSettingsChange({ reverbMix: Number(e.target.value) })}
                        className="w-full accent-primary h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                    />
                </div>
            </div>
            
            {/* Harmony Toggles */}
            <div className="mt-6 pt-4 border-t border-white/10">
                <h4 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-3">Harmonies</h4>
                <div className="flex gap-2">
                    {[3, 5, 7, -3].map(interval => {
                         const isActive = settings.harmonies.some(h => h.interval === interval);
                         return (
                            <button
                                key={interval}
                                onClick={() => {
                                    const newHarmonies = isActive 
                                        ? settings.harmonies.filter(h => h.interval !== interval)
                                        : [...settings.harmonies, { interval, volume: 0.5, pan: interval > 0 ? 0.5 : -0.5, enabled: true }];
                                    onSettingsChange({ harmonies: newHarmonies });
                                }}
                                className={`flex-1 py-2 rounded text-xs font-bold border transition-all ${
                                    isActive 
                                        ? 'bg-purple-500/20 border-purple-500 text-purple-400' 
                                        : 'bg-transparent border-white/10 text-white/40 hover:border-white/20'
                                }`}
                            >
                                {interval > 0 ? `+${interval}` : interval}rd
                            </button>
                         );
                    })}
                </div>
            </div>
        </div>
    );
};
