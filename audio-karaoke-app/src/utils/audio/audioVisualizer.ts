/**
 * Audio Visualizer
 * Real-time waveform and frequency spectrum visualization
 */

import { getAudioContext } from './audioContext';

export class AudioVisualizer {
    private audioContext: AudioContext;
    private analyser: AnalyserNode;
    private dataArray: Uint8Array;
    private animationId: number | null = null;
    private isRunning: boolean = false;

    constructor(fftSize: number = 2048) {
        this.audioContext = getAudioContext();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = fftSize;
        this.analyser.smoothingTimeConstant = 0.8;

        const bufferLength = this.analyser.frequencyBinCount;
        this.dataArray = new Uint8Array(bufferLength);
    }

    /**
     * Connect audio source to visualizer
     * @param source - AudioNode to visualize
     */
    setSource(source: AudioNode): void {
        source.connect(this.analyser);
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
    drawWaveform(canvas: HTMLCanvasElement): void {
        if (!this.isRunning) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const draw = () => {
            this.animationId = requestAnimationFrame(draw);

            // Get time domain data
            this.analyser.getByteTimeDomainData(this.dataArray);

            // Clear canvas
            ctx.fillStyle = 'rgb(20, 20, 20)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw waveform
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgb(0, 255, 150)';
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
            this.animationId = requestAnimationFrame(draw);

            // Get frequency data
            this.analyser.getByteFrequencyData(this.dataArray);

            // Clear canvas
            ctx.fillStyle = 'rgb(20, 20, 20)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const barWidth = (canvas.width / this.dataArray.length) * 2.5;
            let barHeight: number;
            let x = 0;

            for (let i = 0; i < this.dataArray.length; i++) {
                barHeight = (this.dataArray[i] / 255) * canvas.height;

                // Create gradient based on frequency
                const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);

                // Low frequencies (blue/green) to high frequencies (yellow/red)
                const hue = (i / this.dataArray.length) * 120 + 200; // 200-320 range (blue to green to yellow)
                gradient.addColorStop(0, `hsl(${hue}, 100%, 60%)`);
                gradient.addColorStop(1, `hsl(${hue}, 100%, 40%)`);

                ctx.fillStyle = gradient;
                ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

                x += barWidth + 1;
            }
        };

        draw();
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
            this.analyser.getByteTimeDomainData(timeDataArray);
            this.analyser.getByteFrequencyData(freqDataArray);

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
     * Get current frequency data
     * Useful for external processing
     */
    getFrequencyData(): Uint8Array {
        this.analyser.getByteFrequencyData(this.dataArray);
        return this.dataArray;
    }

    /**
     * Get current time domain data
     */
    getTimeDomainData(): Uint8Array {
        this.analyser.getByteTimeDomainData(this.dataArray);
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
    }
}
