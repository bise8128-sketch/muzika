import { buildChroma, correlateChromaToKey } from '../keyDetectionCore';
import { getRecommendedShift } from '../vocalRange';

describe('KeyDetector Core Logic', () => {
    // Mock C Major data: sine waves at C4, E4, G4
    const sampleRate = 44100;
    
    // Helper to generate a buffer with sequential notes (arpeggio)
    // The KeyDetector samples 20 spots, so we need enough length to be hit.
    // We'll create a 2-second buffer where we play notes sequentially.
    function generateArpeggio(frequencies: number[], durationSecs = 2.0): Float32Array {
        const totalSamples = Math.floor(sampleRate * durationSecs);
        const buffer = new Float32Array(totalSamples);
        const samplesPerNote = Math.floor(totalSamples / frequencies.length);

        for (let i = 0; i < totalSamples; i++) {
            const noteIndex = Math.min(Math.floor(i / samplesPerNote), frequencies.length - 1);
            const freq = frequencies[noteIndex];
            // Simple logic: fill segments with sine waves
            buffer[i] = Math.sin(2 * Math.PI * freq * (i / sampleRate));
        }
        return buffer;
    }

    // C Major: C4 (261.63), E4 (329.63), G4 (392.00)
    const cMajorFreqs = [261.63, 329.63, 392.00];
    // D Minor: D4 (293.66), F4 (349.23), A4 (440.00)
    const dMinorFreqs = [293.66, 349.23, 440.00];

    it('should detect C Major from a C-E-G arpeggio', () => {
        const pcm = generateArpeggio(cMajorFreqs);
        // We need enough samples to hit all notes. Default 20 samples over 2s = every 100ms.
        // Frequencies switch every 2s/3 = 666ms. So we will definitely sample all 3.
        const chroma = buildChroma(pcm, sampleRate);
        const key = correlateChromaToKey(chroma);

        expect(key.tonic).toBe('C');
        expect(key.scale).toBe('major');
    });

    it('should detect D Minor from a D-F-A arpeggio', () => {
        const pcm = generateArpeggio(dMinorFreqs);
        const chroma = buildChroma(pcm, sampleRate);
        const key = correlateChromaToKey(chroma);

        expect(key.tonic).toBe('D');
        expect(key.scale).toBe('minor');
    });

    it('should return low confidence/fallback for silence', () => {
        const silence = new Float32Array(sampleRate).fill(0);
        const chroma = buildChroma(silence, sampleRate);
        const key = correlateChromaToKey(chroma);

        // Expect C Major with 0 confidence as per implementation fallback
        expect(key.tonic).toBe('C');
        expect(key.scale).toBe('major');
        expect(key.confidence).toBe(0);
    });
});

describe('VocalRange', () => {
    it('should suggest 0 shift for Tenor if track is in C Major', () => {
        const trackKey = { tonic: 'C', scale: 'major' as const, confidence: 0.9 };
        const shift = getRecommendedShift(trackKey, 'tenor');
        expect(shift).toBe(0); 
    });

    it('should suggest -2 shift for Tenor if track is in D Major', () => {
        const trackKey = { tonic: 'D', scale: 'major' as const, confidence: 0.9 };
        const shift = getRecommendedShift(trackKey, 'tenor');
        expect(shift).toBe(-2); 
    });

    it('should suggest 0 shift for Soprano in C Major (octave adjusted)', () => {
        // Soprano center C5 (72) vs Tenor/Track C4 (60) = +12 semitones -> 0 shift
        const trackKey = { tonic: 'C', scale: 'major' as const, confidence: 0.9 };
        const shift = getRecommendedShift(trackKey, 'soprano');
        expect(shift).toBe(0);
    });
});
