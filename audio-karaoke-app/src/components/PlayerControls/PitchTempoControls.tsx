/**
 * PitchTempoControls Component
 * Provides UI to adjust pitch and tempo
 */

import React from 'react';

interface PitchTempoControlsProps {
    pitch: number;
    tempo: number;
    onPitchChange: (pitch: number) => void;
    onTempoChange: (tempo: number) => void;
    onReset: () => void;
}

export const PitchTempoControls: React.FC<PitchTempoControlsProps> = ({
    pitch,
    tempo,
    onPitchChange,
    onTempoChange,
    onReset,
}) => {
    return (
        <div className="bg-white/5 backdrop-blur-md p-6 rounded-2xl border border-white/10 w-full max-w-4xl mx-auto mt-4">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                Advanced Audio Tuning
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Pitch Control */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-gray-300">Pitch (Semitones)</label>
                        <span className="text-xs font-mono text-purple-400">{pitch > 0 ? `+${pitch}` : pitch}</span>
                    </div>
                    <input
                        type="range"
                        min={-12}
                        max={12}
                        step={1}
                        value={pitch}
                        onChange={(e) => onPitchChange(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                    <div className="flex justify-between mt-1 px-1">
                        <span className="text-[10px] text-gray-600">-12</span>
                        <span className="text-[10px] text-gray-600">0</span>
                        <span className="text-[10px] text-gray-600">+12</span>
                    </div>
                </div>

                {/* Tempo Control */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-gray-300">Tempo (Speed)</label>
                        <span className="text-xs font-mono text-pink-400">{tempo.toFixed(2)}x</span>
                    </div>
                    <input
                        type="range"
                        min={0.5}
                        max={2.0}
                        step={0.05}
                        value={tempo}
                        onChange={(e) => onTempoChange(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
                    />
                    <div className="flex justify-between mt-1 px-1">
                        <span className="text-[10px] text-gray-600">0.5x</span>
                        <span className="text-[10px] text-gray-600">1.0x</span>
                        <span className="text-[10px] text-gray-600">2.0x</span>
                    </div>
                </div>
            </div>

            <div className="flex justify-end mt-6">
                <button
                    onClick={onReset}
                    className="text-xs text-gray-500 hover:text-white transition-colors border border-gray-700 rounded-md px-3 py-1 hover:border-gray-500"
                >
                    Reset to Default
                </button>
            </div>
        </div>
    );
};
