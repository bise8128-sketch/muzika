import React from 'react';

interface EffectsPanelProps {
    pitch: number;
    tempo: number;
    reverb: number;
    echo: number;
    onPitchChange: (value: number) => void;
    onTempoChange: (value: number) => void;
    onReverbChange: (value: number) => void;
    onEchoChange: (value: number) => void;
    onReset: () => void;
}

export const EffectsPanel: React.FC<EffectsPanelProps> = ({
    pitch, tempo, reverb, echo,
    onPitchChange, onTempoChange, onReverbChange, onEchoChange, onReset
}) => {
    return (
        <div className="bg-black/40 backdrop-blur-md rounded-3xl border border-white/10 p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                    Studio Effects
                </h3>
                <button
                    onClick={onReset}
                    className="text-xs text-muted-foreground hover:text-white transition-colors uppercase tracking-widest"
                >
                    Reset All
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Pitch & Tempo */}
                <div className="space-y-6">
                    <div>
                        <div className="flex justify-between mb-2">
                            <label className="text-sm font-medium text-gray-300">Key Shift (Pitch)</label>
                            <span className="text-xs font-mono text-primary">{pitch > 0 ? '+' : ''}{pitch} cents</span>
                        </div>
                        <input
                            type="range"
                            min="-1200"
                            max="1200"
                            step="100"
                            value={pitch}
                            onChange={(e) => onPitchChange(Number(e.target.value))}
                            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                        <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                            <span>-12</span>
                            <span>0</span>
                            <span>+12</span>
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between mb-2">
                            <label className="text-sm font-medium text-gray-300">Tempo (Speed)</label>
                            <span className="text-xs font-mono text-primary">{Math.round(tempo * 100)}%</span>
                        </div>
                        <input
                            type="range"
                            min="0.5"
                            max="1.5"
                            step="0.05"
                            value={tempo}
                            onChange={(e) => onTempoChange(Number(e.target.value))}
                            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                    </div>
                </div>

                {/* Spatial Effects */}
                <div className="space-y-6">
                    <div>
                        <div className="flex justify-between mb-2">
                            <label className="text-sm font-medium text-gray-300">Reverb (Space)</label>
                            <span className="text-xs font-mono text-primary">{Math.round(reverb * 100)}%</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={reverb}
                            onChange={(e) => onReverbChange(Number(e.target.value))}
                            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
                        />
                    </div>

                    <div>
                        <div className="flex justify-between mb-2">
                            <label className="text-sm font-medium text-gray-300">Echo (Delay)</label>
                            <span className="text-xs font-mono text-primary">{Math.round(echo * 100)}%</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={echo}
                            onChange={(e) => onEchoChange(Number(e.target.value))}
                            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
