import React from 'react';
import { VocalRangeType, VOCAL_RANGES } from '@/utils/audio/vocalRange';
import { KeyInfo } from '@/utils/audio/keyDetection';

interface AutoKeyPanelProps {
    isAnalyzing: boolean;
    detectedKey: KeyInfo | null;
    vocalRange: VocalRangeType;
    suggestedShift: number | null;
    onAnalyze: () => void;
    onApply: () => void;
    onRangeChange: (range: VocalRangeType) => void;
    onClose: () => void;
}

export const AutoKeyPanel: React.FC<AutoKeyPanelProps> = ({
    isAnalyzing,
    detectedKey,
    vocalRange,
    suggestedShift,
    onAnalyze,
    onApply,
    onRangeChange,
    onClose
}) => {
    const ranges: VocalRangeType[] = ['soprano', 'alto', 'tenor', 'bass'];

    return (
        <div className="bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl p-6 w-80 text-white shadow-2xl">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold bg-linear-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                    Auto-Key Detective
                </h3>
                <button onClick={onClose} className="text-white/40 hover:text-white">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="space-y-6">
                {/* Vocal Range Selection */}
                <div className="space-y-3">
                    <label className="text-xs font-bold uppercase tracking-wider text-white/40">
                        Your Vocal Range
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        {ranges.map(range => (
                            <button
                                key={range}
                                onClick={() => onRangeChange(range)}
                                className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                                    vocalRange === range
                                        ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                                        : 'bg-white/5 text-white/60 hover:bg-white/10'
                                }`}
                            >
                                {VOCAL_RANGES[range].name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Analysis Section */}
                <div className="pt-4 border-t border-white/10">
                    <button
                        onClick={onAnalyze}
                        disabled={isAnalyzing}
                        className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                            isAnalyzing
                                ? 'bg-white/5 text-white/40 cursor-not-allowed'
                                : 'bg-linear-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-blue-900/40 hover:scale-[1.02] active:scale-[0.98]'
                        }`}
                    >
                        {isAnalyzing ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                Analyzing...
                            </>
                        ) : (
                            <>🔍 Analyze Track Key</>
                        )}
                    </button>
                </div>

                {/* Results Section */}
                {detectedKey && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-500">
                        <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/10">
                            <span className="text-sm text-white/60">Detected Key</span>
                            <span className="text-lg font-bold text-cyan-400">
                                {detectedKey.tonic} {detectedKey.scale}
                            </span>
                        </div>

                        {suggestedShift !== null && (
                            <div className="space-y-3">
                                <div className="flex justify-between items-center px-1">
                                    <span className="text-sm text-white/60">Suggested Shift</span>
                                    <span className={`text-lg font-bold ${suggestedShift === 0 ? 'text-white/40' : 'text-green-400'}`}>
                                        {suggestedShift > 0 ? `+${suggestedShift}` : suggestedShift} semitones
                                    </span>
                                </div>
                                <button
                                    onClick={onApply}
                                    className="w-full py-2 bg-green-500/20 border border-green-500/50 text-green-400 rounded-lg text-sm font-bold hover:bg-green-500/30 transition-all"
                                >
                                    Apply Suggested Shift
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
