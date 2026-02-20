import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { PlaybackController } from '@/utils/audio/playbackController';
import { EffectsPanel } from './EffectsPanel';
import { StemIsolationPanel } from './StemIsolationPanel';
import { PitchVisualizer } from './PitchVisualizer';
import { HarmonyGuidePanel } from './HarmonyGuidePanel';
import { PitchAnalysisResult, PerformanceScore } from '@/types/audio';
import { KeyInfo } from '@/utils/audio/keyDetection';
import { HarmonySuggestion, HarmonyMatchResult } from '@/utils/audio/harmonyGuide';

interface EffectsControllerProps {
    controller: PlaybackController;
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
    onResetEffects: () => void;
    
    // Pitch Analysis Props
    pitchAnalysis: {
        isListening: boolean;
        currentScore: number;
        currentPitch: number;
        overallScore: PerformanceScore | null;
        error: string | null;
        pitchHistory: PitchAnalysisResult[];
        startAnalysis: () => void;
        stopAnalysis: () => void;
        resetAnalysis: () => void;
    };

    // Harmony Guide Props
    harmonyGuide: {
        harmonyEnabled: boolean;
        setHarmonyEnabled: (enabled: boolean) => void;
        getSuggestions: (midi: number) => HarmonySuggestion[];
        lastMatch: HarmonyMatchResult | null;
        totalHarmonyHits: number;
    };

    // Auto Key Props (for Harmony Guide)
    detectedKey: KeyInfo | null;
}

export const EffectsController: React.FC<EffectsControllerProps> = ({
    controller,
    pitch,
    tempo,
    reverb,
    echo,
    bass,
    mid,
    treble,
    onPitchChange,
    onTempoChange,
    onReverbChange,
    onEchoChange,
    onBassChange,
    onMidChange,
    onTrebleChange,
    onResetEffects,
    pitchAnalysis,
    harmonyGuide,
    detectedKey
}) => {
    const t = useTranslations('KaraokePlayer');
    const [showPitchAnalysis, setShowPitchAnalysis] = useState(false);
    const [showHarmonyGuide, setShowHarmonyGuide] = useState(false);

    return (
        <div className="flex flex-col gap-4">
            <EffectsPanel
                pitch={pitch}
                tempo={tempo}
                reverb={reverb}
                echo={echo}
                bass={bass}
                mid={mid}
                treble={treble}
                onPitchChange={onPitchChange}
                onTempoChange={onTempoChange}
                onReverbChange={onReverbChange}
                onEchoChange={onEchoChange}
                onBassChange={onBassChange}
                onMidChange={onMidChange}
                onTrebleChange={onTrebleChange}
                onReset={onResetEffects}
            />

            <StemIsolationPanel controller={controller} />

            <div className="space-y-2">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            if (pitchAnalysis.isListening) {
                                pitchAnalysis.stopAnalysis();
                            } else {
                                setShowPitchAnalysis(true);
                                pitchAnalysis.startAnalysis();
                            }
                        }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                            pitchAnalysis.isListening
                                ? 'bg-purple-500/30 text-purple-300 ring-1 ring-purple-500/40'
                                : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80 border border-white/10'
                        }`}
                    >
                        🎯 {pitchAnalysis.isListening ? t('stopAnalysis') || 'Stop Analysis' : t('pitchAnalysis') || 'Pitch Analysis'}
                    </button>
                    {pitchAnalysis.overallScore && (
                        <button
                            onClick={() => {
                                pitchAnalysis.resetAnalysis();
                                setShowPitchAnalysis(false);
                            }}
                            className="text-xs text-white/40 hover:text-white/60 transition-colors"
                        >
                            {t('resetScore') || 'Reset'}
                        </button>
                    )}
                    {pitchAnalysis.error && (
                        <span className="text-xs text-red-400">{pitchAnalysis.error}</span>
                    )}
                </div>
                {showPitchAnalysis && (
                    <PitchVisualizer
                        currentScore={pitchAnalysis.currentScore}
                        currentPitch={pitchAnalysis.currentPitch}
                        overallScore={pitchAnalysis.overallScore}
                        isListening={pitchAnalysis.isListening}
                    />
                )}
            </div>

            {/* Harmony Guide */}
            <div className="space-y-2">
                <button
                    onClick={() => setShowHarmonyGuide(!showHarmonyGuide)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                        showHarmonyGuide
                            ? 'bg-amber-500/30 text-amber-300 ring-1 ring-amber-500/40'
                            : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80 border border-white/10'
                    }`}
                >
                    🎶 Harmony Guide
                </button>
                {showHarmonyGuide && (
                    <HarmonyGuidePanel
                        detectedKey={detectedKey}
                        harmonyEnabled={harmonyGuide.harmonyEnabled}
                        onToggleHarmony={harmonyGuide.setHarmonyEnabled}
                        suggestions={harmonyGuide.getSuggestions(
                            pitchAnalysis.pitchHistory.length > 0
                                ? pitchAnalysis.pitchHistory[pitchAnalysis.pitchHistory.length - 1].referenceMidi
                                : 0
                        )}
                        lastMatch={harmonyGuide.lastMatch}
                        totalHarmonyHits={harmonyGuide.totalHarmonyHits}
                        harmonyBonus={pitchAnalysis.overallScore?.harmonyBonus ?? 0}
                        onClose={() => setShowHarmonyGuide(false)}
                    />
                )}
            </div>
        </div>
    );
};

