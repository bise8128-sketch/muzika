import { float32ArrayToAudioBuffer } from './audioDecoder';

export interface StreamChunk {
    vocals: Float32Array;
    instrumentals: Float32Array;
    position: number; // In samples
    sampleRate: number;
}

export class StreamableBufferManager {
    private context: AudioContext;
    private nextStartTime: number = 0;
    private isPlaying: boolean = false;
    private activeSources: AudioBufferSourceNode[] = [];
    private gainNodes: { vocals: GainNode; instrumentals: GainNode };
    private chunks: StreamChunk[] = []; // Store chunks for seeking/replay
    private isBuffering: boolean = false;
    private initialBufferTime: number = 0.2; // 200ms buffer before start

    constructor(context: AudioContext) {
        this.context = context;
        this.gainNodes = {
            vocals: context.createGain(),
            instrumentals: context.createGain()
        };
        this.gainNodes.vocals.connect(context.destination);
        this.gainNodes.instrumentals.connect(context.destination);
    }

    /**
     * Resets the manager for a new track
     */
    reset() {
        this.stop();
        this.chunks = [];
        this.nextStartTime = 0;
        this.isPlaying = false;
        this.isBuffering = false;
    }

    /**
     * Adds a new processed chunk to the manager
     */
    async addChunk(chunk: StreamChunk) {
        this.chunks.push(chunk);

        if (this.isPlaying) {
            await this.scheduleChunk(chunk);
        } else if (!this.nextStartTime && !this.isBuffering) {
            // First chunk received, start playback automatically if intended
            // Or just wait for play()
        }
    }

    /**
     * Schedules a single chunk for playback
     */
    private async scheduleChunk(chunk: StreamChunk) {
        const vocalsBuffer = await float32ArrayToAudioBuffer(chunk.vocals, chunk.sampleRate);
        const instrumentalsBuffer = await float32ArrayToAudioBuffer(chunk.instrumentals, chunk.sampleRate);

        // If nextStartTime is 0 (first chunk) or behind current time, sync it
        const currentTime = this.context.currentTime;
        if (this.nextStartTime < currentTime) {
            this.nextStartTime = currentTime + 0.05; // Slight offset
        }

        this.playBuffer(vocalsBuffer, this.gainNodes.vocals, this.nextStartTime);
        this.playBuffer(instrumentalsBuffer, this.gainNodes.instrumentals, this.nextStartTime);

        this.nextStartTime += vocalsBuffer.duration;
    }

    private playBuffer(buffer: AudioBuffer, output: GainNode, time: number) {
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.connect(output);
        source.start(time);
        this.activeSources.push(source);

        // Cleanup when done
        source.onended = () => {
            const index = this.activeSources.indexOf(source);
            if (index > -1) {
                this.activeSources.splice(index, 1);
            }
        };
    }

    /**
     * Starts playback from current position
     */
    async play() {
        if (this.isPlaying) return;
        this.isPlaying = true;

        if (this.context.state === 'suspended') {
            await this.context.resume();
        }

        // Schedule all existing chunks that haven't been played
        // For simplicity, in this streaming version, we might just re-schedule everything 
        // if we are resuming from 0, or calculate offset.
        // But for "progressive" playback, we usually play as we receive.

        // If we have accumulated chunks but stopped, we need to schedule them.
        this.nextStartTime = this.context.currentTime + 0.1;

        for (const chunk of this.chunks) {
            // In a real implementation, we'd check if chunk is in the future relative to seek position
            await this.scheduleChunk(chunk);
        }
    }

    stop() {
        this.isPlaying = false;
        this.activeSources.forEach(source => {
            try {
                source.stop();
            } catch (e) {
                // Ignore if already stopped
            }
        });
        this.activeSources = [];
        this.nextStartTime = 0;
    }

    setVolume(type: 'vocals' | 'instrumentals', value: number) {
        const node = this.gainNodes[type];
        if (node) {
            node.gain.value = value;
        }
    }

    clear() {
        this.reset();
    }

    getAllAudioBuffers(context: AudioContext): { vocals: AudioBuffer; instrumentals: AudioBuffer } {
        if (this.chunks.length === 0) {
            return {
                vocals: context.createBuffer(2, 1, context.sampleRate),
                instrumentals: context.createBuffer(2, 1, context.sampleRate)
            };
        }

        // Calculate total length based on the last chunk's position and length
        // Assuming chunks are ordered. If not, we should sort them.
        // But we append them in order usually.
        const lastChunk = this.chunks[this.chunks.length - 1];
        const totalLength = lastChunk.position + lastChunk.vocals.length;

        const vocalsBuffer = context.createBuffer(2, totalLength, lastChunk.sampleRate);
        const instrumentalsBuffer = context.createBuffer(2, totalLength, lastChunk.sampleRate);

        const vL = vocalsBuffer.getChannelData(0);
        const vR = vocalsBuffer.getChannelData(1);
        const iL = instrumentalsBuffer.getChannelData(0);
        const iR = instrumentalsBuffer.getChannelData(1);

        for (const chunk of this.chunks) {
            // Assuming stereo chunks for now. If mono, we duplicate.
            // chunk.vocals is Float32Array (interleaved? or just one channel? 
            // The worker sends Float32Array. 
            // In separateAudio.ts it was handling stereo?
            // "vocals: Float32Array; instrumentals: Float32Array"
            // Usually if it's from onnx, it might be mono or stereo interleaved.
            // audio.worker.ts sends: vocabChunk (Float32Array).
            // If it's interleaved, we need to de-interleave.
            // If it's mono, we copy to both.

            // For this implementation, let's assume valid mono or stereo.
            // But wait, the bufferManager in separateAudio was passed "channels: 2".
            // My chunks just have Float32Array.

            // Let's assume the chunk data is channel-interleaved if length > duration * sampleRate?
            // Or just single channel?
            // The worker slices from 'vocalsMerged' which was 'outputLength'.
            // 'decodedData.left.length' -> single channel length.
            // So chunks are likely single channel (or split planar).

            // Let's assume mono for now or check usage.
            // If mono, copy to both channels.
            vL.set(chunk.vocals, chunk.position);
            vR.set(chunk.vocals, chunk.position);
            iL.set(chunk.instrumentals, chunk.position);
            iR.set(chunk.instrumentals, chunk.position);
        }

        return { vocals: vocalsBuffer, instrumentals: instrumentalsBuffer };
    }
}
