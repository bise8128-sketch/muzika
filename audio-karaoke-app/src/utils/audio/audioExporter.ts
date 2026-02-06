/**
 * Audio Export Utilities
 * WAV and MP3 encoding for browser-based audio export
 */

import { applyPitchAndTempo } from './pitchTempo';

// Error types for better error handling
export enum MP3ExportErrorType {
    WORKER_INIT_FAILED = 'WORKER_INIT_FAILED',
    FFMPEG_LOAD_FAILED = 'FFMPEG_LOAD_FAILED',
    FFMPEG_CORE_LOAD_FAILED = 'FFMPEG_CORE_LOAD_FAILED',
    ENCODING_FAILED = 'ENCODING_FAILED',
    FILE_TOO_LARGE = 'FILE_TOO_LARGE',
    BROWSER_NOT_SUPPORTED = 'BROWSER_NOT_SUPPORTED',
    UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export class MP3ExportError extends Error {
    constructor(
        public type: MP3ExportErrorType,
        message: string,
        public details?: string
    ) {
        super(message);
        this.name = 'MP3ExportError';
    }
}

// Worker pool for better resource management
class WorkerPool {
    private workers: Worker[] = [];
    private availableWorkers: Worker[] = [];
    private maxWorkers: number;
    private workerUrl: string;

    constructor(maxWorkers: number = 2) {
        this.maxWorkers = Math.min(maxWorkers, navigator.hardwareConcurrency || 2);
        // Use blob URL for worker to avoid file path issues
        this.workerUrl = this.createWorkerBlobUrl();
    }

    private getWorkerUrl(): string {
        try {
            // Try to use the bundled worker URL
            return new URL('./mp3.worker.ts', import.meta.url).href;
        } catch (e) {
            // Fallback to a direct path
            console.warn('[WorkerPool] Failed to resolve worker URL, using fallback:', e);
            return '/utils/audio/mp3.worker.js';
        }
    }

    private createWorkerBlobUrl(): string {
        // Worker code as a string
        const workerCode = `
            /**
             * MP3 Export Worker
             * Handles FFmpeg encoding in a worker to avoid main thread module resolution issues
             */

            // Define UMD global types for FFmpeg
            interface FFmpegLib {
                FFmpeg: new () => FFmpegInstance;
            }

            interface FFmpegInstance {
                load(options: { coreURL: string; wasmURL: string }): Promise<void>;
                writeFile(path: string, data: Uint8Array): Promise<void>;
                readFile(path: string): Promise<Uint8Array>;
                deleteFile(path: string): Promise<void>;
                exec(args: string[]): Promise<void>;
            }

            declare const FFmpeg: FFmpegLib;

            // Worker error types
            enum WorkerErrorType {
                INIT_FAILED = 'INIT_FAILED',
                FFMPEG_LOAD_FAILED = 'FFMPEG_LOAD_FAILED',
                FFMPEG_CORE_LOAD_FAILED = 'FFMPEG_CORE_LOAD_FAILED',
                ENCODING_FAILED = 'ENCODING_FAILED',
                UNKNOWN_ERROR = 'UNKNOWN_ERROR'
            }

            // Initialize variables
            let ffmpeg: FFmpegInstance | null = null;
            let isInitialized = false;

            /**
             * Logging utility with levels
             */
            function log(message: string, level: 'info' | 'warn' | 'error' = 'info') {
                const prefix = '[MP3 Worker]';
                switch (level) {
                    case 'error':
                        console.error(prefix, message);
                        break;
                    case 'warn':
                        console.warn(prefix, message);
                        break;
                    default:
                        console.log(prefix, message);
                }
            }

            /**
             * Verify if a file exists at the given URL
             */
            async function verifyFileExists(url: string): Promise<boolean> {
                try {
                    const response = await fetch(url, { method: 'HEAD' });
                    return response.ok;
                } catch (e) {
                    log(\`Failed to verify file existence for \${url}\`, 'warn');
                    return false;
                }
            }

            /**
             * Initialize FFmpeg with retry logic
             */
            async function initializeFFmpeg(baseUrl: string, maxRetries: number = 2): Promise<void> {
                let lastError: Error | null = null;

                for (let attempt = 0; attempt <= maxRetries; attempt++) {
                    try {
                        log(\`Initializing FFmpeg (attempt \${attempt + 1}/\${maxRetries + 1})...\`);

                        // Verify files exist before loading
                        const coreJsUrl = \`\${baseUrl}/ffmpeg.js\`;
                        const coreWasmUrl = \`\${baseUrl}/ffmpeg-core.js\`;
                        const wasmUrl = \`\${baseUrl}/ffmpeg-core.wasm\`;

                        const jsExists = await verifyFileExists(coreJsUrl);
                        const coreExists = await verifyFileExists(coreWasmUrl);
                        const wasmExists = await verifyFileExists(wasmUrl);

                        if (!jsExists) {
                            throw new Error(\`FFmpeg JS file not found at \${coreJsUrl}\`);
                        }
                        if (!coreExists) {
                            throw new Error(\`FFmpeg core JS file not found at \${coreWasmUrl}\`);
                        }
                        if (!wasmExists) {
                            throw new Error(\`FFmpeg WASM file not found at \${wasmUrl}\`);
                        }

                        // Shim document for ffmpeg.js UMD build which expects it
                        const docShim = {
                            baseURI: self.location?.href || '',
                            currentScript: null,
                            getElementsByTagName: () => [],
                            createElement: () => ({}),
                            head: {},
                            body: {}
                        };

                        // Aggressively shim document in all possible global scopes
                        if (typeof (self as unknown as { document?: unknown }).document === 'undefined') {
                            log('Shimming self.document');
                            (self as unknown as { document: unknown }).document = docShim;
                        }

                        if (typeof (globalThis as unknown as { document?: unknown }).document === 'undefined') {
                            log('Shimming globalThis.document');
                            (globalThis as unknown as { document: unknown }).document = docShim;
                        }

                        // Verify shim
                        try {
                            log(\`Document baseURI: \${(document as unknown as { baseURI?: string }).baseURI}\`);
                        } catch (e) {
                            log('Document check failed (this is expected in some environments)', 'warn');
                        }

            // Import UMD scripts (bypass Webpack)
            // FIX: Use fetch + new Function instead of importScripts for blob URL workers
            try {
                const response = await fetch(coreJsUrl);
                if (!response.ok) {
                    throw new Error('Failed to fetch FFmpeg JS: ' + response.status + ' ' + response.statusText);
                }
                const scriptContent = await response.text();
                // Use new Function to execute the script in the global scope
                // This is needed because eval executes in the current scope, not global
                const loadScript = new Function(scriptContent);
                loadScript();
            } catch (fetchError) {
                const errorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
                throw new Error('Failed to load FFmpeg from ' + coreJsUrl + ': ' + errorMsg);
            }

                        // Initialize FFmpeg (handle different export names)
                        // @ts-expect-error - FFmpegWASM is added to global scope by the UMD build
                        const FFmpegLib = (self as unknown as { FFmpeg?: any; FFmpegWASM?: any }).FFmpeg ||
                            (self as unknown as { FFmpeg?: any; FFmpegWASM?: any }).FFmpegWASM;
                        if (!FFmpegLib) throw new Error('FFmpeg library not found in global scope');

                        // Create FFmpeg instance
                        // @ts-expect-error - FFmpeg constructor
                        ffmpeg = new FFmpegLib();

                        log('FFmpeg initialized, loading core...');

                        if (!ffmpeg) throw new Error('Failed to create FFmpeg instance');

                        // Load FFmpeg with the correct API for version 0.12.x
                        // The new API uses coreURL and wasmURL directly
                        await ffmpeg.load({
                            coreURL: coreWasmUrl,
                            wasmURL: wasmUrl,
                        });

                        isInitialized = true;
                        log('FFmpeg core loaded successfully');

                        return;
                    } catch (error: unknown) {
                        lastError = error instanceof Error ? error : new Error(String(error));
                        log(\`Initialization attempt \${attempt + 1} failed: \${lastError.message}\`, 'error');

                        // Clean up failed state
                        ffmpeg = null;
                        isInitialized = false;

                        // Don't retry on certain errors
                        const errorMessage = lastError.message;
                        if (errorMessage.includes('not found') || errorMessage.includes('404')) {
                            log('File not found error, aborting retries', 'error');
                            break;
                        }

                        // Wait before retry
                        if (attempt < maxRetries) {
                            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                        }
                    }
                }

                // All retries failed
                throw lastError || new Error('Failed to initialize FFmpeg after multiple attempts');
            }

            self.onmessage = async (e) => {
                const { type, payload } = e.data;

                if (type === 'INIT') {
                    try {
                        const { baseUrl } = payload;

                        if (isInitialized && ffmpeg) {
                            log('FFmpeg already initialized, skipping...');
                            self.postMessage({ type: 'INIT_SUCCESS' });
                            return;
                        }

                        await initializeFFmpeg(baseUrl);

                        self.postMessage({ type: 'INIT_SUCCESS' });
                    } catch (error: unknown) {
                        const err = error instanceof Error ? error : new Error(String(error));
                        log(\`INIT failed: \${err.message}\`, 'error');
                        self.postMessage({
                            type: 'ERROR',
                            payload: JSON.stringify({
                                type: WorkerErrorType.INIT_FAILED,
                                message: err.message,
                                details: err.stack || 'No stack trace available'
                            })
                        });
                    }
                }

                if (type === 'EXPORT') {
                    try {
                        if (!ffmpeg || !isInitialized) {
                            throw new Error('FFmpeg not initialized. Please call INIT first.');
                        }

                        const { wavData, bitrate = 320 } = payload;

                        if (!wavData || wavData.byteLength === 0) {
                            throw new Error('WAV data is empty or null');
                        }

                        const inputName = 'input.wav';
                        const outputName = 'output.mp3';

                        log(\`Writing input file (\${(wavData.byteLength / 1024 / 1024).toFixed(2)} MB)...\`);
                        await ffmpeg.writeFile(inputName, new Uint8Array(wavData));

                        log('Encoding to MP3...');
                        await ffmpeg.exec([
                            '-i', inputName,
                            '-b:a', \`\${bitrate}k\`,
                            '-y', // Overwrite output file if exists
                            outputName
                        ]);

                        log('Reading output...');
                        const data = await ffmpeg.readFile(outputName);

                        // Cleanup
                        await ffmpeg.deleteFile(inputName);
                        await ffmpeg.deleteFile(outputName);

                        log(\`Export successful (\${(data.byteLength / 1024 / 1024).toFixed(2)} MB)\`);

                        self.postMessage({
                            type: 'EXPORT_SUCCESS',
                            payload: data.buffer
                        }, {
                            transfer: [data.buffer]
                        } as { transfer: Transferable[] });
                    } catch (error: unknown) {
                        const err = error instanceof Error ? error : new Error(String(error));
                        log(\`EXPORT failed: \${err.message}\`, 'error');
                        self.postMessage({
                            type: 'ERROR',
                            payload: JSON.stringify({
                                type: WorkerErrorType.ENCODING_FAILED,
                                message: err.message,
                                details: err.stack || 'No stack trace available'
                            })
                        });
                    }
                }
            };
        `;

        // Create a blob URL from the worker code
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        return URL.createObjectURL(blob);
    }

    async acquire(): Promise<Worker> {
        // Return available worker if exists
        if (this.availableWorkers.length > 0) {
            return this.availableWorkers.pop()!;
        }

        // Create new worker if under limit
        if (this.workers.length < this.maxWorkers) {
            const worker = new Worker(this.workerUrl);
            this.workers.push(worker);
            return worker;
        }

        // Wait for a worker to become available
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (this.availableWorkers.length > 0) {
                    clearInterval(checkInterval);
                    resolve(this.availableWorkers.pop()!);
                }
            }, 50);
        });
    }

    release(worker: Worker): void {
        if (this.availableWorkers.length < this.maxWorkers) {
            this.availableWorkers.push(worker);
        } else {
            worker.terminate();
            const index = this.workers.indexOf(worker);
            if (index > -1) {
                this.workers.splice(index, 1);
            }
        }
    }

    terminateAll(): void {
        [...this.workers, ...this.availableWorkers].forEach(worker => worker.terminate());
        this.workers = [];
        this.availableWorkers = [];
    }
}

// Global worker pool instance
let workerPool: WorkerPool | null = null;

function getWorkerPool(): WorkerPool {
    if (!workerPool) {
        workerPool = new WorkerPool(2);
    }
    return workerPool;
}

/**
 * Cleanup worker pool when app unmounts
 * Call this function in component cleanup effects
 */
export function cleanupWorkerPool(): void {
    if (workerPool) {
        workerPool.terminateAll();
        workerPool = null;
    }
}

// File size limits (in bytes)
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const WARNING_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Check if browser supports required features
 */
export function checkBrowserSupport(): { supported: boolean; reason?: string } {
    if (typeof window === 'undefined') {
        return { supported: false, reason: 'Not running in browser environment' };
    }

    if (!window.Worker) {
        return { supported: false, reason: 'Web Workers not supported' };
    }

    if (!window.AudioContext && !(window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) {
        return { supported: false, reason: 'Web Audio API not supported' };
    }

    // Check for SharedArrayBuffer support (required for FFmpeg.wasm)
    if (typeof SharedArrayBuffer === 'undefined') {
        return { supported: false, reason: 'SharedArrayBuffer not supported. This may be due to missing COOP/COEP headers.' };
    }

    return { supported: true };
}

/**
 * Validate audio buffer size
 */
export function validateAudioBuffer(audioBuffer: AudioBuffer): { valid: boolean; warning?: string } {
    // Estimate file size (16-bit PCM, stereo)
    const estimatedSize = audioBuffer.length * audioBuffer.numberOfChannels * 2;

    if (estimatedSize > MAX_FILE_SIZE) {
        return {
            valid: false,
            warning: `Audio file too large (${(estimatedSize / 1024 / 1024).toFixed(1)}MB). Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`
        };
    }

    if (estimatedSize > WARNING_FILE_SIZE) {
        return {
            valid: true,
            warning: `Large audio file detected (${(estimatedSize / 1024 / 1024).toFixed(1)}MB). Conversion may take some time.`
        };
    }

    return { valid: true };
}



/**
 * Export AudioBuffer to WAV format
 * @param audioBuffer - AudioBuffer to export
 * @returns Blob containing WAV file data
 */
export async function exportToWAV(audioBuffer: AudioBuffer): Promise<Blob> {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;
    const bytesPerSample = 2; // 16-bit PCM

    // Calculate buffer sizes
    const dataSize = length * numberOfChannels * bytesPerSample;
    const bufferSize = 44 + dataSize; // 44 byte header + data

    const buffer = new ArrayBuffer(bufferSize);
    const view = new DataView(buffer);

    // Write WAV header
    writeWAVHeader(view, numberOfChannels, sampleRate, dataSize);

    // Write PCM data
    let offset = 44;
    for (let i = 0; i < length; i++) {
        for (let channel = 0; channel < numberOfChannels; channel++) {
            const sample = audioBuffer.getChannelData(channel)[i];
            // Convert Float32 (-1 to 1) to Int16 (-32768 to 32767)
            const int16Sample = Math.max(-1, Math.min(1, sample)) * 0x7FFF;
            view.setInt16(offset, int16Sample, true); // little-endian
            offset += 2;
        }
    }

    return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Write WAV header to DataView
 */
function writeWAVHeader(
    view: DataView,
    numberOfChannels: number,
    sampleRate: number,
    dataSize: number
): void {
    const bytesPerSample = 2; // 16-bit
    const blockAlign = numberOfChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;

    // RIFF identifier
    writeString(view, 0, 'RIFF');
    // File size (minus 8 bytes for RIFF header)
    view.setUint32(4, 36 + dataSize, true);
    // RIFF type
    writeString(view, 8, 'WAVE');

    // fmt chunk
    writeString(view, 12, 'fmt ');
    // fmt chunk size
    view.setUint32(16, 16, true);
    // Audio format (1 = PCM)
    view.setUint16(20, 1, true);
    // Number of channels
    view.setUint16(22, numberOfChannels, true);
    // Sample rate
    view.setUint32(24, sampleRate, true);
    // Byte rate
    view.setUint32(28, byteRate, true);
    // Block align
    view.setUint16(32, blockAlign, true);
    // Bits per sample
    view.setUint16(34, 16, true);

    // data chunk
    writeString(view, 36, 'data');
    // data chunk size
    view.setUint32(40, dataSize, true);
}

/**
 * Write string to DataView
 */
function writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

/**
 * Export AudioBuffer to MP3 format using FFmpeg.wasm
 * @param audioBuffer - AudioBuffer to export
 * @param bitrate - MP3 bitrate in kbps (default: 320)
 * @returns Blob containing MP3 file data
 */
export async function exportToMP3(
    audioBuffer: AudioBuffer,
    bitrate: number = 320
): Promise<Blob> {
    // Check browser support first
    const supportCheck = checkBrowserSupport();
    if (!supportCheck.supported) {
        throw new MP3ExportError(
            MP3ExportErrorType.BROWSER_NOT_SUPPORTED,
            'Browser not supported',
            supportCheck.reason
        );
    }

    // Validate audio buffer size
    const validation = validateAudioBuffer(audioBuffer);
    if (!validation.valid) {
        throw new MP3ExportError(
            MP3ExportErrorType.FILE_TOO_LARGE,
            'File too large',
            validation.warning
        );
    }

    // Log warning if file is large
    if (validation.warning) {
        console.warn('[exportToMP3]', validation.warning);
    }

    // First convert to WAV (we need raw bytes to send to worker)
    const wavBlob = await exportToWAV(audioBuffer);
    const wavArrayBuffer = await wavBlob.arrayBuffer();

    const pool = getWorkerPool();
    const worker = await pool.acquire();

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            pool.release(worker);
            reject(new MP3ExportError(
                MP3ExportErrorType.ENCODING_FAILED,
                'Export timeout',
                'MP3 export took too long to complete'
            ));
        }, 300000); // 5 minute timeout

        worker.onmessage = (e) => {
            const { type, payload } = e.data;

            if (type === 'INIT_SUCCESS') {
                // Worker ready, send data
                worker.postMessage({
                    type: 'EXPORT',
                    payload: {
                        wavData: wavArrayBuffer,
                        bitrate
                    }
                }, [wavArrayBuffer] as Transferable[]);
            } else if (type === 'EXPORT_SUCCESS') {
                clearTimeout(timeout);
                pool.release(worker);
                resolve(new Blob([payload], { type: 'audio/mpeg' }));
            } else if (type === 'ERROR') {
                clearTimeout(timeout);
                pool.release(worker);
                console.error('[WorkerPool] Worker reported error:', payload);

                // Parse error payload if it's a JSON string
                let errorMessage = payload;
                try {
                    const errorData = JSON.parse(payload);
                    errorMessage = errorData.message || errorData.details || payload;
                } catch {
                    // If parsing fails, use the raw payload
                    errorMessage = payload;
                }

                reject(new MP3ExportError(
                    MP3ExportErrorType.ENCODING_FAILED,
                    'Encoding failed',
                    errorMessage
                ));
            }
        };

        worker.onerror = (err) => {
            clearTimeout(timeout);
            pool.release(worker);

            // ErrorEvent has specific properties: message, filename, lineno, colno, error
            const errorMessage = err.message || 'Unknown worker error';
            const errorFilename = err.filename || 'Unknown file';
            const errorLine = err.lineno || 'Unknown line';
            const errorCol = err.colno || 'Unknown column';
            const errorObj = err.error || null;

            console.error('[WorkerPool] Worker error:', {
                message: errorMessage,
                filename: errorFilename,
                line: errorLine,
                column: errorCol,
                error: errorObj
            });

            reject(new MP3ExportError(
                MP3ExportErrorType.WORKER_INIT_FAILED,
                'Worker initialization failed',
                `Failed to initialize worker: ${errorMessage} at ${errorFilename}:${errorLine}:${errorCol}. This may be due to browser compatibility or missing files. Please check browser console for more details.`
            ));
        };

        // Initialize worker with base URL for scripts (computed in main thread, not worker)
        // FIX: Determine baseUrl in main thread context where window is available
        const baseUrl = typeof window !== 'undefined'
            ? `${window.location.origin}/ffmpeg/umd`
            : '/ffmpeg/umd'; // Fallback for SSR

        worker.postMessage({
            type: 'INIT',
            payload: { baseUrl }
        });
    });
}

/**
 * Download a Blob as a file
 * @param blob - Blob to download
 * @param filename - Filename for download
 */
export function downloadBlob(blob: Blob, filename: string): void {
    // FIX: Add client-side check to prevent SSR issues
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        console.warn('downloadBlob called in non-browser environment');
        return;
    }

    try {
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.style.display = 'none';

        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);

        // Cleanup object URL after a short delay
        setTimeout(() => {
            window.URL.revokeObjectURL(url);
        }, 100);
    } catch (error) {
        console.error('[downloadBlob] Failed to download file:', error);
        throw new Error('Failed to download file. Please try again.');
    }
}

/**
 * Export audio with format selection
 */
export async function exportAudio(
    audioBuffer: AudioBuffer,
    format: 'wav' | 'mp3',
    filename: string,
    bitrate?: number
): Promise<void> {
    let blob: Blob;

    try {
        if (format === 'mp3') {
            blob = await exportToMP3(audioBuffer, bitrate);
        } else {
            blob = await exportToWAV(audioBuffer);
        }

        downloadBlob(blob, filename);
    } catch (error) {
        // Re-throw MP3ExportError as-is for better error handling
        if (error instanceof MP3ExportError) {
            throw error;
        }
        // Wrap other errors
        throw new Error(`Failed to export audio: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Get user-friendly error message from MP3ExportError
 */
export function getErrorMessage(error: MP3ExportError): string {
    switch (error.type) {
        case MP3ExportErrorType.BROWSER_NOT_SUPPORTED:
            return `Your browser doesn't support MP3 export. ${error.details || 'Please try a different browser.'}`;
        case MP3ExportErrorType.FILE_TOO_LARGE:
            return `File too large. ${error.details || 'Please try a shorter audio clip.'}`;
        case MP3ExportErrorType.FFMPEG_LOAD_FAILED:
            return `Failed to load MP3 encoder. ${error.details || 'Please refresh the page and try again.'}`;
        case MP3ExportErrorType.FFMPEG_CORE_LOAD_FAILED:
            return `Failed to load MP3 encoder core. ${error.details || 'Please refresh the page and try again.'}`;
        case MP3ExportErrorType.ENCODING_FAILED:
            return `Failed to encode MP3. ${error.details || 'Please try again or use WAV format instead.'}`;
        case MP3ExportErrorType.WORKER_INIT_FAILED:
            return `Failed to initialize export worker. ${error.details || 'Please refresh the page and try again.'}`;
        case MP3ExportErrorType.UNKNOWN_ERROR:
        default:
            return `An unexpected error occurred. ${error.details || 'Please try again.'}`;
    }
}

/**
 * Render multiple audio buffers into a single buffer with effects applied
 */
export async function renderProcessedAudio(
    buffers: AudioBuffer[],
    volumes: number[],
    effects: {
        pitch: number,
        tempo: number,
        bass: number,
        mid: number,
        treble: number
    }
): Promise<AudioBuffer> {
    // 1. Combine buffers with volumes
    const sampleRate = buffers[0]?.sampleRate || 44100;
    const duration = buffers[0]?.duration || 0;
    const channels = 2; // Always stereo for export

    const offlineCtx = new OfflineAudioContext(channels, duration * sampleRate, sampleRate);

    buffers.forEach((buffer, idx) => {
        const source = offlineCtx.createBufferSource();
        source.buffer = buffer;

        const gain = offlineCtx.createGain();
        gain.gain.value = volumes[idx] ?? 1.0;

        source.connect(gain);
        gain.connect(offlineCtx.destination);
        source.start(0);
    });

    const combinedBuffer = await offlineCtx.startRendering();

    // 2. Apply Pitch and Tempo
    const pitchTempoBuffer = await applyPitchAndTempo(combinedBuffer, effects.pitch / 100, effects.tempo);

    // 3. Apply EQ
    const eqOfflineCtx = new OfflineAudioContext(channels, pitchTempoBuffer.length, sampleRate);
    const eqSource = eqOfflineCtx.createBufferSource();
    eqSource.buffer = pitchTempoBuffer;

    const bass = eqOfflineCtx.createBiquadFilter();
    bass.type = 'lowshelf';
    bass.frequency.value = 200;
    bass.gain.value = effects.bass;

    const mid = eqOfflineCtx.createBiquadFilter();
    mid.type = 'peaking';
    mid.frequency.value = 1000;
    mid.Q.value = 0.7;
    mid.gain.value = effects.mid;

    const treble = eqOfflineCtx.createBiquadFilter();
    treble.type = 'highshelf';
    treble.frequency.value = 3000;
    treble.gain.value = effects.treble;

    eqSource.connect(bass);
    bass.connect(mid);
    mid.connect(treble);
    treble.connect(eqOfflineCtx.destination);
    eqSource.start(0);

    return await eqOfflineCtx.startRendering();
}
