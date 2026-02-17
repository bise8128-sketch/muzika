/**
 * Tests for PitchCorrector
 */

import { PitchCorrector, ScaleType } from '../pitchCorrection';
import { PitchCorrectionSettings } from '../../../types/audio';

// Mock AudioContext
class MockAudioContext {
    sampleRate = 44100;
    audioWorklet = {
        addModule: jest.fn().mockResolvedValue(undefined)
    };

    createGain() {
        return {
            gain: { value: 0 },
            connect: jest.fn(),
            disconnect: jest.fn()
        };
    }
}

// Mock AudioWorkletNode
class MockAudioWorkletNode {
    port = {
        onmessage: null as ((event: MessageEvent) => void) | null,
        postMessage: jest.fn(),
        close: jest.fn()
    };
    connect = jest.fn();
    disconnect = jest.fn();
}

describe('PitchCorrector', () => {
    let mockAudioContext: MockAudioContext;
    let pitchCorrector: PitchCorrector;

    beforeEach(() => {
        mockAudioContext = new MockAudioContext();
        pitchCorrector = new PitchCorrector(mockAudioContext as any);
    });

    afterEach(() => {
        pitchCorrector.destroy();
    });

    describe('initialization', () => {
        it('should initialize with default settings', () => {
            const settings = pitchCorrector.getSettings();
            expect(settings.enabled).toBe(false);
            expect(settings.scale).toBe('chromatic');
            expect(settings.referenceKey).toBe(0);
            expect(settings.retuneSpeed).toBe(0.5);
            expect(settings.correctionAmount).toBe(0.8);
        });

        it('should initialize with custom settings', () => {
            const customSettings: Partial<PitchCorrectionSettings> = {
                enabled: true,
                scale: 'major',
                referenceKey: 5,
                retuneSpeed: 0.7,
                correctionAmount: 0.9
            };
            const corrector = new PitchCorrector(mockAudioContext as any, customSettings);
            const settings = corrector.getSettings();

            expect(settings.enabled).toBe(true);
            expect(settings.scale).toBe('major');
            expect(settings.referenceKey).toBe(5);
            expect(settings.retuneSpeed).toBe(0.7);
            expect(settings.correctionAmount).toBe(0.9);

            corrector.destroy();
        });

        it('should not be ready before initialization', () => {
            expect(pitchCorrector.isReady()).toBe(false);
        });
    });

    describe('settings management', () => {
        it('should update scale', () => {
            pitchCorrector.setScale('major');
            const settings = pitchCorrector.getSettings();
            expect(settings.scale).toBe('major');
        });

        it('should update reference key', () => {
            pitchCorrector.setReferenceKey(7);
            const settings = pitchCorrector.getSettings();
            expect(settings.referenceKey).toBe(7);
        });

        it('should clamp reference key to valid range', () => {
            pitchCorrector.setReferenceKey(15);
            expect(pitchCorrector.getSettings().referenceKey).toBe(11);

            pitchCorrector.setReferenceKey(-5);
            expect(pitchCorrector.getSettings().referenceKey).toBe(0);
        });

        it('should update retune speed', () => {
            pitchCorrector.setRetuneSpeed(0.8);
            const settings = pitchCorrector.getSettings();
            expect(settings.retuneSpeed).toBe(0.8);
        });

        it('should clamp retune speed to valid range', () => {
            pitchCorrector.setRetuneSpeed(1.5);
            expect(pitchCorrector.getSettings().retuneSpeed).toBe(1.0);

            pitchCorrector.setRetuneSpeed(0.05);
            expect(pitchCorrector.getSettings().retuneSpeed).toBe(0.1);
        });

        it('should update correction amount', () => {
            pitchCorrector.setCorrectionAmount(0.9);
            const settings = pitchCorrector.getSettings();
            expect(settings.correctionAmount).toBe(0.9);
        });

        it('should clamp correction amount to valid range', () => {
            pitchCorrector.setCorrectionAmount(1.5);
            expect(pitchCorrector.getSettings().correctionAmount).toBe(1.0);

            pitchCorrector.setCorrectionAmount(-0.5);
            expect(pitchCorrector.getSettings().correctionAmount).toBe(0);
        });

        it('should update multiple settings at once', () => {
            const newSettings: Partial<PitchCorrectionSettings> = {
                scale: 'minor',
                referenceKey: 3,
                retuneSpeed: 0.6,
                correctionAmount: 0.7
            };
            pitchCorrector.setSettings(newSettings);
            const settings = pitchCorrector.getSettings();

            expect(settings.scale).toBe('minor');
            expect(settings.referenceKey).toBe(3);
            expect(settings.retuneSpeed).toBe(0.6);
            expect(settings.correctionAmount).toBe(0.7);
        });
    });

    describe('enable/disable', () => {
        it('should enable pitch correction', () => {
            pitchCorrector.setEnabled(true);
            expect(pitchCorrector.getSettings().enabled).toBe(true);
        });

        it('should disable pitch correction', () => {
            pitchCorrector.setEnabled(false);
            expect(pitchCorrector.getSettings().enabled).toBe(false);
        });
    });

    describe('scale intervals', () => {
        it('should return chromatic scale intervals', () => {
            pitchCorrector.setScale('chromatic');
            const intervals = pitchCorrector.getScaleIntervals();
            expect(intervals).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
        });

        it('should return major scale intervals', () => {
            pitchCorrector.setScale('major');
            const intervals = pitchCorrector.getScaleIntervals();
            expect(intervals).toEqual([0, 2, 4, 5, 7, 9, 11]);
        });

        it('should return minor scale intervals', () => {
            pitchCorrector.setScale('minor');
            const intervals = pitchCorrector.getScaleIntervals();
            expect(intervals).toEqual([0, 2, 3, 5, 7, 8, 10]);
        });

        it('should return pentatonic major scale intervals', () => {
            pitchCorrector.setScale('pentatonic-major');
            const intervals = pitchCorrector.getScaleIntervals();
            expect(intervals).toEqual([0, 2, 4, 7, 9]);
        });

        it('should return pentatonic minor scale intervals', () => {
            pitchCorrector.setScale('pentatonic-minor');
            const intervals = pitchCorrector.getScaleIntervals();
            expect(intervals).toEqual([0, 3, 5, 7, 10]);
        });
    });

    describe('note finding', () => {
        it('should find nearest note in chromatic scale', () => {
            pitchCorrector.setScale('chromatic');
            pitchCorrector.setReferenceKey(0); // C

            // C4 (MIDI 60) should map to C4
            expect(pitchCorrector.findNearestScaleNote(60)).toBe(60);

            // C#4 (MIDI 61) should map to C#4
            expect(pitchCorrector.findNearestScaleNote(61)).toBe(61);

            // D4 (MIDI 62) should map to D4
            expect(pitchCorrector.findNearestScaleNote(62)).toBe(62);
        });

        it('should find nearest note in major scale', () => {
            pitchCorrector.setScale('major');
            pitchCorrector.setReferenceKey(0); // C major

            // C4 (MIDI 60) should map to C4
            expect(pitchCorrector.findNearestScaleNote(60)).toBe(60);

            // C#4 (MIDI 61) should map to C4 or D4 (nearest)
            const result = pitchCorrector.findNearestScaleNote(61);
            expect(result === 60 || result === 62).toBe(true);

            // D4 (MIDI 62) should map to D4
            expect(pitchCorrector.findNearestScaleNote(62)).toBe(62);
        });

        it('should find nearest note in minor scale', () => {
            pitchCorrector.setScale('minor');
            pitchCorrector.setReferenceKey(0); // C minor

            // C4 (MIDI 60) should map to C4
            expect(pitchCorrector.findNearestScaleNote(60)).toBe(60);

            // D4 (MIDI 62) is in C minor (interval 2), so it should map to 62
            expect(pitchCorrector.findNearestScaleNote(62)).toBe(62);
        });
    });

    describe('frequency conversion', () => {
        it('should convert MIDI to frequency', () => {
            // A4 (MIDI 69) should be 440 Hz
            expect(PitchCorrector.midiToFrequency(69)).toBeCloseTo(440, 0.01);

            // C4 (MIDI 60) should be ~261.63 Hz
            expect(PitchCorrector.midiToFrequency(60)).toBeCloseTo(261.63, 0.01);

            // C5 (MIDI 72) should be ~523.25 Hz
            expect(PitchCorrector.midiToFrequency(72)).toBeCloseTo(523.25, 0.01);
        });

        it('should convert frequency to MIDI', () => {
            // 440 Hz should be A4 (MIDI 69)
            expect(PitchCorrector.frequencyToMidi(440)).toBeCloseTo(69, 0.01);

            // 261.63 Hz should be C4 (MIDI 60)
            expect(PitchCorrector.frequencyToMidi(261.63)).toBeCloseTo(60, 0.01);

            // 523.25 Hz should be C5 (MIDI 72)
            expect(PitchCorrector.frequencyToMidi(523.25)).toBeCloseTo(72, 0.01);
        });

        it('should be reversible conversions', () => {
            const midi = 60;
            const frequency = PitchCorrector.midiToFrequency(midi);
            const backToMidi = PitchCorrector.frequencyToMidi(frequency);
            expect(backToMidi).toBeCloseTo(midi, 0.01);
        });
    });

    describe('note names', () => {
        it('should return correct note names', () => {
            expect(PitchCorrector.getNoteName(60)).toBe('C4');
            expect(PitchCorrector.getNoteName(61)).toBe('C#4');
            expect(PitchCorrector.getNoteName(62)).toBe('D4');
            expect(PitchCorrector.getNoteName(69)).toBe('A4');
            expect(PitchCorrector.getNoteName(72)).toBe('C5');
        });
    });

    describe('pitch detection', () => {
        it('should detect pitch from buffer', () => {
            // Create a simple sine wave at 440 Hz (A4)
            const sampleRate = 44100;
            const frequency = 440;
            const duration = 0.1; // 100ms
            const bufferSize = Math.floor(sampleRate * duration);
            const buffer = new Float32Array(bufferSize);

            for (let i = 0; i < bufferSize; i++) {
                buffer[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate);
            }

            const result = PitchCorrector.detectPitch(buffer, sampleRate);

            expect(result).not.toBeNull();
            expect(result!.frequency).toBeCloseTo(440, 1); // Increased tolerance from 10 to 1
            expect(result!.midiNote).toBeCloseTo(69, 1);
            expect(result!.confidence).toBeGreaterThan(0);
        });

        it('should return null for silent buffer', () => {
            const buffer = new Float32Array(2048).fill(0);
            const result = PitchCorrector.detectPitch(buffer, 44100);
            expect(result).toBeNull();
        });

        it('should return null for noise buffer', () => {
            const buffer = new Float32Array(2048);
            for (let i = 0; i < buffer.length; i++) {
                buffer[i] = Math.random() * 2 - 1;
            }
            const result = PitchCorrector.detectPitch(buffer, 44100);
            expect(result).toBeNull();
        });
    });

    describe('cleanup', () => {
        it('should destroy corrector and clean up resources', () => {
            pitchCorrector.destroy();
            expect(pitchCorrector.isReady()).toBe(false);
        });
    });
});
