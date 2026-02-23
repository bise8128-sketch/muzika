/**
 * Pitch Correction - Real-time pitch correction with autocorrelation
 * Provides auto-tune functionality with scale-based correction
 */

import { PitchCorrectionSettings } from '../../types/audio';

export type ScaleType = 'chromatic' | 'major' | 'minor' | 'pentatonic-major' | 'pentatonic-minor';

export interface PitchDetectionResult {
    frequency: number;
    midiNote: number;
    confidence: number;
    timestamp: number;
}

export interface PitchCorrectionMetrics {
    processingTime: number;
    latency: number;
    correctionsApplied: number;
    averageCorrectionAmount: number;
    timestamp: number;
}

export class PitchCorrector {
    private audioContext: AudioContext;
    private workletNode: AudioWorkletNode | null = null;
    private settings: PitchCorrectionSettings;
    private isInitialized: boolean = false;
    private metricsCallback: ((metrics: PitchCorrectionMetrics) => void) | null = null;

    // Scale definitions (semitone intervals from root)
    private static readonly SCALES: Record<ScaleType, number[]> = {
        chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        major: [0, 2, 4, 5, 7, 9, 11],
        minor: [0, 2, 3, 5, 7, 8, 10],
        'pentatonic-major': [0, 2, 4, 7, 9],
        'pentatonic-minor': [0, 3, 5, 7, 10]
    };

    // Note names for MIDI notes
    private static readonly NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    constructor(audioContext: AudioContext, settings?: Partial<PitchCorrectionSettings>) {
        this.audioContext = audioContext;
        this.settings = {
            enabled: false,
            scale: 'chromatic',
            referenceKey: 0,
            retuneSpeed: 0.5,
            correctionAmount: 0.8,
            latency: 50,
            adaptiveMode: false,
            vocalAccuracy: 100,
            ...settings
        };
    }

    /**
     * Initialize the pitch corrector with AudioWorklet
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            // Load the worklet processor
            const workletUrl = '/audio/pitchCorrection.worklet.js';
            await this.audioContext.audioWorklet.addModule(workletUrl);

            // Create the worklet node
            this.workletNode = new AudioWorkletNode(this.audioContext, 'pitch-correction-processor', {
                numberOfInputs: 1,
                numberOfOutputs: 1,
                outputChannelCount: [2]
            });

            // Set up message handling
            this.workletNode.port.onmessage = (event: MessageEvent) => {
                this.handleWorkletMessage(event.data);
            };

            // Send initial configuration
            this.sendConfiguration();

            this.isInitialized = true;
        } catch (error) {
            console.error('Failed to initialize pitch correction worklet:', error);
            throw error;
        }
    }

    /**
     * Handle messages from the worklet processor
     */
    private handleWorkletMessage(message: { type: string; data?: unknown }): void {
        switch (message.type) {
            case 'metrics':
                if (this.metricsCallback && message.data) {
                    this.metricsCallback(message.data as PitchCorrectionMetrics);
                }
                break;
            case 'error':
                console.error('Pitch correction worklet error:', message.data);
                break;
            default:
                console.warn('Unknown message type from pitch correction worklet:', message.type);
        }
    }

    /**
     * Send configuration to the worklet processor
     */
    private sendConfiguration(): void {
        if (!this.isInitialized || !this.workletNode) {
            console.warn('PitchCorrector: Cannot send configuration - worklet not initialized');
            return;
        }

        this.workletNode.port.postMessage({
            type: 'config',
            data: {
                enabled: this.settings.enabled,
                scale: this.settings.scale,
                referenceKey: this.settings.referenceKey,
                retuneSpeed: this.settings.retuneSpeed,
                correctionAmount: this.settings.correctionAmount,
                adaptiveMode: this.settings.adaptiveMode,
                vocalAccuracy: this.settings.vocalAccuracy,
                sampleRate: this.audioContext.sampleRate
            }
        });
    }

    /**
     * Get input node for connecting audio sources
     */
    getInput(): AudioNode | null {
        if (!this.isInitialized || !this.workletNode) {
            console.warn('PitchCorrector: getInput() called before initialization');
            return null;
        }
        return this.workletNode;
    }

    /**
     * Get output node for connecting to destination
     */
    getOutput(): AudioNode | null {
        if (!this.isInitialized || !this.workletNode) {
            console.warn('PitchCorrector: getOutput() called before initialization');
            return null;
        }
        return this.workletNode;
    }

    /**
     * Update pitch correction settings
     */
    setSettings(settings: Partial<PitchCorrectionSettings>): void {
        this.settings = { ...this.settings, ...settings };
        this.sendConfiguration();
    }

    /**
     * Enable or disable pitch correction
     */
    setEnabled(enabled: boolean): void {
        this.settings.enabled = enabled;
        this.sendConfiguration();
    }

    /**
     * Enable or disable adaptive pitch correction
     */
    setAdaptiveMode(enabled: boolean): void {
        this.settings.adaptiveMode = enabled;
        this.sendConfiguration();
    }

    /**
     * Set the vocal accuracy for adaptive pitch correction
     */
    setVocalAccuracy(accuracy: number): void {
        this.settings.vocalAccuracy = Math.max(0, Math.min(100, accuracy));
        this.sendConfiguration();
    }

    /**
     * Set the scale for pitch correction
     */
    setScale(scale: ScaleType): void {
        this.settings.scale = scale;
        this.sendConfiguration();
    }

    /**
     * Set the reference key (0-11 for C to B)
     */
    setReferenceKey(referenceKey: number): void {
        this.settings.referenceKey = Math.max(0, Math.min(11, referenceKey));
        this.sendConfiguration();
    }

    /**
     * Set the retune speed (0.1 to 1.0)
     */
    setRetuneSpeed(retuneSpeed: number): void {
        this.settings.retuneSpeed = Math.max(0.1, Math.min(1.0, retuneSpeed));
        this.sendConfiguration();
    }

    /**
     * Set the correction amount (0 to 1)
     */
    setCorrectionAmount(correctionAmount: number): void {
        this.settings.correctionAmount = Math.max(0, Math.min(1, correctionAmount));
        this.sendConfiguration();
    }

    /**
     * Get current settings
     */
    getSettings(): PitchCorrectionSettings {
        return { ...this.settings };
    }

    /**
     * Get the scale intervals for the current scale type
     */
    getScaleIntervals(): number[] {
        return PitchCorrector.SCALES[this.settings.scale];
    }

    /**
     * Get the note name for a MIDI note number
     */
    static getNoteName(midiNote: number): string {
        const octave = Math.floor(midiNote / 12) - 1;
        const noteIndex = midiNote % 12;
        return `${PitchCorrector.NOTE_NAMES[noteIndex]}${octave}`;
    }

    /**
     * Find the nearest note in the current scale
     */
    findNearestScaleNote(midiNote: number): number {
        const scaleIntervals = this.getScaleIntervals();
        const referenceKey = this.settings.referenceKey;

        // Calculate the octave and note within octave
        const octave = Math.floor(midiNote / 12);
        const noteInOctave = midiNote % 12;

        // Find the nearest scale note
        let nearestNote = noteInOctave;
        let minDistance = Infinity;

        for (const interval of scaleIntervals) {
            const scaleNote = (referenceKey + interval) % 12;
            const distance = Math.abs(noteInOctave - scaleNote);

            // Consider wrap-around (e.g., C is close to B)
            const wrappedDistance = Math.min(distance, 12 - distance);

            if (wrappedDistance < minDistance) {
                minDistance = wrappedDistance;
                nearestNote = scaleNote;
            }
        }

        // Return the full MIDI note number
        return octave * 12 + nearestNote;
    }

    /**
     * Calculate the frequency from a MIDI note number
     */
    static midiToFrequency(midiNote: number): number {
        return 440 * Math.pow(2, (midiNote - 69) / 12);
    }

    /**
     * Calculate the MIDI note number from a frequency
     */
    static frequencyToMidi(frequency: number): number {
        return 69 + 12 * Math.log2(frequency / 440);
    }

    /**
     * Perform autocorrelation pitch detection on a buffer.
     * @param buffer Input audio buffer
     * @param sampleRate Audio sample rate
     * @param internalBuffer Optional pre-allocated buffer for internal calculations to avoid allocations
     */
    static detectPitch(
        buffer: Float32Array, 
        sampleRate: number, 
        internalBuffer?: Float32Array
    ): PitchDetectionResult | null {
        const bufferSize = buffer.length;
        const minPeriod = Math.floor(sampleRate / 1200); // Max frequency ~1200 Hz
        const maxPeriod = Math.floor(sampleRate / 80);   // Min frequency ~80 Hz

        // Use provided buffer or allocate if not provided (though for Worklet we should always provide)
        const yinBuffer = internalBuffer || new Float32Array(maxPeriod + 1);
        
        // Check for silence to prevent YIN algorithm from getting zero-difference everywhere
        let energy = 0;
        for (let i = 0; i < bufferSize; i++) {
            energy += buffer[i] * buffer[i];
        }
        if (energy < 1e-10) {
            return null;
        }

        // 1. Difference function
        for (let lag = 1; lag <= maxPeriod; lag++) {
            let sum = 0;
            for (let i = 0; i < bufferSize - lag; i++) {
                const delta = buffer[i] - buffer[i + lag];
                sum += delta * delta;
            }
            yinBuffer[lag] = sum;
        }

        // 2. Cumulative mean normalized difference
        yinBuffer[0] = 1;
        let runningSum = 0;
        for (let lag = 1; lag <= maxPeriod; lag++) {
            runningSum += yinBuffer[lag];
            yinBuffer[lag] = yinBuffer[lag] * lag / (runningSum || 1);
        }

        // 3. Absolute thresholding
        const threshold = 0.15;
        let peakLag = -1;
        for (let lag = minPeriod; lag <= maxPeriod; lag++) {
            if (yinBuffer[lag] < threshold) {
                // Find local minimum
                let r = lag;
                while (r + 1 <= maxPeriod && yinBuffer[r + 1] < yinBuffer[r]) {
                    r++;
                }
                peakLag = r;
                break;
            }
        }

        // If no pitch below threshold
        if (peakLag === -1) {
            return null;
        }

        // 4. Parabolic interpolation
        let refinedLag = peakLag;
        if (peakLag > 1 && peakLag < maxPeriod) {
            const s0 = yinBuffer[peakLag - 1];
            const s1 = yinBuffer[peakLag];
            const s2 = yinBuffer[peakLag + 1];
            const denominator = 2 * (s0 - 2 * s1 + s2);
            if (denominator !== 0) {
                refinedLag += (s0 - s2) / denominator;
            }
        }

        // Calculate confidence
        const confidence = Math.max(0, 1.0 - yinBuffer[peakLag]);

        // If confidence is too low, return null
        if (confidence < 0.3) {
            return null;
        }

        // Calculate frequency
        const frequency = sampleRate / refinedLag;
        const midiNote = PitchCorrector.frequencyToMidi(frequency);

        return {
            frequency,
            midiNote,
            confidence,
            timestamp: performance.now()
        };
    }

    /**
     * Set callback for performance metrics updates
     */
    onMetricsUpdate(callback: (metrics: PitchCorrectionMetrics) => void): void {
        this.metricsCallback = callback;
    }

    /**
     * Check if the processor is initialized
     */
    isReady(): boolean {
        return this.isInitialized;
    }

    /**
     * Clean up resources
     */
    destroy(): void {
        if (this.workletNode) {
            this.workletNode.port.close();
            this.workletNode.disconnect();
            this.workletNode = null;
        }
        this.isInitialized = false;
        this.metricsCallback = null;
    }
}
