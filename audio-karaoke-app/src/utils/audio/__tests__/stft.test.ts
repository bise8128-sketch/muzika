import { STFT, ISTFT } from '../stft';

describe('STFT/ISTFT Processing', () => {
    // Tolerances for floating point arithmetic
    const EPSILON = 1e-5;

    it('should reconstruct a simple sine wave with minimal error', () => {
        const sampleRate = 44100;
        const duration = 1.0; // 1 second
        const frequency = 440; // A4
        const fftSize = 2048;
        const hopLength = 512;

        // Generate Sine Wave
        const signal = new Float32Array(sampleRate * duration);
        for (let i = 0; i < signal.length; i++) {
            signal[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate);
        }

        const stft = new STFT(fftSize, hopLength);
        const istft = new ISTFT(fftSize, hopLength);

        // Process
        const { magnitude, phase, dims } = stft.process(signal);
        const reconstructed = istft.process(magnitude, phase, dims);

        // Verify length (ISTFT output might be slightly longer due to padding/framing)
        // We only care about the valid part matching the original signal length
        expect(reconstructed.length).toBeGreaterThanOrEqual(signal.length);

        // Calculate Mean Squared Error (MSE) on the valid region
        // Note: The beginning and end might have window processing artifacts if not handled perfectly (COLA)
        // We check the middle section for stability.
        let errorSum = 0;
        const checkStart = fftSize;
        const checkEnd = signal.length - fftSize;
        const count = checkEnd - checkStart;

        for (let i = checkStart; i < checkEnd; i++) {
            const diff = signal[i] - reconstructed[i];
            errorSum += diff * diff;
        }

        const mse = errorSum / count;

        // MSE should be very small
        expect(mse).toBeLessThan(EPSILON);
    });

    it('should handle silence effectively', () => {
        const fftSize = 1024;
        const hopLength = 256;
        const msg = new Float32Array(5000).fill(0);

        const stft = new STFT(fftSize, hopLength);
        const istft = new ISTFT(fftSize, hopLength);

        const { magnitude, phase, dims } = stft.process(msg);
        const reconstructed = istft.process(magnitude, phase, dims);

        // Should be all zeros (or very close)
        let maxVal = 0;
        for (let i = 0; i < msg.length; i++) {
            maxVal = Math.max(maxVal, Math.abs(reconstructed[i]));
        }
        expect(maxVal).toBeLessThan(1e-7);
    });
});
