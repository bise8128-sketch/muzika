'use client';

/**
 * HarmonyGuidePanel — Premium glassmorphic panel showing real-time
 * harmony suggestions and feedback during karaoke performance.
 */

import React, { useEffect, useState } from 'react';
import type { HarmonySuggestion, HarmonyMatchResult, HarmonyInterval } from '@/utils/audio/harmonyGuide';
import type { KeyInfo } from '@/utils/audio/keyDetection';
import { useTranslations } from 'next-intl';

// ─── Types ──────────────────────────────────────────────────────────

interface HarmonyGuidePanelProps {
    detectedKey: KeyInfo | null;
    harmonyEnabled: boolean;
    onToggleHarmony: (enabled: boolean) => void;
    suggestions: HarmonySuggestion[];
    lastMatch: HarmonyMatchResult | null;
    totalHarmonyHits: number;
    harmonyBonus: number;
    onClose: () => void;
}

// ─── Constants ──────────────────────────────────────────────────────

const INTERVAL_COLORS: Record<HarmonyInterval, string> = {
    '3rd': 'from-amber-400 to-orange-500',
    '5th': 'from-cyan-400 to-blue-500',
    octave: 'from-purple-400 to-pink-500',
};

const INTERVAL_ICONS: Record<HarmonyInterval, string> = {
    '3rd': '🎵',
    '5th': '🎶',
    octave: '🎼',
};

// ─── Sub-components ─────────────────────────────────────────────────

const HarmonyFeedback: React.FC<{ lastMatch: HarmonyMatchResult | null }> = ({ lastMatch }) => {
    const t = useTranslations('HarmonyGuide');
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (lastMatch?.isHarmony) {
            setVisible(true);
            const timer = setTimeout(() => setVisible(false), 1500);
            return () => clearTimeout(timer);
        }
    }, [lastMatch]);

    if (!visible || !lastMatch?.isHarmony || !lastMatch.matchedInterval) return null;

    return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <div className="animate-pulse text-center">
                <div
                    className={`text-2xl font-black bg-linear-to-r ${
                        INTERVAL_COLORS[lastMatch.matchedInterval]
                    } bg-clip-text text-transparent drop-shadow-lg`}
                >
                    ✨ {t('perfectHarmony', { interval: lastMatch.matchedInterval })}
                </div>
                <div className="text-sm text-amber-300/80 font-semibold mt-1">
                    {lastMatch.accuracy}% accuracy
                </div>
            </div>
        </div>
    );
};

const SuggestionCard: React.FC<{ suggestion: HarmonySuggestion }> = ({ suggestion }) => {
    const t = useTranslations('HarmonyGuide');
    const gradient = INTERVAL_COLORS[suggestion.interval];
    const icon = INTERVAL_ICONS[suggestion.interval];
    const label = suggestion.interval === '3rd' ? t('tryThird') : suggestion.interval === '5th' ? t('tryFifth') : 'Octave';

    return (
        <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10 hover:bg-white/8 transition-all group">
            <div className={`w-10 h-10 rounded-lg bg-linear-to-br ${gradient} flex items-center justify-center text-lg shadow-lg group-hover:scale-110 transition-transform`}>
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white/80">{label}</div>
                <div className="text-xs text-white/40">
                    +{suggestion.semitonesFromRoot} semitones
                </div>
            </div>
            <div className={`text-lg font-bold bg-linear-to-r ${gradient} bg-clip-text text-transparent`}>
                {suggestion.noteName}
            </div>
        </div>
    );
};

// ─── Main Component ─────────────────────────────────────────────────

export const HarmonyGuidePanel: React.FC<HarmonyGuidePanelProps> = ({
    detectedKey,
    harmonyEnabled,
    onToggleHarmony,
    suggestions,
    lastMatch,
    totalHarmonyHits,
    harmonyBonus,
    onClose,
}) => {
    const t = useTranslations('HarmonyGuide');

    return (
        <div className="relative bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl p-6 w-80 text-white shadow-2xl overflow-hidden">
            {/* Harmony match feedback overlay */}
            <HarmonyFeedback lastMatch={lastMatch} />

            {/* Header */}
            <div className="flex justify-between items-center mb-5">
                <div>
                    <h3 className="text-xl font-bold bg-linear-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                        🎶 {t('title')}
                    </h3>
                    <p className="text-xs text-white/40 mt-0.5">{t('subtitle')}</p>
                </div>
                <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Key display */}
            {detectedKey && (
                <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-white/5 rounded-lg border border-white/10">
                    <span className="text-xs text-white/40">Key:</span>
                    <span className="text-sm font-bold text-cyan-400">
                        {detectedKey.tonic} {detectedKey.scale}
                    </span>
                </div>
            )}

            {/* Toggle */}
            <div className="flex items-center justify-between mb-5 px-1">
                <span className="text-sm font-medium text-white/70">{t('enable')}</span>
                <button
                    onClick={() => onToggleHarmony(!harmonyEnabled)}
                    className={`relative w-12 h-6 rounded-full transition-all duration-300 ${
                        harmonyEnabled
                            ? 'bg-linear-to-r from-amber-500 to-orange-500 shadow-lg shadow-amber-500/30'
                            : 'bg-white/10'
                    }`}
                >
                    <div
                        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-300 ${
                            harmonyEnabled ? 'left-6.5' : 'left-0.5'
                        }`}
                    />
                </button>
            </div>

            {/* Suggestions */}
            {harmonyEnabled && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-500">
                    {!detectedKey ? (
                        <div className="text-center py-6 text-white/30 text-sm">
                            Run Key Detection first to enable harmony suggestions
                        </div>
                    ) : suggestions.length > 0 ? (
                        <div className="space-y-2">
                            {suggestions
                                .filter(s => s.interval !== 'octave')
                                .map(s => (
                                    <SuggestionCard key={s.interval} suggestion={s} />
                                ))}
                        </div>
                    ) : (
                        <div className="text-center py-4 text-white/30 text-sm">
                            Play the track to see harmony suggestions
                        </div>
                    )}

                    {/* Stats bar */}
                    {totalHarmonyHits > 0 && (
                        <div className="flex items-center justify-between pt-3 border-t border-white/10">
                            <div className="flex items-center gap-2">
                                <span className="text-amber-400 text-sm">🎯</span>
                                <span className="text-xs text-white/50">
                                    {totalHarmonyHits} {t('harmonyHits')}
                                </span>
                            </div>
                            <div className="px-2.5 py-1 bg-amber-500/20 border border-amber-500/30 rounded-lg">
                                <span className="text-xs font-bold text-amber-400">
                                    {t('bonus', { points: harmonyBonus })}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
