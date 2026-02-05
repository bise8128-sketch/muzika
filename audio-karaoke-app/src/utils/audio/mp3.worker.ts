/**
 * MP3 Export Worker
 * Handles FFmpeg encoding in a worker to avoid main thread module resolution issues
 */

// Define UMD global types for FFmpeg
declare const FFmpeg: {
    FFmpeg: new () => any;
};

// Initialize variables
let ffmpeg: any = null;

self.onmessage = async (e) => {
    const { type, payload } = e.data;

    if (type === 'INIT') {
        try {
            const { baseUrl } = payload;

            if (ffmpeg) {
                self.postMessage({ type: 'INIT_SUCCESS' });
                return;
            }

            // Shim document for ffmpeg.js UMD build which expects it
            console.log('[MP3 Worker] Initializing FFmpeg with baseUrl:', baseUrl);

            const docShim = {
                baseURI: self.location.href,
                currentScript: null,
                getElementsByTagName: () => [],
                createElement: () => ({}),
                head: {},
                body: {}
            };

            // Aggressively shim document in all possible global scopes
            if (typeof (self as any).document === 'undefined') {
                console.log('[MP3 Worker] Shimming self.document');
                (self as any).document = docShim;
            }

            if (typeof (globalThis as any).document === 'undefined') {
                console.log('[MP3 Worker] Shimming globalThis.document');
                (globalThis as any).document = docShim;
            }

            // Verify shim
            try {
                // @ts-ignore
                console.log('[MP3 Worker] Document check:', document.baseURI);
            } catch (e) {
                console.error('[MP3 Worker] Document check failed:', e);
            }

            // Import UMD scripts (bypass Webpack)
            // @ts-ignore
            importScripts(`${baseUrl}/ffmpeg.js`);

            // Initialize FFmpeg (handle different export names)
            const FFmpegLib = (self as any).FFmpeg || (self as any).FFmpegWASM;
            if (!FFmpegLib) throw new Error('FFmpeg library not found in global scope');

            ffmpeg = new FFmpegLib.FFmpeg();

            console.log('[MP3 Worker] FFmpeg initialized, loading core...');

            await ffmpeg.load({
                coreURL: `${baseUrl}/ffmpeg-core.js`,
                wasmURL: `${baseUrl}/ffmpeg-core.wasm`,
            });

            console.log('[MP3 Worker] FFmpeg core loaded successfully');

            self.postMessage({ type: 'INIT_SUCCESS' });
        } catch (error: any) {
            self.postMessage({ type: 'ERROR', payload: error.message });
        }
    }

    if (type === 'EXPORT') {
        try {
            if (!ffmpeg) throw new Error('FFmpeg not initialized');

            const { wavData, bitrate = 320 } = payload;

            const inputName = 'input.wav';
            const outputName = 'output.mp3';

            await ffmpeg.writeFile(inputName, new Uint8Array(wavData));

            await ffmpeg.exec([
                '-i', inputName,
                '-b:a', `${bitrate}k`,
                outputName
            ]);

            const data = await ffmpeg.readFile(outputName);

            // Cleanup
            await ffmpeg.deleteFile(inputName);
            await ffmpeg.deleteFile(outputName);

            self.postMessage({
                type: 'EXPORT_SUCCESS',
                payload: data.buffer
            }, {
                transfer: [data.buffer]
            } as any);

        } catch (error: any) {
            self.postMessage({ type: 'ERROR', payload: error.message });
        }
    }
};
