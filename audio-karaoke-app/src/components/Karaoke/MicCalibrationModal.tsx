/**
 * MicCalibrationModal
 *
 * A glassmorphic pre-session modal that:
 *   1. Requests mic access and measures RMS over 5 seconds
 *   2. Draws a live RMS meter that pulses with voice input
 *   3. Saves the computed noise floor to settingsStore
 *   4. Exposes onComplete so the parent can proceed to start analysis
 *
 * Design follows premium-visuals skill: backdrop blur, subtle borders,
 * vibrant gradients, micro-animations at 60fps.
 */

'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { saveSettings } from '@/utils/storage/settingsStore';

// ─── Types ───────────────────────────────────────────────────

export interface MicCalibrationModalProps {
  isOpen: boolean;
  onComplete: (noiseFloor: number) => void;
  onSkip: () => void;
}

type CalibrationPhase = 'request' | 'measuring' | 'done' | 'error';

// ─── Constants ───────────────────────────────────────────────

const CALIBRATION_DURATION_MS = 5000;
const METER_HISTORY = 60; // samples for the waveform strip

// ─── RMS computation (no allocation in the hot path) ─────────

function computeRms(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }
  return Math.sqrt(sum / buffer.length);
}

// ─── Main Component ───────────────────────────────────────────

export const MicCalibrationModal: React.FC<MicCalibrationModalProps> = ({
  isOpen,
  onComplete,
  onSkip,
}) => {
  // Phase state
  const [phase, setPhase] = useState<CalibrationPhase>('request');
  const [progress, setProgress] = useState(0);         // 0–100
  const [currentRms, setCurrentRms] = useState(0);     // 0–1 for meter
  const [meterHistory, setMeterHistory] = useState<number[]>(Array(METER_HISTORY).fill(0));
  const [computedFloor, setComputedFloor] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  // Refs — none of these trigger re-renders
  const streamRef  = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rmsBuffer  = useRef<Float32Array | null>(null);
  const peakSamples = useRef<number[]>([]);
  const rafRef     = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  // ── Cleanup ───────────────────────────────────────────────

  const cleanup = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (contextRef.current && contextRef.current.state !== 'closed') {
      contextRef.current.close();
      contextRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      cleanup();
      setPhase('request');
      setProgress(0);
      setCurrentRms(0);
      setMeterHistory(Array(METER_HISTORY).fill(0));
      peakSamples.current = [];
    }
  }, [isOpen, cleanup]);

  useEffect(() => () => cleanup(), [cleanup]);

  // ── Start calibration ─────────────────────────────────────

  const startCalibration = useCallback(async () => {
    try {
      setPhase('measuring');
      peakSamples.current = [];
      startTimeRef.current = performance.now();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      streamRef.current = stream;

      const ctx = new AudioContext();
      contextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      analyserRef.current = analyser;

      rmsBuffer.current = new Float32Array(analyser.fftSize);

      // ── rAF measurement loop ────────────────────────────

      const measure = () => {
        const now = performance.now();
        const elapsed = now - startTimeRef.current;

        if (!analyserRef.current || !rmsBuffer.current) return;

        analyserRef.current.getFloatTimeDomainData(rmsBuffer.current);
        const rms = computeRms(rmsBuffer.current);
        peakSamples.current.push(rms);

        const prog = Math.min(100, (elapsed / CALIBRATION_DURATION_MS) * 100);
        setProgress(prog);
        setCurrentRms(rms);
        setMeterHistory(prev => {
          const next = [...prev.slice(1), rms * 4]; // amplify for visibility
          return next;
        });

        if (elapsed < CALIBRATION_DURATION_MS) {
          rafRef.current = requestAnimationFrame(measure);
        } else {
          finishCalibration();
        }
      };

      rafRef.current = requestAnimationFrame(measure);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Microphone access denied';
      setErrorMessage(msg);
      setPhase('error');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Compute noise floor from collected samples ────────────

  const finishCalibration = useCallback(() => {
    const samples = peakSamples.current;
    if (samples.length === 0) {
      setPhase('error');
      setErrorMessage('No audio samples captured.');
      cleanup();
      return;
    }

    // Sort and take the 25th percentile as the noise floor
    // (avoids outliers from throat-clearing or accidental sounds)
    const sorted = [...samples].sort((a, b) => a - b);
    const p25 = sorted[Math.floor(sorted.length * 0.25)];
    // Add a 20% headroom buffer
    const floor = Math.min(0.3, p25 * 1.2);

    setComputedFloor(floor);
    saveSettings({ micNoiseFloor: floor });
    cleanup();
    setPhase('done');
  }, [cleanup]);

  // ── Sub: Waveform Strip ───────────────────────────────────

  const WaveformStrip = () => (
    <svg width="240" height="48" aria-hidden="true">
      {meterHistory.map((v, i) => {
        const barH = Math.max(2, Math.min(46, v * 46));
        const x = (i / METER_HISTORY) * 240;
        const hue = Math.round(200 + v * 120); // cyan → purple as louder
        return (
          <rect
            key={i}
            x={x} y={(48 - barH) / 2}
            width={3} height={barH}
            rx={1}
            fill={`hsl(${hue}, 80%, 65%)`}
            opacity={0.6 + v * 0.4}
          />
        );
      })}
    </svg>
  );

  // ── Sub: Progress Arc ─────────────────────────────────────

  const r = 32;
  const circ = 2 * Math.PI * r;

  const ProgressArc = () => (
    <svg width="80" height="80">
      <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
      <motion.circle
        cx="40" cy="40" r={r} fill="none"
        stroke="url(#calGrad)" strokeWidth="4" strokeLinecap="round"
        style={{ rotate: -90, transformOrigin: '40px 40px' }}
        strokeDasharray={circ}
        animate={{ strokeDashoffset: circ * (1 - progress / 100) }}
        transition={{ duration: 0.1, ease: 'linear' }}
      />
      <defs>
        <linearGradient id="calGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
      <text x="40" y="44" textAnchor="middle"
        fill="white" fontSize="14" fontWeight="700">
        {Math.round(progress)}%
      </text>
    </svg>
  );

  // ── Render ────────────────────────────────────────────────

  return (
    <AnimatePresence>
      {isOpen && (
        // Backdrop
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
          role="dialog"
          aria-modal="true"
          aria-label="Microphone calibration"
        >
          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="w-80 rounded-3xl p-6 flex flex-col items-center gap-5"
            style={{
              background: 'rgba(10, 10, 20, 0.85)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 8px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)',
            }}
          >
            {/* Header */}
            <div className="text-center">
              <div className="text-3xl mb-1">🎙️</div>
              <h2 className="text-white font-bold text-lg">Mic Calibration</h2>
              <p className="text-white/50 text-xs mt-1 leading-relaxed">
                {phase === 'request' && 'Calibrate your mic for accurate pitch scoring.'}
                {phase === 'measuring' && 'Sing or speak normally for 5 seconds…'}
                {phase === 'done' && 'Calibration complete! Noise floor saved.'}
                {phase === 'error' && 'Something went wrong.'}
              </p>
            </div>

            {/* Body — varies by phase */}
            {phase === 'request' && (
              <div className="text-center text-white/40 text-xs px-2">
                This helps Muzika ignore background noise so every note counts.
              </div>
            )}

            {phase === 'measuring' && (
              <div className="flex flex-col items-center gap-3 w-full">
                <ProgressArc />
                <WaveformStrip />
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
                  Listening…&nbsp;
                  <span className="tabular-nums text-white/70">
                    RMS {(currentRms * 100).toFixed(1)}
                  </span>
                </div>
              </div>
            )}

            {phase === 'done' && (
              <div className="flex flex-col items-center gap-2 w-full">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                  className="text-4xl"
                >
                  ✅
                </motion.div>
                <div className="text-xs text-white/50 text-center">
                  Noise floor: <span className="text-purple-300 font-mono">{(computedFloor * 1000).toFixed(1)}</span>
                  <span className="text-white/30"> mRMS</span>
                </div>
              </div>
            )}

            {phase === 'error' && (
              <div className="text-red-400 text-xs text-center px-2">
                {errorMessage}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 w-full">
              {phase === 'request' && (
                <>
                  <button
                    onClick={onSkip}
                    className="flex-1 py-2 rounded-xl text-sm text-white/40 hover:text-white/70 transition-colors"
                  >
                    Skip
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={startCalibration}
                    className="flex-1 py-2 rounded-xl text-sm font-semibold text-white"
                    style={{
                      background: 'linear-gradient(135deg, #6366f1, #a78bfa)',
                      boxShadow: '0 0 20px rgba(167,139,250,0.4)',
                    }}
                  >
                    Start
                  </motion.button>
                </>
              )}

              {phase === 'measuring' && (
                <button
                  onClick={() => { cleanup(); onSkip(); }}
                  className="flex-1 py-2 rounded-xl text-sm text-white/40 hover:text-white/70 transition-colors"
                >
                  Cancel
                </button>
              )}

              {phase === 'done' && (
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onComplete(computedFloor)}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold text-white"
                  style={{
                    background: 'linear-gradient(135deg, #34d399, #6366f1)',
                    boxShadow: '0 0 20px rgba(52,211,153,0.3)',
                  }}
                >
                  Start Singing →
                </motion.button>
              )}

              {phase === 'error' && (
                <>
                  <button
                    onClick={onSkip}
                    className="flex-1 py-2 rounded-xl text-sm text-white/40 hover:text-white/70 transition-colors"
                  >
                    Skip
                  </button>
                  <button
                    onClick={() => setPhase('request')}
                    className="flex-1 py-2 rounded-xl text-sm text-white/60 border border-white/10 hover:border-white/20 transition-colors"
                  >
                    Retry
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
