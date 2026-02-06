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
        log(`Failed to verify file existence for ${url}`, 'warn');
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
            log(`Initializing FFmpeg (attempt ${attempt + 1}/${maxRetries + 1})...`);

            // Verify files exist before loading
            const coreJsUrl = `${baseUrl}/ffmpeg.js`;
            const coreWasmUrl = `${baseUrl}/ffmpeg-core.js`;
            const wasmUrl = `${baseUrl}/ffmpeg-core.wasm`;

            const jsExists = await verifyFileExists(coreJsUrl);
            const coreExists = await verifyFileExists(coreWasmUrl);
            const wasmExists = await verifyFileExists(wasmUrl);

            if (!jsExists) {
                throw new Error(`FFmpeg JS file not found at ${coreJsUrl}`);
            }
            if (!coreExists) {
                throw new Error(`FFmpeg core JS file not found at ${coreWasmUrl}`);
            }
            if (!wasmExists) {
                throw new Error(`FFmpeg WASM file not found at ${wasmUrl}`);
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
            if (typeof (self as any).document === 'undefined') {
                log('Shimming self.document');
                (self as any).document = docShim;
            }

            if (typeof (globalThis as any).document === 'undefined') {
                log('Shimming globalThis.document');
                (globalThis as any).document = docShim;
            }

            // Verify shim
            try {
                log(`Document baseURI: ${(document as any).baseURI}`);
            } catch (e) {
                log('Document check failed (this is expected in some environments)', 'warn');
            }

            // Import UMD scripts (bypass Webpack)
            // @ts-ignore
            importScripts(coreJsUrl);

            // Initialize FFmpeg (handle different export names)
            const FFmpegLib = (self as any).FFmpeg || (self as any).FFmpegWASM;
            if (!FFmpegLib) throw new Error('FFmpeg library not found in global scope');

            ffmpeg = new FFmpegLib.FFmpeg();

            log('FFmpeg initialized, loading core...');

            await ffmpeg.load({
                coreURL: coreWasmUrl,
                wasmURL: wasmUrl,
            });

            isInitialized = true;
            log('FFmpeg core loaded successfully');

            return;
        } catch (error: any) {
            lastError = error;
            log(`Initialization attempt ${attempt + 1} failed: ${error.message}`, 'error');

            // Clean up failed state
            ffmpeg = null;
            isInitialized = false;

            // Don't retry on certain errors
            if (error.message.includes('not found') || error.message.includes('404')) {
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
        } catch (error: any) {
            log(`INIT failed: ${error.message}`, 'error');
            self.postMessage({
                type: 'ERROR',
                payload: JSON.stringify({
                    type: WorkerErrorType.INIT_FAILED,
                    message: error.message,
                    details: error.stack || 'No stack trace available'
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

            log(`Writing input file (${(wavData.byteLength / 1024 / 1024).toFixed(2)} MB)...`);
            await ffmpeg.writeFile(inputName, new Uint8Array(wavData));

            log('Encoding to MP3...');
            await ffmpeg.exec([
                '-i', inputName,
                '-b:a', `${bitrate}k`,
                '-y', // Overwrite output file if exists
                outputName
            ]);

            log('Reading output...');
            const data = await ffmpeg.readFile(outputName);

            // Cleanup
            await ffmpeg.deleteFile(inputName);
            await ffmpeg.deleteFile(outputName);

            log(`Export successful (${(data.byteLength / 1024 / 1024).toFixed(2)} MB)`);

            self.postMessage({
                type: 'EXPORT_SUCCESS',
                payload: data.buffer
            }, {
                transfer: [data.buffer]
            } as any);

        } catch (error: any) {
            log(`EXPORT failed: ${error.message}`, 'error');
            self.postMessage({
                type: 'ERROR',
                payload: JSON.stringify({
                    type: WorkerErrorType.ENCODING_FAILED,
                    message: error.message,
                    details: error.stack || 'No stack trace available'
                })
            });
        }
    }
};
