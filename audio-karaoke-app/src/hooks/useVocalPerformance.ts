/**
 * useVocalPerformance — React hook for real-time vocal performance analysis.
 *
 * Wraps VocalPerformanceAnalyzer with stable callbacks, state management,
 * and automatic cleanup on unmount.
 *
 * @example
 *   const { start, stop, score, combo, lastHit, isAnalyzing, finalResults } =
 *     useVocalPerformance(audioContext, vocalBuffer, keyInfo);
 */

'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { VocalPerformanceAnalyzer } from '@/utils/audio/VocalPerformanceAnalyzer';
import type { PerformanceScore, PitchAnalysisResult } from '@/types/audio';
import type { KeyInfo } from '@/utils/audio/keyDetection';

export interface VocalPerformanceState {
  /** Start analyzing vocal performance */
  start: () => Promise<void>;
  /** Stop analyzing and get final results */
  stop: () => Promise<void>;
  /** Current accuracy score (0–100) */
  score: number;
  /** Current combo streak */
  combo: number;
  /** Last hit type classification */
  lastHit: 'perfect' | 'great' | 'good' | 'miss' | null;
  /** Latest pitch analysis result */
  latestResult: PitchAnalysisResult | null;
  /** Whether the analyzer is currently running */
  isAnalyzing: boolean;
  /** Final performance score (available after stop()) */
  finalResults: PerformanceScore | null;
  /** Error state */
  error: string | null;
}

export function useVocalPerformance(
  audioContext: AudioContext | null,
  vocalBuffer: AudioBuffer | null,
  keyInfo: KeyInfo | null,
): VocalPerformanceState {
  const analyzerRef = useRef<VocalPerformanceAnalyzer | null>(null);

  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [lastHit, setLastHit] = useState<VocalPerformanceState['lastHit']>(null);
  const [latestResult, setLatestResult] = useState<PitchAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [finalResults, setFinalResults] = useState<PerformanceScore | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (analyzerRef.current?.analyzing) {
        analyzerRef.current.stop().catch(() => { /* swallow */ });
      }
    };
  }, []);

  const start = useCallback(async () => {
    if (!audioContext) {
      setError('AudioContext is required');
      return;
    }

    try {
      setError(null);
      setFinalResults(null);
      setScore(0);
      setCombo(0);
      setLastHit(null);
      setLatestResult(null);

      const analyzer = new VocalPerformanceAnalyzer(audioContext);

      analyzer.onScoreUpdate = (update) => {
        setScore(update.result.accuracy);
        setCombo(update.currentCombo);
        setLastHit(update.lastHitType);
        setLatestResult(update.result);
      };

      analyzer.onError = (err) => {
        setError(err.message);
      };

      analyzerRef.current = analyzer;
      await analyzer.start(vocalBuffer, keyInfo);
      setIsAnalyzing(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start vocal analysis';
      setError(message);
      setIsAnalyzing(false);
    }
  }, [audioContext, vocalBuffer, keyInfo]);

  const stop = useCallback(async () => {
    if (!analyzerRef.current) return;

    try {
      const results = await analyzerRef.current.stop();
      setFinalResults(results);
      setIsAnalyzing(false);
      analyzerRef.current = null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to stop vocal analysis';
      setError(message);
      setIsAnalyzing(false);
    }
  }, []);

  return {
    start,
    stop,
    score,
    combo,
    lastHit,
    latestResult,
    isAnalyzing,
    finalResults,
    error,
  };
}
