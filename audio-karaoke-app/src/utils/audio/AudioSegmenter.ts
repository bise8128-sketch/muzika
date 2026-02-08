import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { IFileSource } from '../io/types';
import { decodeArrayBuffer } from './audioDecoder';

export interface AudioChunk {
    data: AudioBuffer; // Or Float32Array? AudioBuffer is easier to work with in existing code
    startTime: number;
    duration: number;
}

export class AudioSegmenter {
    private ffmpeg: FFmpeg | null = null;
    private isInitialized = false;
    private baseUrl: string;

    constructor() {
        // Determine base URL for FFmpeg assets
        this.baseUrl = typeof window !== 'undefined'
            ? `${window.location.origin}/ffmpeg/umd`
            : '/ffmpeg/umd';
    }

    async init() {
        if (this.isInitialized) return;

        this.ffmpeg = new FFmpeg();

        const coreJsUrl = `${this.baseUrl}/ffmpeg-core.js`;
        const wasmUrl = `${this.baseUrl}/ffmpeg-core.wasm`;

        // Log for debugging
        this.ffmpeg.on('log', ({ message }) => {
            // console.debug('[FFmpeg]', message);
        });

        await this.ffmpeg.load({
            coreURL: coreJsUrl,
            wasmURL: wasmUrl,
        });

        this.isInitialized = true;
    }

    async *segmentFile(fileSource: IFileSource, segmentDuration: number = 15): AsyncGenerator<AudioChunk> {
        if (!this.ffmpeg || !this.isInitialized) {
            await this.init();
        }

        const ffmpeg = this.ffmpeg!;
        const inputName = 'input_audio';

        // Write file to MEMFS
        // Note: For very large files, this is still a bottleneck if we read the whole file into RAM.
        // But BrowserFileSource uses Blob, which is backed by disk/OS. 
        // We need to read it into ArrayBuffer to write to ffmpeg.writeFile.
        // This effectively loads the file into RAM.
        // TODO: Use mount() with WORKERFS if possible in the future for true zero-copy.
        // For now, we assume user machine has enough RAM for the compressed file (e.g. 100MB MP3).

        const fileData = await fileSource.slice(0, fileSource.size);
        await ffmpeg.writeFile(inputName, new Uint8Array(fileData));

        // Probe duration
        // We run a command that outputs info and parse the log, 
        // or we can use a probe helper if available.
        // Simplest way: transcoding 0 seconds and parsing output? 
        // Or just trust the duration from the file metadata if available?
        // Let's use ffmpeg to get exact duration.

        let duration = 0;
        const logCallback = ({ message }: { message: string }) => {
            const durationMatch = message.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
            if (durationMatch) {
                const [_, h, m, s] = durationMatch;
                duration = Number(h) * 3600 + Number(m) * 60 + Number(s);
            }
        };

        ffmpeg.on('log', logCallback);
        // Just probe
        await ffmpeg.exec(['-i', inputName]);
        ffmpeg.off('log', logCallback);

        if (duration === 0) {
            // Fallback or error
            console.warn('Could not determine duration with FFmpeg, assuming default processing');
            // If we can't get duration, we might just try to loop until failure?
            // But let's try to trust the caller or metadata if possible.
            // For now, let's assume valid duration found.
        }

        console.log(`[AudioSegmenter] File duration: ${duration}s`);

        // Loop and segment
        for (let startTime = 0; startTime < duration; startTime += segmentDuration) {
            const outputName = `segment_${startTime}.wav`;

            // Extract chunk
            // -ss before -i is faster (input seeking)
            await ffmpeg.exec([
                '-ss', startTime.toString(),
                '-t', segmentDuration.toString(),
                '-i', inputName,
                '-f', 'wav',
                '-ac', '2', // Force stereo
                '-ar', '44100', // Force 44.1kHz
                outputName
            ]);

            // Read output
            const data = await ffmpeg.readFile(outputName);

            // Clean up output file immediately
            await ffmpeg.deleteFile(outputName);

            // Decode the WAV chunk to AudioBuffer
            // We can use the browser's decodeAudioData since the chunk is small
            const audioBuffer = await decodeArrayBuffer(data.buffer as ArrayBuffer);

            yield {
                data: audioBuffer,
                startTime,
                duration: audioBuffer.duration
            };
        }

        // Cleanup input
        await ffmpeg.deleteFile(inputName);
    }

    async dispose() {
        if (this.ffmpeg) {
            this.ffmpeg.terminate(); // or simple cleanup if API differs
            this.ffmpeg = null;
            this.isInitialized = false;
        }
    }
}
