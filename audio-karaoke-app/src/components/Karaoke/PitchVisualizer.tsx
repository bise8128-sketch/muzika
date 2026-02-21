'use client';

/**
 * PitchVisualizer — Real-time pitch accuracy display.
 *
 * Shows a scrolling pitch trace comparing the user's voice
 * against the reference pitch, plus live accuracy score and
 * a final grade card.
 */

import React from 'react';
import type { PerformanceScore, PerformanceGrade, PitchAnalysisResult } from '@/types/audio';
import { motion, AnimatePresence } from 'framer-motion';

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

interface ComboCounterProps {
    combo: number;
}

const ComboCounter: React.FC<ComboCounterProps> = ({ combo }) => {
    if (combo < 2) return null;

    return (
        <div className="absolute top-1/2 left-6 -translate-y-1/2 flex flex-col items-center justify-center pointer-events-none z-10">
            <motion.div
                key={combo}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center"
            >
                <div className="text-5xl font-black text-white italic tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
                    {combo}
                </div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50 -mt-1">
                    Combo
                </div>
            </motion.div>
        </div>
    );
};

const HitFeedback: React.FC<HitFeedbackProps> = ({ hitType }) => {
    if (!hitType || hitType === 'miss') return null;

    const config = {
        perfect: { label: 'PERFECT', color: 'text-emerald-400' },
        great: { label: 'GREAT', color: 'text-blue-400' },
        good: { label: 'GOOD', color: 'text-amber-400' },
    }[hitType];

    // Use a unique key based on hitType and a fixed timestamp from when the hit occurred
    // for Framer Motion, but avoid calling Date.now() directly in render.
    // Actually, for feedback text, just using hitType is enough if we want it to animate 
    // when it changes. If we want multiple consecutive 'perfect' to re-animate, we'd need
    // a more robust approach, but for now let's fix the purity issue.
    
    return (
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 pointer-events-none z-10">
            <motion.div
                key={hitType}
                initial={{ y: 20, opacity: 0, scale: 0.8 }}
                animate={{ y: -20, opacity: 1, scale: 1.2 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className={`text-xl font-black tracking-widest italic drop-shadow-lg ${config.color}`}
            >
                {config.label}
            </motion.div>
        </div>
    );
};

interface GradeCardProps {
    score: PerformanceScore;
}

const GradeCard: React.FC<GradeCardProps> = ({ score }) => {
    const color = GRADE_COLORS[score.grade];

    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.9, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, scale: 1, backdropFilter: 'blur(12px)' }}
            className="absolute inset-0 flex items-center justify-center bg-black/40 z-20 rounded-2xl"
        >
            <div className="text-center space-y-6 p-8 relative overflow-hidden">
                {/* Glow Background */}
                <div 
                    className="absolute inset-0 -z-10 blur-[100px] opacity-20"
                    style={{ background: color }}
                />

                <div className="space-y-1">
                    <motion.div 
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40"
                    >
                        Performance Grade
                    </motion.div>
                    <motion.div 
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', delay: 0.3 }}
                        className="text-8xl font-black italic" 
                        style={{ color, textShadow: `0 0 50px ${color}80` }}
                    >
                        {score.grade}
                    </motion.div>
                </div>

                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="grid grid-cols-2 gap-4"
                >
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                        <div className="text-2xl font-bold text-white">{score.overallAccuracy}%</div>
                        <div className="text-[10px] uppercase tracking-wider text-white/30">Accuracy</div>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                        <div className="text-2xl font-bold text-white">{score.longestStreak}</div>
                        <div className="text-[10px] uppercase tracking-wider text-white/30">Max Combo</div>
                    </div>
                </motion.div>

                <motion.button
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.7 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white text-sm font-bold rounded-full border border-white/20 transition-all uppercase tracking-widest"
                >
                    Back to Laboratory
                </motion.button>
            </div>
        </motion.div>
    );
};

// ─── Main Component ───────────────────────────────────────────────

interface PitchVisualizerProps {
    currentScore: number;
    currentPitch: number;
    currentCombo: number;
    lastHitType: 'perfect' | 'great' | 'good' | 'miss' | null;
    overallScore: PerformanceScore | null;
    pitchHistory: PitchAnalysisResult[];
    isListening: boolean;
}

export const PitchVisualizer: React.FC<PitchVisualizerProps> = ({
    currentScore,
    currentPitch,
    currentCombo,
    lastHitType,
    overallScore,
    pitchHistory,
    isListening,
}) => {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);

    React.useEffect(() => {
        if (!isListening || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationId: number;

        const render = () => {
            const w = canvas.width;
            const h = canvas.height;

            // Clear background with translucent dark fill for trails
            ctx.fillStyle = 'rgba(10, 10, 15, 0.3)';
            ctx.fillRect(0, 0, w, h);

            if (pitchHistory.length < 2) {
                animationId = requestAnimationFrame(render);
                return;
            }

            // Draw horizontal guide lines (every octave within range)
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.lineWidth = 1;
            const MIDI_MIN = 36;
            const MIDI_RANGE = 48;
            for (let m = MIDI_MIN; m <= MIDI_MIN + MIDI_RANGE; m += 12) {
                const y = h - ((m - MIDI_MIN) / MIDI_RANGE) * h;
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(w, y);
                ctx.stroke();
            }

            const now = pitchHistory[pitchHistory.length - 1].timestamp;
            const currentX = w * 0.8; // Current time at 80% of width
            const pixelsPerSecond = w * 0.3; // 3 seconds visible

            const timeToX = (t: number) => currentX + (t - now) * pixelsPerSecond;
            const midiToY = (m: number) => h - ((m - MIDI_MIN) / MIDI_RANGE) * h;

            // Draw Trace
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // We only draw the last ~10 seconds of history for performance
            const visibleHistory = pitchHistory.slice(-200);

            for (let i = 1; i < visibleHistory.length; i++) {
                const p1 = visibleHistory[i - 1];
                const p2 = visibleHistory[i];

                if (p1.detectedMidi <= 0 || p2.detectedMidi <= 0) continue;

                const x1 = timeToX(p1.timestamp);
                const y1 = midiToY(p1.detectedMidi);
                const x2 = timeToX(p2.timestamp);
                const y2 = midiToY(p2.detectedMidi);

                if (x2 < 0 || x1 > w) continue;

                // Color based on accuracy
                const acc = p2.accuracy;
                // Green for hit, Yellow for close, Red for miss
                const color = acc >= 70 ? '#34d399' : acc >= 40 ? '#fbbf24' : '#ef4444';
                
                ctx.strokeStyle = color;
                ctx.shadowBlur = acc >= 70 ? 10 : 0;
                ctx.shadowColor = color;

                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            }

            // Draw reference target (optional indicator at current time)
            const latest = pitchHistory[pitchHistory.length - 1];
            if (latest.referenceMidi > 0) {
                const ry = midiToY(latest.referenceMidi);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.beginPath();
                ctx.arc(currentX, ry, 4, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.shadowBlur = 0;
            animationId = requestAnimationFrame(render);
        };

        render();

        return () => cancelAnimationFrame(animationId);
    }, [isListening, pitchHistory]);
    return (
        <div className="relative rounded-2xl bg-linear-to-b from-white/8 to-white/3 border border-white/10 overflow-hidden">
            {/* Score overlay (top right) */}
            {isListening && <ScoreOverlay currentScore={currentScore} currentPitch={currentPitch} />}

            {/* Combo and Hit Feedback */}
            <AnimatePresence>
                {isListening && <ComboCounter combo={currentCombo} />}
                {isListening && <HitFeedback hitType={lastHitType} />}
            </AnimatePresence>

            {/* Grade card (shown after stop) */}
            {overallScore && !isListening && <GradeCard score={overallScore} />}

            <canvas 
                ref={canvasRef}
                width={800}
                height={200}
                className="w-full h-48 md:h-56 block"
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
