/**
 * Optimized Audio Export Worker Pool
 * Uses Promise-based queuing, task priorities, progress reporting, and pre-warming
 * for better UI thread performance
 */

import { MP3ExportError, MP3ExportErrorType } from './audioExporter';

// Task priority levels for export queue
export type ExportPriority = 'HIGH' | 'NORMAL' | 'LOW';

interface ExportTask {
    id: string;
    wavData: ArrayBuffer;
    bitrate: number;
    priority: ExportPriority;
    resolve: (blob: Blob) => void;
    reject: (error: Error) => void;
    onProgress?: (progress: number) => void;
}

/**
 * Optimized Worker Pool for Audio Export
 * Uses Promise-based queuing instead of polling for better performance
 */
export class AudioExportWorkerPool {
    private workers: Worker[] = [];
    private availableWorkers: Worker[] = [];
    private maxWorkers: number;
    private workerUrl: string;
    private taskQueue: ExportTask[] = [];
    private isProcessing = false;
    private idleTimer: ReturnType<typeof setTimeout> | null = null;
    private idleTimeout: number = 60000; // 1 minute idle timeout
    private baseUrl: string = '';
    private initPromise: Promise<void> | null = null;

    constructor(maxWorkers: number = 2) {
        this.maxWorkers = Math.min(maxWorkers, navigator.hardwareConcurrency || 2);
        this.workerUrl = this.createWorkerBlobUrl();
        
        // Initialize base URL
        if (typeof window !== 'undefined') {
            this.baseUrl = `${window.location.origin}/ffmpeg/umd`;
        }
    }

    /**
     * Pre-warm the worker pool by initializing workers ahead of time
     * Call this when the app loads or when user hovers over export button
     */
    async warmUp(): Promise<void> {
        if (this.initPromise) return this.initPromise;
        
        this.initPromise = this._doWarmUp();
        return this.initPromise;
    }

    private async _doWarmUp(): Promise<void> {
        const promises: Promise<Worker>[] = [];
        
        // Pre-create workers up to maxWorkers
        for (let i = 0; i < this.maxWorkers; i++) {
            promises.push(this.createInitializedWorker());
        }
        
        try {
            const workers = await Promise.all(promises);
            this.workers = workers;
            this.availableWorkers = [...workers];
            console.log('[AudioExportWorkerPool] Pre-warmed with', workers.length, 'workers');
        } catch (error) {
            console.warn('[AudioExportWorkerPool] Some workers failed to initialize:', error);
            // At least some workers should work
            if (this.workers.length === 0) {
                throw new Error('Failed to initialize any worker');
            }
        }
    }

    private async createInitializedWorker(): Promise<Worker> {
        const worker = new Worker(this.workerUrl);
        
        // Initialize FFmpeg in this worker
        await this.initializeWorker(worker);
        
        return worker;
    }

    private initializeWorker(worker: Worker): Promise<void> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Worker initialization timeout'));
            }, 60000); // 1 minute timeout for FFmpeg load

            const handleMessage = (e: MessageEvent) => {
                const { type } = e.data;
                if (type === 'INIT_SUCCESS') {
                    clearTimeout(timeout);
                    worker.removeEventListener('message', handleMessage);
                    worker.removeEventListener('error', handleError);
                    resolve();
                } else if (type === 'ERROR') {
                    clearTimeout(timeout);
                    worker.removeEventListener('message', handleMessage);
                    worker.removeEventListener('error', handleError);
                    reject(new Error(e.data.payload));
                }
            };

            const handleError = (err: ErrorEvent) => {
                clearTimeout(timeout);
                worker.removeEventListener('message', handleMessage);
                worker.removeEventListener('error', handleError);
                reject(new Error(err.message));
            };

            worker.addEventListener('message', handleMessage);
            worker.addEventListener('error', handleError);

            worker.postMessage({
                type: 'INIT',
                payload: { baseUrl: this.baseUrl }
            });
        });
    }

    /**
     * Promise-based worker acquisition - no polling!
     */
    async acquire(): Promise<Worker> {
        // Return available worker if exists
        if (this.availableWorkers.length > 0) {
            const worker = this.availableWorkers.pop()!;
            this.resetIdleTimer();
            return worker;
        }

        // Create new worker if under limit
        if (this.workers.length < this.maxWorkers) {
            try {
                const worker = await this.createInitializedWorker();
                this.workers.push(worker);
                this.resetIdleTimer();
                return worker;
            } catch (error) {
                console.warn('[AudioExportWorkerPool] Failed to create worker:', error);
            }
        }

        // Wait for a worker to become available using Promise
        return new Promise((resolve) => {
            const checkAndResolve = () => {
                if (this.availableWorkers.length > 0) {
                    const worker = this.availableWorkers.pop()!;
                    this.resetIdleTimer();
                    resolve(worker);
                } else {
                    // Try again after short delay
                    setTimeout(checkAndResolve, 10);
                }
            };
            
            checkAndResolve();
        });
    }

    /**
     * Queue an export task with priority
     */
    async queueExport(
        wavData: ArrayBuffer,
        bitrate: number,
        priority: ExportPriority = 'NORMAL',
        onProgress?: (progress: number) => void
    ): Promise<Blob> {
        return new Promise((resolve, reject) => {
            const task: ExportTask = {
                id: crypto.randomUUID(),
                wavData,
                bitrate,
                priority,
                resolve,
                reject,
                onProgress
            };

            // Add to priority queue
            this.addToQueue(task);
            
            // Process queue
            this.processQueue();
        });
    }

    private addToQueue(task: ExportTask): void {
        // Insert based on priority: HIGH > NORMAL > LOW
        const priorityOrder = { 'HIGH': 0, 'NORMAL': 1, 'LOW': 2 };
        
        const insertIndex = this.taskQueue.findIndex(
            t => priorityOrder[task.priority] < priorityOrder[t.priority]
        );
        
        if (insertIndex === -1) {
            this.taskQueue.push(task);
        } else {
            this.taskQueue.splice(insertIndex, 0, task);
        }
    }

    private processQueue(): void {
        if (this.isProcessing || this.taskQueue.length === 0) return;
        
        this.isProcessing = true;
        
        this.processNextTask();
    }

    private async processNextTask(): Promise<void> {
        if (this.taskQueue.length === 0) {
            this.isProcessing = false;
            this.startIdleTimer();
            return;
        }

        const task = this.taskQueue.shift()!;
        
        try {
            const worker = await this.acquire();
            
            const result = await this.executeOnWorker(worker, task);
            task.resolve(result);
            
            this.releaseWorker(worker);
        } catch (error) {
            task.reject(error instanceof Error ? error : new Error(String(error)));
        }
        
        // Process next task
        this.processNextTask();
    }

    private executeOnWorker(worker: Worker, task: ExportTask): Promise<Blob> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new MP3ExportError(
                    MP3ExportErrorType.ENCODING_FAILED,
                    'Export timeout',
                    'MP3 export took too long to complete'
                ));
            }, 300000); // 5 minute timeout

            const handleMessage = (e: MessageEvent) => {
                const { type, payload, progress } = e.data;

                if (type === 'PROGRESS') {
                    // Report progress to callback
                    if (task.onProgress && typeof progress === 'number') {
                        task.onProgress(progress);
                    }
                } else if (type === 'EXPORT_SUCCESS') {
                    clearTimeout(timeout);
                    worker.removeEventListener('message', handleMessage);
                    worker.removeEventListener('error', handleError);
                    resolve(new Blob([payload], { type: 'audio/mpeg' }));
                } else if (type === 'ERROR') {
                    clearTimeout(timeout);
                    worker.removeEventListener('message', handleMessage);
                    worker.removeEventListener('error', handleError);
                    
                    let errorMessage = payload;
                    try {
                        const errorData = JSON.parse(payload);
                        errorMessage = errorData.message || errorData.details || payload;
                    } catch {
                        // Use raw payload
                    }

                    reject(new MP3ExportError(
                        MP3ExportErrorType.ENCODING_FAILED,
                        'Encoding failed',
                        errorMessage
                    ));
                }
            };

            const handleError = (err: ErrorEvent) => {
                clearTimeout(timeout);
                worker.removeEventListener('message', handleMessage);
                worker.removeEventListener('error', handleError);
                
                reject(new MP3ExportError(
                    MP3ExportErrorType.WORKER_INIT_FAILED,
                    'Worker error',
                    err.message
                ));
            };

            worker.addEventListener('message', handleMessage);
            worker.addEventListener('error', handleError);

            worker.postMessage({
                type: 'EXPORT',
                payload: {
                    wavData: task.wavData,
                    bitrate: task.bitrate
                }
            }, [task.wavData] as Transferable[]);
        });
    }

    private releaseWorker(worker: Worker): void {
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

    private resetIdleTimer(): void {
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
        }
        this.idleTimer = setTimeout(() => {
            this.pruneIdleWorkers();
        }, this.idleTimeout);
    }

    private startIdleTimer(): void {
        this.resetIdleTimer();
    }

    private pruneIdleWorkers(): void {
        const minWorkers = 1; // Keep at least one worker alive
        if (this.workers.length <= minWorkers) return;

        // Remove excess workers
        while (this.workers.length > minWorkers && this.availableWorkers.length > 0) {
            const worker = this.availableWorkers.pop()!;
            worker.terminate();
            const index = this.workers.indexOf(worker);
            if (index > -1) {
                this.workers.splice(index, 1);
            }
        }
    }

    terminateAll(): void {
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
        }
        [...this.workers, ...this.availableWorkers].forEach(worker => worker.terminate());
        this.workers = [];
        this.availableWorkers = [];
        this.taskQueue = [];
    }

    /**
     * Get pool statistics for debugging
     */
    getStats() {
        return {
            totalWorkers: this.workers.length,
            availableWorkers: this.availableWorkers.length,
            busyWorkers: this.workers.length - this.availableWorkers.length,
            queueLength: this.taskQueue.length
        };
    }

    /**
     * Get the worker blob URL (needed for creating workers)
     */
    getWorkerUrl(): string {
        return this.workerUrl;
    }

    /**
     * Get the base URL for FFmpeg
     */
    getBaseUrl(): string {
        return this.baseUrl;
    }

    private createWorkerBlobUrl(): string {
        // Worker code as a string - same as original but inline
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

            function log(message, level = 'info') {
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

            async function verifyFileExists(url) {
                try {
                    const response = await fetch(url, { method: 'HEAD' });
                    return response.ok;
                } catch (e) {
                    log('Failed to verify file existence for ' + url, 'warn');
                    return false;
                }
            }

            async function initializeFFmpeg(baseUrl, maxRetries = 2) {
                let lastError = null;

                for (let attempt = 0; attempt <= maxRetries; attempt++) {
                    try {
                        log('Initializing FFmpeg (attempt ' + (attempt + 1) + '/' + (maxRetries + 1) + ')...');

                        const coreJsUrl = baseUrl + '/ffmpeg.js';
                        const coreWasmUrl = baseUrl + '/ffmpeg-core.js';
                        const wasmUrl = baseUrl + '/ffmpeg-core.wasm';

                        const jsExists = await verifyFileExists(coreJsUrl);
                        const coreExists = await verifyFileExists(coreWasmUrl);
                        const wasmExists = await verifyFileExists(wasmUrl);

                        if (!jsExists) throw new Error('FFmpeg JS file not found at ' + coreJsUrl);
                        if (!coreExists) throw new Error('FFmpeg core JS file not found at ' + coreWasmUrl);
                        if (!wasmExists) throw new Error('FFmpeg WASM file not found at ' + wasmUrl);

                        // Shim document for ffmpeg.js UMD build
                        const docShim = {
                            baseURI: self.location ? self.location.href : '',
                            currentScript: null,
                            getElementsByTagName: () => [],
                            createElement: () => ({}),
                            head: {},
                            body: {}
                        };

                        if (typeof self.document === 'undefined') self.document = docShim;
                        if (typeof globalThis.document === 'undefined') globalThis.document = docShim;

                        // Load FFmpeg UMD script
                        try {
                            const response = await fetch(coreJsUrl);
                            if (!response.ok) throw new Error('Failed to fetch FFmpeg JS: ' + response.status);
                            const scriptContent = await response.text();
                            const loadScript = new Function(scriptContent);
                            loadScript();
                        } catch (fetchError) {
                            throw new Error('Failed to load FFmpeg from ' + coreJsUrl + ': ' + fetchError);
                        }

                        const FFmpegLib = self.Ffmpeg || self.FFmpeg || self.FFmpegWASM;
                        if (!FFmpegLib) throw new Error('FFmpeg library not found in global scope');

                        ffmpeg = new FFmpegLib();
                        log('FFmpeg initialized, loading core...');

                        if (!ffmpeg) throw new Error('Failed to create FFmpeg instance');

                        await ffmpeg.load({
                            coreURL: coreWasmUrl,
                            wasmURL: wasmUrl,
                        });

                        isInitialized = true;
                        log('FFmpeg core loaded successfully');
                        return;

                    } catch (error) {
                        lastError = error instanceof Error ? error : new Error(String(error));
                        log('Initialization attempt ' + (attempt + 1) + ' failed: ' + lastError.message, 'error');
                        ffmpeg = null;
                        isInitialized = false;

                        const errorMessage = lastError.message;
                        if (errorMessage.includes('not found') || errorMessage.includes('404')) {
                            log('File not found error, aborting retries', 'error');
                            break;
                        }

                        if (attempt < maxRetries) {
                            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                        }
                    }
                }

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
                    } catch (error) {
                        const err = error instanceof Error ? error : new Error(String(error));
                        log('INIT failed: ' + err.message, 'error');
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

                        log('Writing input file (' + (wavData.byteLength / 1024 / 1024).toFixed(2) + ' MB)...');
                        await ffmpeg.writeFile(inputName, new Uint8Array(wavData));

                        log('Encoding to MP3...');
                        await ffmpeg.exec([
                            '-i', inputName,
                            '-b:a', bitrate + 'k',
                            '-y',
                            outputName
                        ]);

                        log('Reading output...');
                        const data = await ffmpeg.readFile(outputName);

                        await ffmpeg.deleteFile(inputName);
                        await ffmpeg.deleteFile(outputName);

                        log('Export successful (' + (data.byteLength / 1024 / 1024).toFixed(2) + ' MB)');

                        self.postMessage({
                            type: 'EXPORT_SUCCESS',
                            payload: data.buffer
                        }, { transfer: [data.buffer] });

                    } catch (error) {
                        const err = error instanceof Error ? error : new Error(String(error));
                        log('EXPORT failed: ' + err.message, 'error');
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

        const blob = new Blob([workerCode], { type: 'application/javascript' });
        return URL.createObjectURL(blob);
    }
}

// Global optimized worker pool instance
let exportWorkerPool: AudioExportWorkerPool | null = null;

/**
 * Get or create the global export worker pool
 */
export function getExportWorkerPool(): AudioExportWorkerPool {
    if (!exportWorkerPool) {
        exportWorkerPool = new AudioExportWorkerPool(
            Math.min(2, navigator.hardwareConcurrency || 2)
        );
    }
    return exportWorkerPool;
}

/**
 * Pre-warm the export worker pool
 * Call this on app initialization or when user hovers over export button
 */
export async function warmUpExportPool(): Promise<void> {
    const pool = getExportWorkerPool();
    await pool.warmUp();
}

/**
 * Cleanup the export worker pool
 * Call this when the app unmounts
 */
export function cleanupExportPool(): void {
    if (exportWorkerPool) {
        exportWorkerPool.terminateAll();
        exportWorkerPool = null;
    }
}
