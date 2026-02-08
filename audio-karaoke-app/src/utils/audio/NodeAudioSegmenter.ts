import { IAudioSegmenter, AudioChunk } from './IAudioSegmenter';
import { IFileSource } from '../io/types';

export class NodeAudioSegmenter implements IAudioSegmenter {
    async init() {
        // Check for ffmpeg binary
    }

    async *segmentFile(fileSource: IFileSource, segmentDuration: number): AsyncGenerator<AudioChunk> {
        throw new Error('NodeAudioSegmenter not yet implemented');
    }

    dispose() {
        // cleanup
    }
}
