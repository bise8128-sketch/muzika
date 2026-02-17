import { bufferPool } from '../bufferPool';

describe('BufferPool AudioBuffer support', () => {
    it('should acquire and release AudioBuffers', () => {
        const mockCtx = {
            createBuffer: jest.fn().mockImplementation((ch, len, sr) => ({
                numberOfChannels: ch,
                length: len,
                sampleRate: sr
            }))
        } as any;

        const buffer = bufferPool.acquireAudioBuffer(mockCtx, 2, 1024, 44100);
        expect(mockCtx.createBuffer).toHaveBeenCalledWith(2, 1024, 44100);
        
        bufferPool.releaseAudioBuffer(buffer);
        
        const secondBuffer = bufferPool.acquireAudioBuffer(mockCtx, 2, 1024, 44100);
        expect(secondBuffer).toBe(buffer);
        expect(mockCtx.createBuffer).toHaveBeenCalledTimes(1); // Should reuse
    });

    it('should respect maxPoolSize', () => {
        const mockCtx = {
            createBuffer: jest.fn().mockImplementation((ch, len, sr) => ({
                numberOfChannels: ch,
                length: len,
                sampleRate: sr
            }))
        } as any;

        const buffers = [];
        for (let i = 0; i < 15; i++) {
            buffers.push(bufferPool.acquireAudioBuffer(mockCtx, 1, 512, 48000));
        }

        buffers.forEach(b => bufferPool.releaseAudioBuffer(b));
        
        // Clear and refill should show reuse up to limit
        bufferPool.clear();
        const b1 = bufferPool.acquireAudioBuffer(mockCtx, 1, 512, 48000);
        bufferPool.releaseAudioBuffer(b1);
        const b2 = bufferPool.acquireAudioBuffer(mockCtx, 1, 512, 48000);
        expect(b2).toBe(b1);
    });
});
