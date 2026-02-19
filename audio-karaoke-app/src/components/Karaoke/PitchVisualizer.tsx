'use client';

/**
 * PitchVisualizer — Real-time pitch accuracy display.
 *
 * Shows a scrolling pitch trace comparing the user's voice
 * against the reference pitch, plus live accuracy score and
 * a final grade card.
 */

import React, { useRef, useEffect, useMemo } from 'react';
import type { PitchAnalysisResult, PerformanceScore, PerformanceGrade } from '@/types/audio';
import type { HarmonySuggestion } from '@/utils/audio/harmonyGuide';
import { useTranslations } from 'next-intl';

// ─── Constants ────────────────────────────────────────────────────

const VISIBLE_HISTORY = 100; // data-points displayed at once
const MIDI_RANGE = 36;       // C2–C5 vertical range
const MIDI_MIN = 36;         // C2

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
    pitchHistory: PitchAnalysisResult[];
    currentScore: number;
    currentPitch: number;
    overallScore: PerformanceScore | null;
    isListening: boolean;
    harmonySuggestions?: HarmonySuggestion[];
}

export const PitchVisualizer: React.FC<PitchVisualizerProps> = ({
    pitchHistory,
    currentScore,
    currentPitch,
    overallScore,
    isListening,
    harmonySuggestions,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Only render the last VISIBLE_HISTORY points
    const visibleData = useMemo(
        () => pitchHistory.slice(-VISIBLE_HISTORY),
        [pitchHistory]
    );

    // Canvas drawing
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);

        // Clear
        ctx.clearRect(0, 0, w, h);

        // Background grid lines (midi note grid)
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        for (let midi = MIDI_MIN; midi <= MIDI_MIN + MIDI_RANGE; midi += 12) {
            const y = h - ((midi - MIDI_MIN) / MIDI_RANGE) * h;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

        if (visibleData.length < 2) return;

        const stepX = w / VISIBLE_HISTORY;

        // Draw reference pitch line (dotted green)
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        visibleData.forEach((d, i) => {
            if (d.referenceMidi <= 0) return;
            const x = i * stepX;
            const y = h - ((d.referenceMidi - MIDI_MIN) / MIDI_RANGE) * h;
            if (i === 0 || visibleData[i - 1].referenceMidi <= 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw user pitch line (purple gradient based on accuracy)
        ctx.lineWidth = 3;
        visibleData.forEach((d, i) => {
            if (i === 0 || d.detectedMidi <= 0) return;
            const prev = visibleData[i - 1];
            if (prev.detectedMidi <= 0) return;

            const x0 = (i - 1) * stepX;
            const y0 = h - ((prev.detectedMidi - MIDI_MIN) / MIDI_RANGE) * h;
            const x1 = i * stepX;
            const y1 = h - ((d.detectedMidi - MIDI_MIN) / MIDI_RANGE) * h;

            // Color by accuracy
            const acc = d.accuracy;
            const r = acc >= 70 ? 147 : acc >= 40 ? 251 : 239;
            const g = acc >= 70 ? 51 : acc >= 40 ? 191 : 68;
            const b = acc >= 70 ? 234 : acc >= 40 ? 36 : 68;

            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.9)`;
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y1);
            ctx.stroke();
        });

        // Draw harmony target lines (gold dashed) when suggestions are present
        if (harmonySuggestions && harmonySuggestions.length > 0) {
            ctx.setLineDash([6, 4]);
            ctx.lineWidth = 1.5;

            for (const suggestion of harmonySuggestions) {
                const harmonyMidi = suggestion.midiNote;
                if (harmonyMidi < MIDI_MIN || harmonyMidi > MIDI_MIN + MIDI_RANGE) continue;

                const y = h - ((harmonyMidi - MIDI_MIN) / MIDI_RANGE) * h;

                // Gold color with slight variation per interval
                const alpha = suggestion.interval === '3rd' ? 0.5 : suggestion.interval === '5th' ? 0.4 : 0.3;
                ctx.strokeStyle = `rgba(251, 191, 36, ${alpha})`;

                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(w, y);
                ctx.stroke();

                // Label
                ctx.fillStyle = `rgba(251, 191, 36, ${alpha + 0.2})`;
                ctx.font = '9px monospace';
                ctx.fillText(`${suggestion.interval} (${suggestion.noteName})`, 4, y - 3);
            }

            ctx.setLineDash([]);
        }
    }, [visibleData, harmonySuggestions]);

    return (
        <div className="relative rounded-2xl bg-linear-to-b from-white/8 to-white/3 border border-white/10 overflow-hidden">
            {/* Score overlay (top right) */}
            {isListening && <ScoreOverlay currentScore={currentScore} currentPitch={currentPitch} />}

            {/* Grade card (shown after stop) */}
            {overallScore && !isListening && <GradeCard score={overallScore} />}

            {/* Canvas */}
            <canvas
                ref={canvasRef}
                className="w-full h-48 md:h-56"
                style={{ display: 'block' }}
            />

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
