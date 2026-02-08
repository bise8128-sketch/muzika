import { IFileSource } from '../io/types';

export interface AudioChunk {
    data: Float32Array; // Decoded PCM data (mono/stereo interleaved or just mono? usually interleaved)
    channelCount: number;
    sampleRate: number;
    startTime: number;
    duration: number;
}

export interface IAudioSegmenter {
    init(): Promise<void>;
    segmentFile(fileSource: IFileSource, segmentDuration: number): AsyncGenerator<AudioChunk>;
    dispose(): void;
}
