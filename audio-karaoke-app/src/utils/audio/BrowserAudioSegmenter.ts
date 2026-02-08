import { IAudioSegmenter, AudioChunk } from './IAudioSegmenter';
import { IFileSource } from '../io/types';
import { BrowserFileSource } from '../io/BrowserFileSource';
import type { FFmpegWorkerResponse } from './ffmpeg.worker';

export class BrowserAudioSegmenter implements IAudioSegmenter {
    private worker: Worker | null = null;
    private baseUrl: string;
    public totalDuration: number = 0;

    constructor() {
        this.baseUrl = typeof window !== 'undefined'
            ? `${window.location.origin}/ffmpeg/umd`
            : '/ffmpeg/umd';
    }

    async init() {
        if (!this.worker) {
            // Create worker using the separate file
            this.worker = new Worker(new URL('./ffmpeg.worker.ts', import.meta.url), { type: 'module' });

            // Wait for worker to be ready
            await new Promise<void>((resolve, reject) => {
                const handler = (e: MessageEvent<FFmpegWorkerResponse>) => {
                    const data = e.data;
                    if (data.type === 'READY') {
                        this.worker?.removeEventListener('message', handler);
                        resolve();
                    } else if (data.type === 'ERROR') {
                        this.worker?.removeEventListener('message', handler);
                        reject(new Error(data.payload.message));
                    }
                };
                this.worker!.addEventListener('message', handler);
                this.worker!.postMessage({ type: 'INIT', payload: { baseUrl: this.baseUrl } });
            });
        }
    }

    async *segmentFile(fileSource: IFileSource, segmentDuration: number): AsyncGenerator<AudioChunk> {
        if (!this.worker) await this.init();

        if (!(fileSource instanceof BrowserFileSource)) {
            throw new Error('BrowserAudioSegmenter requires BrowserFileSource');
        }

        const file = fileSource.blob;

        const queue: AudioChunk[] = [];
        let resolveSignal: (() => void) | null = null;
        let rejectSignal: ((err: Error) => void) | null = null;
        let done = false;
        let error: Error | null = null;

        const onMessage = (e: MessageEvent<FFmpegWorkerResponse>) => {
            const data = e.data;
            if (data.type === 'CHUNK') {
                queue.push(data.payload);
                if (resolveSignal) {
                    resolveSignal();
                    resolveSignal = null;
                }
            } else if (data.type === 'DURATION') {
                this.totalDuration = data.payload.duration;
            } else if (data.type === 'DONE') {
                done = true;
                if (resolveSignal) {
                    resolveSignal();
                    resolveSignal = null;
                }
            } else if (data.type === 'ERROR') {
                error = new Error(data.payload.message);
                if (rejectSignal) {
                    rejectSignal(error);
                    rejectSignal = null;
                }
                if (resolveSignal) {
                    resolveSignal();
                    resolveSignal = null;
                }
            }
        };

        this.worker!.addEventListener('message', onMessage);
        this.worker!.postMessage({
            type: 'SEGMENT_FILE',
            payload: { file, segmentDuration }
        });

        try {
            while (true) {
                if (queue.length > 0) {
                    yield queue.shift()!;
                } else if (error) {
                    throw error;
                } else if (done) {
                    break;
                } else {
                    await new Promise<void>((resolve, reject) => {
                        resolveSignal = resolve;
                        rejectSignal = reject;
                    });
                }
            }
        } finally {
            this.worker!.removeEventListener('message', onMessage);
        }
    }

    dispose() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }
}
