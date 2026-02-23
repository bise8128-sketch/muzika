/**
 * Pitch Correction AudioWorklet Processor
 * Real-time pitch detection and correction using autocorrelation
 */

class PitchCorrectionProcessor extends AudioWorkletProcessor {
    constructor() {
        super();

        // Configuration
        this.config = {
            enabled: false,
            scale: 'chromatic',
            referenceKey: 0,
            retuneSpeed: 0.5,
            correctionAmount: 0.8,
            sampleRate: 44100
        };

        // Scale definitions (semitone intervals from root)
        this.scales = {
            chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
            major: [0, 2, 4, 5, 7, 9, 11],
            minor: [0, 2, 3, 5, 7, 8, 10],
            'pentatonic-major': [0, 2, 4, 7, 9],
            'pentatonic-minor': [0, 3, 5, 7, 10]
        };

        // Performance metrics
        this.metrics = {
            processingTime: 0,
            latency: 0,
            correctionsApplied: 0,
            averageCorrectionAmount: 0,
            timestamp: 0
        };

        // Processing state
        this.totalCorrections = 0;
        this.totalCorrectionAmount = 0;
        this.lastProcessTime = 0;
        this.startTime = performance.now();

        // Buffer for pitch detection
        this.analysisBuffer = [];
        this.analysisBufferSize = 2048; // ~46ms at 44.1kHz

        // YIN buffer
        const maxPeriod = Math.floor(this.config.sampleRate / 80);
        this.yinBuffer = new Float32Array(maxPeriod + 1);

        // Set up message handling
        this.port.onmessage = (event) => {
            this.handleMessage(event.data);
        };
    }

    /**
     * Handle messages from main thread
     */
    handleMessage(message) {
        switch (message.type) {
            case 'config':
                this.updateConfig(message.data);
                break;
            default:
                console.warn('Unknown message type:', message.type);
        }
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Get scale intervals
     */
    getScaleIntervals() {
        return this.scales[this.config.scale] || this.scales.chromatic;
    }

    /**
     * Find nearest note in scale
     */
    findNearestScaleNote(midiNote) {
        const scaleIntervals = this.getScaleIntervals();
        const referenceKey = this.config.referenceKey;

        const octave = Math.floor(midiNote / 12);
        const noteInOctave = midiNote % 12;

        let nearestNote = noteInOctave;
        let minDistance = Infinity;

        for (const interval of scaleIntervals) {
            const scaleNote = (referenceKey + interval) % 12;
            const distance = Math.abs(noteInOctave - scaleNote);
            const wrappedDistance = Math.min(distance, 12 - distance);

            if (wrappedDistance < minDistance) {
                minDistance = wrappedDistance;
                nearestNote = scaleNote;
            }
        }

        return octave * 12 + nearestNote;
    }

    /**
     * Convert frequency to MIDI note
     */
    frequencyToMidi(frequency) {
        return 69 + 12 * Math.log2(frequency / 440);
    }

    /**
     * Convert MIDI note to frequency
     */
    midiToFrequency(midiNote) {
        return 440 * Math.pow(2, (midiNote - 69) / 12);
    }

    /**
     * Detect pitch using autocorrelation
     */
    detectPitch(buffer, sampleRate) {
        const bufferSize = buffer.length;
        const minPeriod = Math.floor(sampleRate / 1200);
        const maxPeriod = Math.floor(sampleRate / 80);

        if (!this.yinBuffer || this.yinBuffer.length < maxPeriod + 1) {
            this.yinBuffer = new Float32Array(maxPeriod + 1);
        }
        const yinBuffer = this.yinBuffer;

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

        const frequency = sampleRate / refinedLag;
        const midiNote = this.frequencyToMidi(frequency);
        const confidence = Math.max(0, 1.0 - yinBuffer[peakLag]);

        if (confidence < 0.3) {
            return null;
        }

        return { frequency, midiNote, confidence };
    }

    /**
     * Apply pitch correction to a buffer
     */
    applyPitchCorrection(buffer, sampleRate) {
        if (!this.config.enabled) {
            return buffer;
        }

        const correctedBuffer = new Float32Array(buffer.length);
        const pitchResult = this.detectPitch(buffer, sampleRate);

        if (!pitchResult) {
            // No clear pitch detected, return original
            return buffer;
        }

        const targetNote = this.findNearestScaleNote(pitchResult.midiNote);
        const targetFrequency = this.midiToFrequency(targetNote);

        // Calculate correction ratio
        const correctionRatio = targetFrequency / pitchResult.frequency;

        // Apply correction based on correction amount and retune speed
        // Retune speed controls how quickly the correction is applied (0.1 = slow, 1.0 = instant)
        const effectiveRatio = 1 + (correctionRatio - 1) * this.config.correctionAmount * this.config.retuneSpeed;

        // Apply time-domain pitch shifting using resampling
        const phase = 0;
        const phaseIncrement = effectiveRatio;

        for (let i = 0; i < buffer.length; i++) {
            const sourceIndex = Math.floor(i / effectiveRatio);
            if (sourceIndex < buffer.length) {
                correctedBuffer[i] = buffer[sourceIndex];
            } else {
                correctedBuffer[i] = 0;
            }
        }

        // Update metrics
        this.totalCorrections++;
        this.totalCorrectionAmount += Math.abs(effectiveRatio - 1);

        return correctedBuffer;
    }

    /**
     * Apply pitch correction using analysis buffer for pitch detection
     */
    applyPitchCorrectionWithAnalysisBuffer(buffer, sampleRate) {
        if (!this.config.enabled) {
            return buffer;
        }

        const correctedBuffer = new Float32Array(buffer.length);

        // Use analysis buffer for pitch detection if it has enough samples
        let pitchResult = null;
        if (this.analysisBuffer.length >= 1024) {
            const analysisArray = new Float32Array(this.analysisBuffer);
            pitchResult = this.detectPitch(analysisArray, sampleRate);
        }

        if (!pitchResult) {
            // No clear pitch detected, return original
            return buffer;
        }

        const targetNote = this.findNearestScaleNote(pitchResult.midiNote);
        const targetFrequency = this.midiToFrequency(targetNote);

        // Calculate correction ratio
        const correctionRatio = targetFrequency / pitchResult.frequency;

        // Apply correction based on correction amount and retune speed
        const effectiveRatio = 1 + (correctionRatio - 1) * this.config.correctionAmount * this.config.retuneSpeed;

        // Apply time-domain pitch shifting using resampling
        for (let i = 0; i < buffer.length; i++) {
            const sourceIndex = Math.floor(i / effectiveRatio);
            if (sourceIndex < buffer.length) {
                correctedBuffer[i] = buffer[sourceIndex];
            } else {
                correctedBuffer[i] = 0;
            }
        }

        // Update metrics
        this.totalCorrections++;
        this.totalCorrectionAmount += Math.abs(effectiveRatio - 1);

        return correctedBuffer;
    }

    /**
     * Process audio
     */
    process(inputs, outputs, parameters) {
        const startTime = performance.now();

        const input = inputs[0];
        const output = outputs[0];

        if (!input || !output || input.length === 0 || output.length === 0) {
            return true;
        }

        const numChannels = Math.min(input.length, output.length);
        const bufferSize = input[0].length;

        // Process each channel
        for (let channel = 0; channel < numChannels; channel++) {
            const inputData = input[channel];
            const outputData = output[channel];

            if (this.config.enabled) {
                // Add to analysis buffer
                for (let i = 0; i < bufferSize; i++) {
                    this.analysisBuffer.push(inputData[i]);
                }

                // Keep buffer at target size
                while (this.analysisBuffer.length > this.analysisBufferSize) {
                    this.analysisBuffer.shift();
                }

                // Apply pitch correction using analysis buffer for pitch detection
                const corrected = this.applyPitchCorrectionWithAnalysisBuffer(inputData, this.config.sampleRate);

                for (let i = 0; i < bufferSize; i++) {
                    outputData[i] = corrected[i];
                }
            } else {
                // Bypass mode
                for (let i = 0; i < bufferSize; i++) {
                    outputData[i] = inputData[i];
                }
            }
        }

        // Update metrics
        const endTime = performance.now();
        this.metrics.processingTime = endTime - startTime;
        this.metrics.latency = endTime - this.startTime;
        this.metrics.correctionsApplied = this.totalCorrections;
        this.metrics.averageCorrectionAmount = this.totalCorrections > 0
            ? this.totalCorrectionAmount / this.totalCorrections
            : 0;
        this.metrics.timestamp = endTime;

        // Report metrics periodically
        if (Math.random() < 0.01) { // ~1% chance per process call
            this.port.postMessage({
                type: 'metrics',
                data: { ...this.metrics }
            });
        }

        return true;
    }
}

// Register the processor
registerProcessor('pitch-correction-processor', PitchCorrectionProcessor);
