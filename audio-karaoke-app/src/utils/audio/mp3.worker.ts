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

            // Import UMD scripts (bypass Webpack)
            // @ts-ignore
            importScripts(`${baseUrl}/ffmpeg.js`);
            // @ts-ignore
            importScripts(`${baseUrl}/ffmpeg-core.js`);

            // Initialize FFmpeg
            ffmpeg = new FFmpeg.FFmpeg();

            await ffmpeg.load({
                coreURL: `${baseUrl}/ffmpeg-core.js`,
                wasmURL: `${baseUrl}/ffmpeg-core.wasm`,
                workerURL: `${baseUrl}/ffmpeg-core.worker.js`, // Some versions have this
            });

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
