/**
 * VocalPerformanceAnalyzer
 *
 * Orchestrates real-time vocal performance analysis by connecting:
 *   Microphone → AudioWorkletNode (pitch-detector) → pitchScoring.worker.ts
 *
 * The worklet runs YIN-based pitch detection in the audio render thread (zero
 * allocation in process()). Detected pitch frames are forwarded to the scoring
 * worker which compares against the reference vocal track and calculates
 * accuracy, combos, and hit types.
 *
 * Usage:
 *   const analyzer = new VocalPerformanceAnalyzer(audioContext);
 *   analyzer.onScoreUpdate = (update) => { ... };
 *   await analyzer.start(vocalBuffer, keyInfo);
 *   // ... user sings ...
 *   const finalScore = await analyzer.stop();
 */

import type { PitchAnalysisResult, PerformanceScore } from '../../types/audio';
import type { KeyInfo } from './keyDetection';
import { getReferencePitchAtTime } from './pitchAnalysis';
import { getSettings } from '@/utils/storage/settingsStore';

// ─── Message types (mirrored from pitchScoring.worker.ts) ───

interface ScoreUpdatePayload {
  result: PitchAnalysisResult;
  currentCombo: number;
  lastHitType: 'perfect' | 'great' | 'good' | 'miss' | null;
}

interface FinalStatePayload {
  overallScore: PerformanceScore;
  history: PitchAnalysisResult[];
}

// ─── Configuration ──────────────────────────────────────────

export interface VocalPerformanceConfig {
  /** Target analysis rate in frames. Lower = more CPU, higher frequency. Default: 6 (~57fps). */
  postInterval?: number;
  /** Minimum confidence threshold to forward a frame. Default: 0.3 */
  minConfidence?: number;
  /** RMS noise floor override. If not set, loaded from settingsStore. */
  noiseFloor?: number;
}

const DEFAULT_CONFIG: Required<Omit<VocalPerformanceConfig, 'noiseFloor'>> = {
  postInterval: 6,
  minConfidence: 0.3,
};

// ─── Analyzer ───────────────────────────────────────────────

export class VocalPerformanceAnalyzer {
  private audioContext: AudioContext;
  private config: Required<Omit<VocalPerformanceConfig, 'noiseFloor'>>;
  private noiseFloor: number;

  // Audio graph nodes
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;

  // Scoring worker
  private scoringWorker: Worker | null = null;

  // Reference data
  private vocalBuffer: AudioBuffer | null = null;
  private keyInfo: KeyInfo | null = null;

  // State
  private isRunning = false;
  private startTime = 0;

  // Callbacks
  public onScoreUpdate: ((update: ScoreUpdatePayload) => void) | null = null;
  public onError: ((error: Error) => void) | null = null;

  constructor(audioContext: AudioContext, config?: VocalPerformanceConfig) {
    this.audioContext = audioContext;
    this.config = { ...DEFAULT_CONFIG, ...config };
    // Load noise floor: explicit config > persisted setting > safe default
    this.noiseFloor = config?.noiseFloor ?? getSettings().micNoiseFloor;
  }

  /**
   * Start the analysis pipeline.
   * Acquires the microphone, loads the worklet, and begins streaming pitch
   * frames to the scoring worker.
   */
  async start(vocalBuffer: AudioBuffer | null, keyInfo: KeyInfo | null): Promise<void> {
    if (this.isRunning) {
      throw new Error('VocalPerformanceAnalyzer is already running');
    }

    this.vocalBuffer = vocalBuffer;
    this.keyInfo = keyInfo;

    try {
      // 1. Acquire microphone
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      this.micSource = this.audioContext.createMediaStreamSource(this.micStream);

      // 2. Register worklet module (idempotent in most browsers)
      await this.audioContext.audioWorklet.addModule(
        new URL('./pitchDetector.worklet.ts', import.meta.url)
      );

      // 3. Create worklet node
      this.workletNode = new AudioWorkletNode(this.audioContext, 'pitch-detector', {
        processorOptions: {
          sampleRate: this.audioContext.sampleRate,
        },
      });

      // Configure post interval
      this.workletNode.port.postMessage({
        type: 'SET_INTERVAL',
        interval: this.config.postInterval,
      });

      // 4. Initialize scoring worker
      this.scoringWorker = new Worker(
        new URL('./pitchScoring.worker.ts', import.meta.url),
        { type: 'module' }
      );
      this.scoringWorker.postMessage({ type: 'INIT' });

      // 5. Wire worklet → scoring worker
      this.workletNode.port.onmessage = (event: MessageEvent) => {
        const data = event.data;
        if (data.type !== 'pitch_data') return;

        const { frequency, confidence } = data as { frequency: number; confidence: number };

        // Gate: reject frames below noise-floor-scaled confidence threshold.
        // noiseFloor is in [0,1] RMS; multiply by 20 to map to confidence scale.
        const effectiveMinConfidence = Math.max(
          this.config.minConfidence,
          this.noiseFloor * 20
        );
        if (frequency <= 0 || confidence < effectiveMinConfidence) return;

        // Get reference vocal pitch at current playback time
        const currentTime = (performance.now() - this.startTime) / 1000;
        const refVocals = this.vocalBuffer
          ? getReferencePitchAtTime(this.vocalBuffer, currentTime)
          : null;

        this.scoringWorker?.postMessage({
          type: 'ADD_FRAME',
          payload: {
            frequency,
            confidence,
            currentTime,
            refVocals,
            keyInfo: this.keyInfo,
          },
        });
      };

      // 6. Wire scoring worker → callback
      this.scoringWorker.onmessage = (event: MessageEvent) => {
        const { type, payload } = event.data;
        if (type === 'SCORE_UPDATE' && this.onScoreUpdate) {
          this.onScoreUpdate(payload as ScoreUpdatePayload);
        }
      };

      this.scoringWorker.onerror = (event) => {
        this.onError?.(new Error(`Scoring worker error: ${event.message}`));
      };

      // 7. Connect audio graph: mic → worklet → (nowhere, just analysis)
      this.micSource.connect(this.workletNode);
      // Don't connect to destination — we only want analysis, not playback of mic input

      this.isRunning = true;
      this.startTime = performance.now();
    } catch (error) {
      // Clean up on failure
      this.cleanup();
      throw error;
    }
  }

  /**
   * Stop the analysis and return the final performance score.
   */
  async stop(): Promise<PerformanceScore | null> {
    if (!this.isRunning) return null;

    return new Promise<PerformanceScore | null>((resolve) => {
      if (!this.scoringWorker) {
        this.cleanup();
        resolve(null);
        return;
      }

      // Request final state from the scoring worker
      const timeout = setTimeout(() => {
        this.cleanup();
        resolve(null);
      }, 3000); // 3s timeout

      this.scoringWorker.onmessage = (event: MessageEvent) => {
        const { type, payload } = event.data;
        if (type === 'FINAL_STATE') {
          clearTimeout(timeout);
          const finalPayload = payload as FinalStatePayload;
          this.cleanup();
          resolve(finalPayload.overallScore);
        }
      };

      this.scoringWorker.postMessage({ type: 'GET_FINAL_STATE' });
    });
  }

  /**
   * Whether the analyzer is currently running.
   */
  get analyzing(): boolean {
    return this.isRunning;
  }

  /**
   * Clean up all resources.
   */
  private cleanup(): void {
    this.isRunning = false;

    // Disconnect audio graph
    if (this.micSource) {
      try { this.micSource.disconnect(); } catch { /* already disconnected */ }
      this.micSource = null;
    }

    if (this.workletNode) {
      try { this.workletNode.disconnect(); } catch { /* already disconnected */ }
      this.workletNode = null;
    }

    // Stop microphone tracks
    if (this.micStream) {
      for (const track of this.micStream.getTracks()) {
        track.stop();
      }
      this.micStream = null;
    }

    // Terminate scoring worker
    if (this.scoringWorker) {
      this.scoringWorker.terminate();
      this.scoringWorker = null;
    }

    this.vocalBuffer = null;
    this.keyInfo = null;
  }
}
