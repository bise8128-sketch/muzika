/**
 * Audio Visualizer
 * Real-time waveform and frequency spectrum visualization
 * Uses OffscreenCanvas and Web Workers for high performance
 */

import { getAudioContext } from './audioContext';

export class AudioVisualizer {
    private audioContext: AudioContext;
    private analyser: AnalyserNode;
    private dataArray: Uint8Array;
    private frequencyArray: Uint8Array;
    
    // Worker and Worklet
    private visualizerWorker: Worker | null = null;
    private workletNode: AudioWorkletNode | null = null;
    private currentSource: AudioNode | null = null;

    private history: Uint8Array[] = [];
    private maxHistoryLength: number = 200;
    private autoQuality: boolean = true;
    private isQualityAdjusted: boolean = false;
    private performanceMetrics: { cpuUsage: number; latency: number; bufferUnderruns: number } | null = null;
    public onFrame?: (metrics: { bass: number; mid: number; treble: number; energy: number }) => void;

    constructor(fftSize: number = 2048) {
        this.audioContext = getAudioContext();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = fftSize;
        this.analyser.smoothingTimeConstant = 0.8;

        const bufferLength = this.analyser.frequencyBinCount;
        this.dataArray = new Uint8Array(bufferLength);
        this.frequencyArray = new Uint8Array(bufferLength);
        
        this.setupVisualizerWorker();
        this.setupWorklet();
    }

    private setupVisualizerWorker() {
        if (typeof Worker !== 'undefined') {
            this.visualizerWorker = new Worker(new URL('./visualizer.worker.ts', import.meta.url));
            
            this.visualizerWorker.onmessage = (event) => {
                if (event.data.type === 'audio_metrics') {
                    if (this.onFrame) {
                        this.onFrame(event.data.payload);
                    }
                }
            };
        }
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
                outputChannelCount: [1]
            });

            // Worklet now just acts as a pass-through, no main thread messages required.
            // visualizerWorker handles the FFT and posts audio_metrics directly.

            // Connect dummy output to keep it alive
            const silence = this.audioContext.createGain();
            silence.gain.value = 0;
            this.workletNode.connect(silence);
            silence.connect(this.audioContext.destination);

            if (this.currentSource) {
                this.currentSource.connect(this.workletNode);
            }
            
            this.connectWorkerAndWorklet();

        } catch (e) {
            console.error("Failed to load FrequencyProcessor worklet", e);
        }
    }

    private connectWorkerAndWorklet() {
        if (this.workletNode && this.visualizerWorker) {
            const channel = new MessageChannel();
            
            // Send one port to AudioWorklet
            this.workletNode.port.postMessage({
                type: 'connect_visualizer',
                port: channel.port1
            }, [channel.port1]);

            // Send other port to Visualizer Worker
            this.visualizerWorker.postMessage({
                type: 'connect_audio',
                payload: { port: channel.port2 }
            }, [channel.port2]);
        }
    }

    /**
     * Transfer canvas control to the worker
     */
    transferControlToOffscreen(canvas: HTMLCanvasElement): void {
        if (!this.visualizerWorker) return;

        try {
            const offscreen = canvas.transferControlToOffscreen();
            this.visualizerWorker.postMessage({
                type: 'init',
                payload: { canvas: offscreen }
            }, [offscreen]);
        } catch (e) {
            console.error("Failed to transfer control to offscreen canvas", e);
        }
    }

    /**
     * Start visualization
     */
    start(): void {
        this.visualizerWorker?.postMessage({ type: 'start', payload: {} });
    }

    /**
     * Stop visualization
     */
    stop(): void {
        this.visualizerWorker?.postMessage({ type: 'stop', payload: {} });
    }

    /**
     * Set visualization mode
     */
    setMode(mode: string): void {
        this.visualizerWorker?.postMessage({ 
            type: 'config', 
            payload: { mode } 
        });
    }

    /**
     * Configure visualizer
     */
    setConfig(config: Record<string, unknown>): void {
        this.visualizerWorker?.postMessage({
            type: 'config',
            payload: config
        });
    }

    /**
     * Update Resize
     */
    resize(width: number, height: number): void {
        this.visualizerWorker?.postMessage({
            type: 'resize',
            payload: { width, height }
        });
    }

    /**
     * Set Pitch History for SingStar mode
     */
    setPitchHistory(history: Record<string, unknown>[]): void {
        this.visualizerWorker?.postMessage({
            type: 'pitch_history',
            payload: history
        });
    }

    /**
     * Set auto quality mode
     */
    setAutoQuality(enabled: boolean): void {
        this.autoQuality = enabled;
        this.setConfig({ quality: enabled ? 'high' : 'high' }); // Logic can be refined
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
                this.setConfig({ quality: 'low' });
            } else if (metrics.cpuUsage < 50 && this.isQualityAdjusted) {
                this.isQualityAdjusted = false;
                this.setConfig({ quality: 'high' });
            }
        }
    }

    /**
     * Connect audio source to visualizer
     * @param source - AudioNode to visualize
     */
    setSource(source: AudioNode): void {
        this.currentSource = source;
        // Connect to Analyser (legacy path, maybe needed for other things)
        source.connect(this.analyser);
        
        // Connect to Worklet
        if (this.workletNode) {
            source.connect(this.workletNode);
        }
    }

    /**
     * Set callback for frame audio metrics
     */
    setFrameCallback(callback: ((metrics: { bass: number; mid: number; treble: number; energy: number }) => void) | undefined): void {
        this.onFrame = callback;
    }

    // Features processing moved to Web Worker

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
        if (this.visualizerWorker) {
            this.visualizerWorker.terminate();
        }
    }

    // Legacy methods placeholders if needed, but we should remove usages
    drawWaveform(_canvas: HTMLCanvasElement): void { console.warn("Deprecated: Use setMode('waveform')"); }
    drawSpectrum(_canvas: HTMLCanvasElement): void { console.warn("Deprecated: Use setMode('bars')"); }
    draw3DLandscape(_canvas: HTMLCanvasElement): void { console.warn("Deprecated: Use setMode('3d-landscape')"); }
    drawSpectrogram(_canvas: HTMLCanvasElement): void { console.warn("Deprecated: Use setMode('spectrogram')"); }
    drawFluid(_canvas: HTMLCanvasElement): void { console.warn("Deprecated: Use setMode('fluid')"); }
}
