import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { PlaybackController } from '@/utils/audio/playbackController';
import { EffectsPanel } from './EffectsPanel';
import { StemIsolationPanel } from './StemIsolationPanel';
import { PitchVisualizer } from './PitchVisualizer';
import { HarmonyGuidePanel } from './HarmonyGuidePanel';
import { ThemeSelector } from './UI/ThemeSelector';
import { PitchAnalysisResult, PerformanceScore } from '@/types/audio';
import { KeyInfo } from '@/utils/audio/keyDetection';
import { HarmonySuggestion, HarmonyMatchResult } from '@/utils/audio/harmonyGuide';
import { Palette, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

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
    const [showThemePanel, setShowThemePanel] = useState(false);

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

            <div className="space-y-4">
                {/* Visual Analysis Toggles */}
                <div className="flex flex-wrap gap-3">
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
                                ? 'bg-purple-500/30 text-purple-300 ring-1 ring-purple-500/40 shadow-lg shadow-purple-500/20'
                                : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80 border border-white/10'
                        }`}
                    >
                        🎯 {pitchAnalysis.isListening ? t('stopAnalysis') || 'Stop Analysis' : t('pitchAnalysis') || 'Pitch Analysis'}
                    </button>

                    <button
                        onClick={() => setShowHarmonyGuide(!showHarmonyGuide)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                            showHarmonyGuide
                                ? 'bg-amber-500/30 text-amber-300 ring-1 ring-amber-500/40 shadow-lg shadow-amber-500/20'
                                : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80 border border-white/10'
                        }`}
                    >
                        🎶 Harmony Guide
                    </button>

                    <button
                        onClick={() => setShowThemePanel(!showThemePanel)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                            showThemePanel
                                ? 'bg-primary/30 text-primary ring-1 ring-primary/40 shadow-lg shadow-primary/20'
                                : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80 border border-white/10'
                        }`}
                    >
                        <Palette className="w-4 h-4" />
                        Themes
                    </button>

                    {pitchAnalysis.overallScore && (
                        <button
                            onClick={() => {
                                pitchAnalysis.resetAnalysis();
                                setShowPitchAnalysis(false);
                            }}
                            className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-white/20 hover:text-white/60 transition-colors"
                        >
                            {t('resetScore') || 'Reset Score'}
                        </button>
                    )}
                </div>

                {/* Feedback Panel (Pitch Visualizer) */}
                <AnimatePresence>
                    {showPitchAnalysis && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                        >
                            <PitchVisualizer
                                currentScore={pitchAnalysis.currentScore}
                                currentPitch={pitchAnalysis.currentPitch}
                                overallScore={pitchAnalysis.overallScore}
                                pitchHistory={pitchAnalysis.pitchHistory}
                                isListening={pitchAnalysis.isListening}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Floating Overlays */}
                <AnimatePresence mode="wait">
                    {showThemePanel && (
                        <motion.div
                            key="theme-panel"
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="fixed bottom-32 right-8 z-50 w-80 glass-premium border border-white/10 rounded-[2.5rem] shadow-2xl p-2"
                        >
                            <button 
                                onClick={() => setShowThemePanel(false)}
                                className="absolute top-6 right-6 p-2 text-white/20 hover:text-white/60 transition-colors z-10"
                            >
                                <X className="w-4 h-4" />
                            </button>
                            <ThemeSelector />
                        </motion.div>
                    )}

                    {showHarmonyGuide && (
                        <motion.div
                            key="harmony-panel"
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="fixed bottom-32 right-8 z-50 w-96 glass-premium border border-white/10 rounded-[2.5rem] shadow-2xl"
                        >
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
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

