import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { PlaybackController } from '@/utils/audio/playbackController';
import { EffectsPanel } from './EffectsPanel';
import { StemIsolationPanel } from './StemIsolationPanel';
import { PitchVisualizer } from './PitchVisualizer';
import { HarmonySuggestion, HarmonyMatchResult } from '@/utils/audio/harmonyGuide';
import { HarmonyGuidePanel } from './HarmonyGuidePanel';
import { ThemeSelector } from '../UI/ThemeSelector';
import { PitchAnalysisResult, PerformanceScore } from '@/types/audio';
import { KeyInfo } from '@/utils/audio/keyDetection';
import { AnimatePresence, motion } from 'framer-motion';
import { MultiTrackMixer } from './Mixer/MultiTrackMixer';
import { Sliders, X, Palette } from 'lucide-react';

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
        currentCombo: number;
        lastHitType: 'perfect' | 'great' | 'good' | 'miss' | null;
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
    const [showMixer, setShowMixer] = useState(false);
    const [adaptiveAssist, setAdaptiveAssist] = useState(controller.isAdaptiveAssistActive());

    const toggleAdaptiveAssist = () => {
        const newValue = !adaptiveAssist;
        setAdaptiveAssist(newValue);
        controller.setAdaptiveAssist(newValue);
    };

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

                    <button
                        onClick={() => setShowMixer(!showMixer)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                            showMixer
                                ? 'bg-cyan-500/30 text-cyan-300 ring-1 ring-cyan-500/40 shadow-lg shadow-cyan-500/20'
                                : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80 border border-white/10'
                        }`}
                    >
                        <Sliders className="w-4 h-4" />
                        Studio Mixer
                    </button>

                    <button
                        onClick={toggleAdaptiveAssist}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all group relative overflow-hidden ${
                            adaptiveAssist
                                ? 'bg-indigo-500/30 text-indigo-300 ring-1 ring-indigo-500/40 shadow-lg shadow-indigo-500/20'
                                : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80 border border-white/10'
                        }`}
                    >
                        <div className={`absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity ${adaptiveAssist ? 'opacity-100' : ''}`} />
                        <span className="relative z-10 flex items-center gap-2">
                             {adaptiveAssist ? '✨' : '🪄'} {t('vocalAssist') || 'Vocal Assist'}
                             {adaptiveAssist && (
                                 <motion.span
                                     animate={{ scale: [1, 1.2, 1] }}
                                     transition={{ repeat: Infinity, duration: 2 }}
                                     className="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]"
                                 />
                             )}
                        </span>
                    </button>

                    {pitchAnalysis.currentScore > 0 && (
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
                                currentCombo={pitchAnalysis.currentCombo}
                                lastHitType={pitchAnalysis.lastHitType}
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

                    {showMixer && (
                        <div key="mixer-overlay">
                            <MultiTrackMixer 
                                controller={controller} 
                                onClose={() => setShowMixer(false)} 
                            />
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

