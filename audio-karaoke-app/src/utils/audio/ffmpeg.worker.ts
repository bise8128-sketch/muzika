import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

export type FFmpegWorkerMessage =
    | { type: 'INIT'; payload: { baseUrl: string } }
    | { type: 'SEGMENT_FILE'; payload: { file: File; segmentDuration: number } }
    | { type: 'ABORT' };

export type FFmpegWorkerResponse =
    | { type: 'READY' }
    | { type: 'CHUNK'; payload: { data: Float32Array; startTime: number; duration: number; sampleRate: number; channelCount: number } }
    | { type: 'DURATION'; payload: { duration: number } }
    | { type: 'DONE'; payload: { totalDuration: number } }
    | { type: 'ERROR'; payload: { message: string } };

const ctx = self as unknown as Worker;
let ffmpeg: FFmpeg | null = null;
let isAborted = false;

ctx.onmessage = async (e: MessageEvent<FFmpegWorkerMessage>) => {
    const { type } = e.data;

    try {
        if (type === 'INIT') {
            const { baseUrl } = e.data.payload;
            if (!ffmpeg) {
                ffmpeg = new FFmpeg();

                // Load ffmpeg-core
                await ffmpeg.load({
                    coreURL: `${baseUrl}/ffmpeg-core.js`,
                    wasmURL: `${baseUrl}/ffmpeg-core.wasm`,
                    // workerURL: `${baseUrl}/ffmpeg-core.worker.js` // If using MT
                });
            }
            ctx.postMessage({ type: 'READY' });
        }
        else if (type === 'SEGMENT_FILE') {
            const { file, segmentDuration } = e.data.payload;
            if (!ffmpeg) throw new Error('FFmpeg not initialized');

            isAborted = false;

            // Mount file using WORKERFS
            const mountDir = '/input';
            const inputFile = 'source';

            await ffmpeg.createDir(mountDir);

            // WORKERFS allows mounting File/Blob directly without copying to memory
            // @ts-expect-error - WORKERFS is valid but might not be in the type definition if using older types
            await ffmpeg.mount('WORKERFS', {
                files: [file], // Mount the file as is
                blobs: [],
                cacheLength: 0
            }, mountDir);

            // Get duration
            const inputPath = `${mountDir}/${file.name}`; // WORKERFS usually uses the file name
            // Wait, passing [file] to WORKERFS mounts them at the root of the mount point with their names?
            // Yes, usually.

            // Let's verify the file path.
            // When mounting { files: [file] }, the file is accessible at `mountDir + '/' + file.name`.

            // Probe duration
            let duration = 0;
            const logCallback = ({ message }: { message: string }) => {
                const durationMatch = message.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
                if (durationMatch) {
                    const [_, h, m, s] = durationMatch;
                    duration = Number(h) * 3600 + Number(m) * 60 + Number(s);
                }
            };

            ffmpeg.on('log', logCallback);
            await ffmpeg.exec(['-i', `${mountDir}/${file.name}`]);
            ffmpeg.off('log', logCallback);

            console.log(`[FFmpegWorker] Duration: ${duration}`);

            ctx.postMessage({ type: 'DURATION', payload: { duration } });

            if (duration === 0) {
                // Fallback: try to decode a bit to check?
                // Or just assume it works and loop until error?
                // For now, fail if no duration (robustness TODO)
            }

            // Output format properties
            const sampleRate = 44100;
            const channels = 2;

            // Loop and segment
            for (let startTime = 0; startTime < duration; startTime += segmentDuration) {
                if (isAborted) break;

                const outputName = 'output.raw';

                // -f f32le: 32-bit float PCM
                // -ac 2: Stereo
                // -ar 44100: 44.1kHz
                await ffmpeg.exec([
                    '-ss', startTime.toString(),
                    '-t', segmentDuration.toString(),
                    '-i', `${mountDir}/${file.name}`,
                    '-f', 'f32le',
                    '-ac', channels.toString(),
                    '-ar', sampleRate.toString(),
                    '-y', // Overwrite output
                    outputName
                ]);

                // Read output
                const data = await ffmpeg.readFile(outputName);
                if (typeof data === 'string') {
                    throw new Error('FFmpeg output was string, expected Uint8Array');
                }

                // Convert Uint8Array to Float32Array
                // data is Uint8Array view of the file.
                // We create a copy of the buffer because we transfer it
                const float32Data = new Float32Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));

                // Transfer ownership of the buffer
                ctx.postMessage({
                    type: 'CHUNK',
                    payload: {
                        data: float32Data,
                        startTime,
                        duration: segmentDuration, // Approximate
                        sampleRate,
                        channelCount: channels
                    }
                }, [float32Data.buffer]);

                // Cleanup output file to free MEMFS
                await ffmpeg.deleteFile(outputName);
            }

            // Cleanup mount
            await ffmpeg.unmount(mountDir);
            await ffmpeg.deleteDir(mountDir);

            ctx.postMessage({ type: 'DONE', payload: { totalDuration: duration } });
        }
        else if (type === 'ABORT') {
            isAborted = true;
        }
    } catch (error) {
        ctx.postMessage({ type: 'ERROR', payload: { message: (error as Error).message } });
    }
};
