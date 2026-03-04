'use client';

/**
 * VocalScoreOverlay
 *
 * Real-time vocal performance HUD displayed inside KaraokeDisplay.
 * Shows accuracy arc, combo counter, hit badge, and a rolling pitch trail.
 *
 * Design: premium glassmorphism per premium-visuals skill guidelines.
 * Animations: Framer Motion at 60fps, always via rAF (no layout thrash).
 */

import React, { useRef } from 'react';
import { motion, AnimatePresence, useSpring, useTransform, MotionValue } from 'framer-motion';
import type { PitchAnalysisResult } from '@/types/audio';

// ─── Types ───────────────────────────────────────────────────

interface VocalScoreOverlayProps {
  isVisible: boolean;
  score: number;                      // 0–100
  combo: number;
  lastHit: 'perfect' | 'great' | 'good' | 'miss' | null;
  pitchHistory: PitchAnalysisResult[];
}

// ─── Constants ───────────────────────────────────────────────

const HIT_CONFIG = {
  perfect: { label: 'PERFECT ✦', color: '#a78bfa', glow: 'rgba(167,139,250,0.6)' },
  great:   { label: 'GREAT ★',   color: '#34d399', glow: 'rgba(52,211,153,0.5)' },
  good:    { label: 'GOOD ◆',    color: '#60a5fa', glow: 'rgba(96,165,250,0.4)' },
  miss:    { label: 'MISS',       color: '#f87171', glow: 'rgba(248,113,113,0.4)' },
} as const;

const ARC_RADIUS = 44;
const ARC_CIRCUMFERENCE = 2 * Math.PI * ARC_RADIUS;

// ─── Sub: Accuracy Arc ─────────────────────────────────────

const AccuracyArc: React.FC<{ score: number }> = ({ score }) => {
  const springScore = useSpring(score, { stiffness: 60, damping: 20 });
  const strokeDashoffset = useTransform(
    springScore,
    (s) => ARC_CIRCUMFERENCE * (1 - s / 100)
  );

  // Arc color from red → yellow → green
  const strokeColor = useTransform(
    springScore,
    [0, 50, 80, 100],
    ['#f87171', '#fbbf24', '#34d399', '#a78bfa']
  );

  return (
    <div className="relative w-28 h-28 flex items-center justify-center">
      <svg width="112" height="112" className="absolute inset-0 -rotate-90">
        {/* Track */}
        <circle
          cx="56" cy="56" r={ARC_RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="6"
        />
        {/* Progress */}
        <motion.circle
          cx="56" cy="56" r={ARC_RADIUS}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          style={{
            stroke: strokeColor as unknown as MotionValue<string>,
            strokeDasharray: ARC_CIRCUMFERENCE,
            strokeDashoffset,
            filter: `drop-shadow(0 0 6px currentColor)`,
          }}
        />
      </svg>
      {/* Center label */}
      <div className="flex flex-col items-center select-none">
        <motion.span
          className="text-2xl font-bold text-white leading-none tabular-nums"
          style={{ textShadow: '0 0 12px rgba(167,139,250,0.8)' }}
        >
          {Math.round(score)}
        </motion.span>
        <span className="text-[10px] text-white/50 uppercase tracking-widest mt-0.5">accuracy</span>
      </div>
    </div>
  );
};

// ─── Sub: Combo Counter ────────────────────────────────────

const ComboCounter: React.FC<{ combo: number }> = ({ combo }) => {
  if (combo < 3) return null;

  const tier = combo >= 30 ? 'legendary' : combo >= 20 ? 'fire' : combo >= 10 ? 'hot' : 'rising';
  const tierStyle = {
    legendary: { label: '★ LEGENDARY', color: '#a78bfa' },
    fire:      { label: '🔥 ON FIRE',   color: '#fb923c' },
    hot:       { label: '🎯 HOT',       color: '#fbbf24' },
    rising:    { label: '⚡ STREAK',    color: '#60a5fa' },
  }[tier];

  return (
    <motion.div
      key={tier}
      initial={{ scale: 0.6, opacity: 0, y: 10 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="flex flex-col items-center select-none"
    >
      <span
        className="text-xs font-semibold uppercase tracking-widest"
        style={{ color: tierStyle.color, textShadow: `0 0 10px ${tierStyle.color}` }}
      >
        {tierStyle.label}
      </span>
      <motion.span
        key={combo}
        initial={{ scale: 1.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-4xl font-extrabold text-white leading-none"
        style={{ textShadow: `0 0 20px ${tierStyle.color}` }}
      >
        ×{combo}
      </motion.span>
    </motion.div>
  );
};

// ─── Sub: Hit Badge ────────────────────────────────────────

const HitBadge: React.FC<{ hit: VocalScoreOverlayProps['lastHit'] }> = ({ hit }) => {
  if (!hit) return null;

  const cfg = HIT_CONFIG[hit];
  return (
    <motion.div
      key={`${hit}-${Date.now()}`}
      initial={{ opacity: 0, scale: 0.5, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: -10 }}
      transition={{ type: 'spring', stiffness: 400, damping: 18 }}
      className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest select-none"
      style={{
        backgroundColor: `${cfg.color}22`,
        border: `1px solid ${cfg.color}55`,
        color: cfg.color,
        boxShadow: `0 0 16px ${cfg.glow}`,
      }}
    >
      {cfg.label}
    </motion.div>
  );
};

// ─── Sub: Pitch Trail ─────────────────────────────────────

const TRAIL_WIDTH = 180;
const TRAIL_HEIGHT = 40;
const MAX_TRAIL = 40;

const PitchTrail: React.FC<{ history: PitchAnalysisResult[] }> = ({ history }) => {
  const slice = history.slice(-MAX_TRAIL);
  if (slice.length < 2) return null;

  // Map accuracy → Y position
  const points = slice.map((r, i) => {
    const x = (i / (MAX_TRAIL - 1)) * TRAIL_WIDTH;
    const y = TRAIL_HEIGHT - (r.accuracy / 100) * TRAIL_HEIGHT;
    return { x, y, accuracy: r.accuracy };
  });

  // SVG polyline
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');

  // Color the last dot by hit type  
  const last = slice[slice.length - 1];
  const dotColor =
    last.accuracy >= 90 ? '#a78bfa' :
    last.accuracy >= 70 ? '#34d399' :
    last.accuracy >= 50 ? '#60a5fa' :
                          '#f87171';

  return (
    <svg
      width={TRAIL_WIDTH} height={TRAIL_HEIGHT + 8}
      className="opacity-80"
      aria-hidden="true"
    >
      {/* Zero line */}
      <line x1="0" y1={TRAIL_HEIGHT} x2={TRAIL_WIDTH} y2={TRAIL_HEIGHT}
        stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

      {/* Trail path */}
      <path
        d={d}
        fill="none"
        stroke="url(#pitchGrad)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Gradient definition */}
      <defs>
        <linearGradient id="pitchGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#60a5fa" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.9" />
        </linearGradient>
      </defs>

      {/* Latest dot */}
      {points.length > 0 && (
        <motion.circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r="4"
          fill={dotColor}
          style={{ filter: `drop-shadow(0 0 4px ${dotColor})` }}
          initial={{ r: 2 }}
          animate={{ r: 4 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        />
      )}
    </svg>
  );
};

// ─── Main Component ───────────────────────────────────────

export const VocalScoreOverlay: React.FC<VocalScoreOverlayProps> = ({
  isVisible,
  score,
  combo,
  lastHit,
  pitchHistory,
}) => {
  const prevHitRef = useRef<typeof lastHit>(null);
  const showBadge = lastHit !== null && lastHit !== prevHitRef.current;
  if (showBadge) prevHitRef.current = lastHit;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="absolute top-4 left-4 z-20 flex flex-col gap-3 pointer-events-none select-none"
          role="status"
          aria-label={`Score: ${Math.round(score)}, Combo: ${combo}`}
          aria-live="polite"
        >
          {/* Glass panel */}
          <div
            className="rounded-2xl p-3 flex flex-col items-center gap-3"
            style={{
              background: 'rgba(0, 0, 0, 0.45)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 4px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
            }}
          >
            {/* Accuracy Arc */}
            <AccuracyArc score={score} />

            {/* Pitch Trail */}
            <PitchTrail history={pitchHistory} />

            {/* Hit Badge */}
            <AnimatePresence mode="wait">
              <HitBadge key={`${lastHit}-${pitchHistory.length}`} hit={lastHit} />
            </AnimatePresence>

            {/* Combo Counter */}
            <AnimatePresence mode="wait">
              <ComboCounter key={combo} combo={combo} />
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
