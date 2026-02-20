'use client';

/**
 * PitchVisualizer — Real-time pitch accuracy display.
 *
 * Shows a scrolling pitch trace comparing the user's voice
 * against the reference pitch, plus live accuracy score and
 * a final grade card.
 */

import React from 'react';
import type { PerformanceScore, PerformanceGrade } from '@/types/audio';
import { useTranslations } from 'next-intl';

const GRADE_COLORS: Record<PerformanceGrade, string> = {
    S: '#fbbf24', // amber
    A: '#34d399', // emerald
    B: '#60a5fa', // blue
    C: '#f97316', // orange
    D: '#ef4444', // red
};

// ─── Sub-components ───────────────────────────────────────────────

interface ScoreOverlayProps {
    currentScore: number;
    currentPitch: number;
}

const ScoreOverlay: React.FC<ScoreOverlayProps> = ({ currentScore, currentPitch }) => (
    <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
        <div className="text-3xl font-black tabular-nums text-white/90"
            style={{
                color: currentScore >= 70 ? '#34d399' : currentScore >= 40 ? '#fbbf24' : '#ef4444',
                textShadow: '0 0 20px currentColor',
            }}
        >
            {currentScore}%
        </div>
        <div className="text-xs text-white/40 font-mono">
            {currentPitch > 0 ? `${currentPitch.toFixed(1)} Hz` : '—'}
        </div>
    </div>
);

interface GradeCardProps {
    score: PerformanceScore;
}

const GradeCard: React.FC<GradeCardProps> = ({ score }) => {
    const t = useTranslations('PitchAnalysis');
    const color = GRADE_COLORS[score.grade];

    return (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-md z-10 rounded-2xl">
            <div className="text-center space-y-3 p-6">
                <div className="text-7xl font-black" style={{ color, textShadow: `0 0 40px ${color}` }}>
                    {score.grade}
                </div>
                <div className="text-2xl font-bold text-white/90">
                    {score.overallAccuracy}% {t('accuracy') || 'Accuracy'}
                </div>
                <div className="flex gap-6 justify-center text-sm text-white/50">
                    <span>🎯 {score.notesHit}/{score.totalNotes} {t('notesHit') || 'notes hit'}</span>
                    <span>🔥 {score.longestStreak} {t('streak') || 'streak'}</span>
                </div>
            </div>
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────

interface PitchVisualizerProps {
    currentScore: number;
    currentPitch: number;
    overallScore: PerformanceScore | null;
    isListening: boolean;
}

export const PitchVisualizer: React.FC<PitchVisualizerProps> = ({
    currentScore,
    currentPitch,
    overallScore,
    isListening,
}) => {
    return (
        <div className="relative rounded-2xl bg-linear-to-b from-white/8 to-white/3 border border-white/10 overflow-hidden">
            {/* Score overlay (top right) */}
            {isListening && <ScoreOverlay currentScore={currentScore} currentPitch={currentPitch} />}

            {/* Grade card (shown after stop) */}
            {overallScore && !isListening && <GradeCard score={overallScore} />}

            {/* Transparent placeholder instead of local canvas to allow underlying background to render */}
            <div className="w-full h-48 md:h-56" />

            {/* Legend */}
            <div className="flex items-center gap-4 px-4 py-2 text-[10px] text-white/30 border-t border-white/5">
                <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-0.5 bg-emerald-400 rounded" /> Reference
                </span>
                <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-0.5 bg-purple-400 rounded" /> Your Voice
                </span>
            </div>
        </div>
    );
};
