
/**
 * Manages streaming audio playback with gapless scheduling.
 * Stores incoming chunks and schedules them on the AudioContext.
 */
export class StreamableBufferManager {
    private audioContext: AudioContext;
    private gainNode: GainNode;

    // Storage for the full audio reconstruction
    private vocalsChunks: Float32Array[] = [];
    private instrumentalsChunks: Float32Array[] = [];
    private totalLength = 0;

    // Playback scheduling
    private nextStartTime = 0;
    private isPlaying = false;
    private sampleRate: number;
    private scheduledNodes: AudioBufferSourceNode[] = [];

    constructor(audioContext: AudioContext) {
        this.audioContext = audioContext;
        this.sampleRate = audioContext.sampleRate;

        this.gainNode = audioContext.createGain();
        this.gainNode.connect(audioContext.destination);
    }

    /**
     * Adds a processed chunk to the manager and schedules it for playback if playing.
     */
    async addChunk(vocals: Float32Array, instrumentals: Float32Array) {
        this.vocalsChunks.push(vocals);
        this.instrumentalsChunks.push(instrumentals);
        this.totalLength += vocals.length;

        // Create AudioBuffer for this chunk
        const chunkBuffer = this.createAudioBuffer(vocals, instrumentals);

        if (this.isPlaying) {
            this.scheduleBuffer(chunkBuffer);
        }
    }

    private createAudioBuffer(channel1: Float32Array, channel2: Float32Array): AudioBuffer {
        const buffer = this.audioContext.createBuffer(2, channel1.length, this.sampleRate);
        // Cast to any to avoid strict shared buffer checks for this demo
        buffer.copyToChannel(channel1 as any, 0);
        buffer.copyToChannel(channel2 as any, 1);
        return buffer;
    }

    private scheduleBuffer(buffer: AudioBuffer) {
        // Determine start time
        // If nextStartTime is in the past, reset it to now (handling buffering delays)
        const currentTime = this.audioContext.currentTime;
        if (this.nextStartTime < currentTime) {
            this.nextStartTime = currentTime + 0.1; // Small buffer for safety
        }

        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.gainNode);

        source.start(this.nextStartTime);

        // Update next start time
        this.nextStartTime += buffer.duration;

        this.scheduledNodes.push(source);

        // Cleanup finished nodes
        source.onended = () => {
            const index = this.scheduledNodes.indexOf(source);
            if (index > -1) {
                this.scheduledNodes.splice(index, 1);
            }
        };
    }

    play() {
        if (this.isPlaying) return;
        this.isPlaying = true;

        // Resume context if suspended
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        // Play all accumulated chunks from start if not already scheduled
        // Logic simplified for progressive demo
        this.nextStartTime = this.audioContext.currentTime + 0.1;

        let accumulatedDuration = 0;
        for (let i = 0; i < this.vocalsChunks.length; i++) {
            const buffer = this.createAudioBuffer(this.vocalsChunks[i], this.instrumentalsChunks[i]);
            const source = this.audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(this.gainNode);

            const startTime = this.nextStartTime + accumulatedDuration;
            source.start(startTime);
            this.scheduledNodes.push(source);

            accumulatedDuration += buffer.duration;
        }

        // Update nextStartTime for future chunks
        this.nextStartTime += accumulatedDuration;
    }

    pause() {
        this.isPlaying = false;
        this.scheduledNodes.forEach(node => node.stop());
        this.scheduledNodes = [];
    }

    reset() {
        this.pause();
        this.vocalsChunks = [];
        this.instrumentalsChunks = [];
        this.totalLength = 0;
        this.nextStartTime = 0;
        this.scheduledNodes = [];
    }

    getAllAudioBuffers(): { vocals: AudioBuffer, instrumentals: AudioBuffer } {
        const vBuffer = this.audioContext.createBuffer(2, this.totalLength, this.sampleRate);
        const iBuffer = this.audioContext.createBuffer(2, this.totalLength, this.sampleRate);

        let offset = 0;
        for (const chunk of this.vocalsChunks) {
            vBuffer.getChannelData(0).set(chunk, offset);
            vBuffer.getChannelData(1).set(chunk, offset);
            offset += chunk.length;
        }

        let iOffset = 0;
        for (const chunk of this.instrumentalsChunks) {
            iBuffer.getChannelData(0).set(chunk, iOffset);
            iBuffer.getChannelData(1).set(chunk, iOffset);
            iOffset += chunk.length;
        }

        return { vocals: vBuffer, instrumentals: iBuffer };
    }
}
