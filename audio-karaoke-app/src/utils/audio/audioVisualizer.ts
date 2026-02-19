/**
 * Audio Visualizer
 * Real-time waveform and frequency spectrum visualization
 */

import { getAudioContext } from './audioContext';

export class AudioVisualizer {
    private audioContext: AudioContext;
    private analyser: AnalyserNode;
    private dataArray: Uint8Array;
    private frequencyArray: Uint8Array;
    private animationId: number | null = null;
    private isRunning: boolean = false;

    private history: Uint8Array[] = [];
    private maxHistoryLength: number = 200;
    private autoQuality: boolean = true;
    private isQualityAdjusted: boolean = false;
    private performanceMetrics: { cpuUsage: number; latency: number; bufferUnderruns: number } | null = null;
    public onFrame?: (metrics: { bass: number; mid: number; treble: number; energy: number }) => void;

    // AudioWorklet for FFT
    private workletNode: AudioWorkletNode | null = null;
    private workletFrequencyData: Uint8Array | null = null;
    private currentSource: AudioNode | null = null;
    private useWorklet: boolean = false;

    constructor(fftSize: number = 2048) {
        this.audioContext = getAudioContext();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = fftSize;
        this.analyser.smoothingTimeConstant = 0.8;

        const bufferLength = this.analyser.frequencyBinCount;
        this.dataArray = new Uint8Array(bufferLength);
        this.frequencyArray = new Uint8Array(bufferLength);
        
        // Initialize Worklet
        this.setupWorklet();
    }

    private async setupWorklet(): Promise<void> {
        try {
            if (!this.audioContext) return;
            
            // Load the worklet module
            const workletUrl = new URL('./frequencyProcessor.worklet.ts', import.meta.url);
            await this.audioContext.audioWorklet.addModule(workletUrl);

            this.workletNode = new AudioWorkletNode(this.audioContext, 'frequency-processor', {
                numberOfInputs: 1,
                numberOfOutputs: 1,
                outputChannelCount: [1] // Mono output
            });

            this.workletNode.port.onmessage = (event) => {
                if (event.data.type === 'frequency_data') {
                    // event.data.data is the Uint8Array
                    // We can just store it directly or copy it
                    // Since it comes from a message, it's a copy or transfer
                    this.workletFrequencyData = event.data.data;
                }
            };

            // Connect to destination to keep the processing chain alive (even if we just pass through)
            // Or typically we don't need to connect output if we just want data, 
            // BUT Chrome sometimes garbage collects or stops processing unconnected nodes.
            // Connect to a Gain(0) to be safe? Or just handle in process()
            // The processor passes through audio, so we can chain it? 
            // Ideally visualizer is a "tap" and shouldn't affect the audio path.
            // So we connect source -> worklet -> gain(0) -> destination?
            // Existing implementation: setSource connects source -> analyser.
            // Analyser is a passive node (usually passes through).
            // We will do source -> worklet. Worklet won't connect to destination to avoid double audio.
            // We need to ensure logic runs. Chrome requires connection to destination for worklet to run?
            // Yes, usually.
            const silence = this.audioContext.createGain();
            silence.gain.value = 0;
            this.workletNode.connect(silence);
            silence.connect(this.audioContext.destination);

            this.useWorklet = true;

            // If we already have a source, connect it
            if (this.currentSource) {
                this.currentSource.connect(this.workletNode);
            }

        } catch (e) {
            console.error("Failed to load FrequencyProcessor worklet, falling back to AnalyserNode", e);
            this.useWorklet = false;
        }
    }

    /**
     * Set auto quality mode
     */
    setAutoQuality(enabled: boolean): void {
        this.autoQuality = enabled;
        if (!enabled) this.isQualityAdjusted = false;
    }

    /**
     * Set performance metrics from AudioWorklet
     */
    setPerformanceMetrics(metrics: { cpuUsage: number; latency: number; bufferUnderruns: number }): void {
        this.performanceMetrics = metrics;
        
        // Reactive quality adjustment
        if (this.autoQuality) {
            if (metrics.cpuUsage > 80 && !this.isQualityAdjusted) {
                this.isQualityAdjusted = true;
                this.maxHistoryLength = 100; // Reduce history memory
            } else if (metrics.cpuUsage < 50 && this.isQualityAdjusted) {
                this.isQualityAdjusted = false;
                this.maxHistoryLength = 200;
            }
        }
    }

    /**
     * Connect audio source to visualizer
     * @param source - AudioNode to visualize
     */
    setSource(source: AudioNode): void {
        this.currentSource = source;
        source.connect(this.analyser);
        if (this.workletNode) {
            source.connect(this.workletNode);
        }
    }

    /**
     * Start visualization
     */
    start(): void {
        this.isRunning = true;
    }

    /**
     * Stop visualization
     */
    stop(): void {
        this.isRunning = false;
        if (this.animationId !== null) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    /**
     * Draw waveform visualization
     * @param canvas - Canvas element to draw on
     */
    /**
     * Helper to get frequency data from Worklet or Analyser
     */
    private getFrequencyData(targetArray: Uint8Array): void {
        if (this.useWorklet && this.workletFrequencyData) {
            // Worklet data might be different size, but usually we match FFT size
            // If worklet buffer is larger, we take what fits.
            // If smaller, we fill what we have.
            const len = Math.min(targetArray.length, this.workletFrequencyData.length);
            targetArray.set(this.workletFrequencyData.subarray(0, len));
        } else {
            this.analyser.getByteFrequencyData(targetArray as unknown as Uint8Array<ArrayBuffer>);
        }
    }

    drawWaveform(canvas: HTMLCanvasElement): void {
        if (!this.isRunning) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const draw = () => {
            if (!this.isRunning) return;
            this.animationId = requestAnimationFrame(draw);

            // Get time domain data
            this.analyser.getByteTimeDomainData(this.dataArray as unknown as Uint8Array<ArrayBuffer>);

            // Process audio features (Ghost Mode)
            if (this.onFrame) {
                this.getFrequencyData(this.frequencyArray);
                this.processAudioFeatures(this.frequencyArray);
            }

            // Clear canvas
            ctx.fillStyle = 'rgba(20, 20, 20, 1)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw waveform
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#00ff96';
            ctx.beginPath();

            const sliceWidth = canvas.width / this.dataArray.length;
            let x = 0;

            for (let i = 0; i < this.dataArray.length; i++) {
                const v = this.dataArray[i] / 128.0;
                const y = (v * canvas.height) / 2;

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }

                x += sliceWidth;
            }

            ctx.lineTo(canvas.width, canvas.height / 2);
            ctx.stroke();
        };

        draw();
    }

    /**
     * Draw frequency spectrum visualization
     * @param canvas - Canvas element to draw on
     */
    drawSpectrum(canvas: HTMLCanvasElement): void {
        if (!this.isRunning) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const draw = () => {
            if (!this.isRunning) return;
            this.animationId = requestAnimationFrame(draw);

            // Get frequency data
            // Get frequency data
            this.getFrequencyData(this.dataArray);

            // Process audio features (Ghost Mode)
            if (this.onFrame) {
                this.processAudioFeatures(this.dataArray);
            }

            // Clear canvas
            ctx.fillStyle = 'rgba(20, 20, 20, 1)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const barWidth = (canvas.width / this.dataArray.length) * 2.5;
            let barHeight: number;
            let x = 0;

            for (let i = 0; i < this.dataArray.length; i++) {
                barHeight = (this.dataArray[i] / 255) * canvas.height;

                // Mixed gradients for premium look
                const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
                const hue = (i / this.dataArray.length) * 60 + 260; // Purple to Blue range
                gradient.addColorStop(0, `hsla(${hue}, 100%, 60%, 1)`);
                gradient.addColorStop(1, `hsla(${hue}, 100%, 40%, 0.5)`);

                ctx.fillStyle = gradient;
                ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

                x += barWidth + 1;
            }
        };

        draw();
    }

    /**
     * Set callback for frame audio metrics
     */
    setFrameCallback(callback: ((metrics: { bass: number; mid: number; treble: number; energy: number }) => void) | undefined): void {
        this.onFrame = callback;
    }

    /**
     * Process audio features and emit events
     */
    private processAudioFeatures(frequencyData: Uint8Array): void {
        if (!this.onFrame) return;

        const bufferLength = frequencyData.length;
        let bass = 0;
        let mid = 0;
        let treble = 0;
        let energy = 0;

        // Frequency bands (approximate)
        const bassEnd = Math.floor(bufferLength * 0.05); // Low frequency
        const midEnd = Math.floor(bufferLength * 0.4);   // Mids

        for (let i = 0; i < bufferLength; i++) {
            const val = frequencyData[i];
            energy += val;
            if (i < bassEnd) bass += val;
            else if (i < midEnd) mid += val;
            else treble += val;
        }

        this.onFrame({
            bass: (bass / bassEnd) / 255,
            mid: (mid / (midEnd - bassEnd)) / 255,
            treble: (treble / (bufferLength - midEnd)) / 255,
            energy: (energy / bufferLength) / 255
        });
    }

    /**
     * Draw scrolling 3D terrain landscape
     */
    draw3DLandscape(canvas: HTMLCanvasElement): void {
        if (!this.isRunning) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const draw = () => {
            if (!this.isRunning) return;
            this.animationId = requestAnimationFrame(draw);

            this.updateHistory();

            ctx.fillStyle = '#0a0a0a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const rows = this.history.length;
            // Downsample further if quality is adjusted
            const cols = this.dataArray.length / (this.isQualityAdjusted ? 8 : 4);
            const rowStep = canvas.height / (this.isQualityAdjusted ? 40 : 60);
            const colStep = canvas.width / cols;

            ctx.lineWidth = 1;

            for (let i = rows - 1; i >= 0; i--) {
                const data = this.history[i];
                const z = i * rowStep;
                const opacity = 1 - (i / rows);
                
                ctx.beginPath();
                ctx.strokeStyle = `hsla(${280 + i}, 100%, 50%, ${opacity * 0.5})`;
                
                for (let j = 0; j < cols; j++) {
                    const idx = this.isQualityAdjusted ? j << 3 : j << 2;
                    const val = data[idx];
                    const h = (val / 255) * 100 * (1 - i / rows);
                    const x = j * colStep;
                    const y = canvas.height - z - h - 50;

                    if (j === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.stroke();
            }

            this.drawMetricsOverlay(ctx, canvas);
        };

        draw();
    }

    /**
     * Draw scrolling frequency spectrogram
     */
    drawSpectrogram(canvas: HTMLCanvasElement): void {
        if (!this.isRunning) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const draw = () => {
            if (!this.isRunning) return;
            this.animationId = requestAnimationFrame(draw);

            this.updateHistory();

            const rows = this.history.length;
            const stepX = canvas.width / rows;
            const yIncr = this.isQualityAdjusted ? 8 : 4;

            for (let i = 0; i < rows; i++) {
                const data = this.history[i];
                const x = canvas.width - (i * stepX);
                
                for (let j = 0; j < canvas.height; j += yIncr) {
                    const freqIdx = Math.floor((j / canvas.height) * (data.length / 2));
                    const val = data[freqIdx];
                    ctx.fillStyle = `hsla(${240 - (val / 255) * 240}, 100%, 50%, 1)`;
                    ctx.fillRect(x, canvas.height - j, stepX, yIncr);
                }
            }

            this.drawMetricsOverlay(ctx, canvas);
        };

        draw();
    }

    /**
     * Draw particle fluid visualization
     * Uses frequency data to drive particle motion and color
     */
    drawFluid(canvas: HTMLCanvasElement): void {
        if (!this.isRunning) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Initialize particles if needed
        const particleCount = this.isQualityAdjusted ? 50 : 100;
        const particles: Array<{x: number, y: number, vx: number, vy: number, size: number, color: string}> = [];
        
        for(let i=0; i<particleCount; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: 0,
                vy: 0,
                size: Math.random() * 3 + 1,
                color: `hsla(${Math.random() * 60 + 200}, 100%, 50%, 0.5)`
            });
        }

        const draw = () => {
            if (!this.isRunning) return;
            this.animationId = requestAnimationFrame(draw);

            // Get frequency data
            // Get frequency data
            this.getFrequencyData(this.dataArray);
            
            // Process audio features (Ghost Mode)
            if (this.onFrame) {
                this.processAudioFeatures(this.dataArray);
            }

            // Fade out
            ctx.fillStyle = 'rgba(10, 10, 15, 0.2)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Calculate energy for speed
            let energy = 0;
            for(let i=0; i<this.dataArray.length; i++) {
                energy += this.dataArray[i];
            }
            energy = energy / this.dataArray.length;
            const speedMultiplier = 1 + (energy / 255) * 5;

            // Draw particles
            particles.forEach((p, i) => {
                // Map frequency bin to particle
                const freqIndex = Math.floor((i / particleCount) * (this.dataArray.length / 2)); // Use lower half of spectrum
                const freqValue = this.dataArray[freqIndex];
                
                // Update physics driven by audio
                const angle = (freqIndex / this.dataArray.length) * Math.PI * 4 + Date.now() * 0.001;
                const force = (freqValue / 255) * speedMultiplier;
                
                p.vx += Math.cos(angle) * force * 0.5;
                p.vy += Math.sin(angle) * force * 0.5;
                
                // Friction
                p.vx *= 0.95;
                p.vy *= 0.95;
                
                p.x += p.vx;
                p.y += p.vy;

                // Wrap around screen
                if(p.x < 0) p.x = canvas.width;
                if(p.x > canvas.width) p.x = 0;
                if(p.y < 0) p.y = canvas.height;
                if(p.y > canvas.height) p.y = 0;

                // Dynamic properties
                const size = p.size * (1 + (freqValue / 255));
                const hue = 200 + (freqValue / 255) * 100; // Blue to Purple/Pink

                ctx.beginPath();
                ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${hue}, 100%, 60%, ${0.5 + (freqValue/255)*0.5})`;
                ctx.fill();
                
                // Connect particles if close
                /* 
                // Optimization: Connect lines can be expensive. 
                // Enable only on high-end devices or if particle count is low.
                if (!this.isQualityAdjusted) {
                     // ... connection logic ...
                }
                */
            });

            this.drawMetricsOverlay(ctx, canvas);
        };
        draw();
    }

    private updateHistory(): void {
        this.getFrequencyData(this.dataArray);
        this.history.unshift(new Uint8Array(this.dataArray));
        if (this.history.length > this.maxHistoryLength) {
            this.history.pop();
        }
    }

    private drawMetricsOverlay(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
        if (!this.performanceMetrics) return;

        ctx.save();
        ctx.font = '10px Inter, sans-serif';
        
        const { cpuUsage, latency, bufferUnderruns } = this.performanceMetrics;
        let metricsText = `CPU: ${cpuUsage.toFixed(1)}% | LATENCY: ${latency.toFixed(1)}ms | ERR: ${bufferUnderruns}`;
        
        if (this.isQualityAdjusted) {
            metricsText += ' | QUALITY ADJUSTED';
        }

        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(10, 10, this.isQualityAdjusted ? 300 : 200, 20);
        ctx.fillStyle = this.isQualityAdjusted ? '#ffaa00' : (cpuUsage > 80 ? '#ff4444' : '#00ff96');
        ctx.fillText(metricsText, 20, 24);
        ctx.restore();
    }

    /**
     * Draw combined waveform and spectrum
     * @param waveformCanvas - Canvas for waveform
     * @param spectrumCanvas - Canvas for spectrum
     */
    drawCombined(waveformCanvas: HTMLCanvasElement, spectrumCanvas: HTMLCanvasElement): void {
        if (!this.isRunning) return;

        const waveCtx = waveformCanvas.getContext('2d');
        const specCtx = spectrumCanvas.getContext('2d');

        if (!waveCtx || !specCtx) return;

        const timeDataArray = new Uint8Array(this.analyser.frequencyBinCount);
        const freqDataArray = new Uint8Array(this.analyser.frequencyBinCount);

        const draw = () => {
            this.animationId = requestAnimationFrame(draw);

            // Get both time and frequency data
            this.analyser.getByteTimeDomainData(timeDataArray as unknown as Uint8Array<ArrayBuffer>);
            this.getFrequencyData(freqDataArray);

            // Draw waveform
            waveCtx.fillStyle = 'rgb(20, 20, 20)';
            waveCtx.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);
            waveCtx.lineWidth = 2;
            waveCtx.strokeStyle = 'rgb(0, 255, 150)';
            waveCtx.beginPath();

            const sliceWidth = waveformCanvas.width / timeDataArray.length;
            let x = 0;

            for (let i = 0; i < timeDataArray.length; i++) {
                const v = timeDataArray[i] / 128.0;
                const y = (v * waveformCanvas.height) / 2;

                if (i === 0) {
                    waveCtx.moveTo(x, y);
                } else {
                    waveCtx.lineTo(x, y);
                }

                x += sliceWidth;
            }

            waveCtx.lineTo(waveformCanvas.width, waveformCanvas.height / 2);
            waveCtx.stroke();

            // Draw spectrum
            specCtx.fillStyle = 'rgb(20, 20, 20)';
            specCtx.fillRect(0, 0, spectrumCanvas.width, spectrumCanvas.height);

            const barWidth = (spectrumCanvas.width / freqDataArray.length) * 2.5;
            let barHeight: number;
            x = 0;

            for (let i = 0; i < freqDataArray.length; i++) {
                barHeight = (freqDataArray[i] / 255) * spectrumCanvas.height;

                const gradient = specCtx.createLinearGradient(
                    0,
                    spectrumCanvas.height - barHeight,
                    0,
                    spectrumCanvas.height
                );

                const hue = (i / freqDataArray.length) * 120 + 200;
                gradient.addColorStop(0, `hsl(${hue}, 100%, 60%)`);
                gradient.addColorStop(1, `hsl(${hue}, 100%, 40%)`);

                specCtx.fillStyle = gradient;
                specCtx.fillRect(x, spectrumCanvas.height - barHeight, barWidth, barHeight);

                x += barWidth + 1;
            }
        };

        draw();
    }

    /**
    getFrequencyData_Public(): Uint8Array {
        this.getFrequencyData(this.dataArray);
        return this.dataArray;
    }

    /**
     * Get current time domain data
     */
    getTimeDomainData(): Uint8Array {
        this.analyser.getByteTimeDomainData(this.dataArray as unknown as Uint8Array<ArrayBuffer>);
        return this.dataArray;
    }

    /**
     * Set FFT size
     */
    setFFTSize(size: number): void {
        this.analyser.fftSize = size;
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    }

    /**
     * Set smoothing
     */
    setSmoothing(value: number): void {
        this.analyser.smoothingTimeConstant = Math.max(0, Math.min(1, value));
    }

    /**
     * Cleanup resources
     */
    dispose(): void {
        this.stop();
        this.analyser.disconnect();
        if (this.workletNode) {
            this.workletNode.disconnect();
            this.workletNode.port.close();
        }
    }
}
