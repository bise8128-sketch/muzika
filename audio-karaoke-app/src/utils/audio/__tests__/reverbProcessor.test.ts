/**
 * Tests for ReverbProcessor
 */

import { ReverbProcessor } from '../reverbProcessor';
import { ReverbSettings } from '../../../types/audio';

// Mock AudioContext
class MockAudioContext {
    sampleRate = 44100;

    createGain() {
        return {
            gain: { value: 0 },
            connect: jest.fn(),
            disconnect: jest.fn()
        };
    }

    createConvolver() {
        return {
            buffer: null,
            connect: jest.fn(),
            disconnect: jest.fn()
        };
    }

    createDelay(maxDelayTime?: number) {
        return {
            delayTime: { value: 0 },
            connect: jest.fn(),
            disconnect: jest.fn()
        };
    }

    createBuffer(numberOfChannels: number, length: number, sampleRate: number) {
        const buffer = {
            numberOfChannels,
            length,
            sampleRate,
            duration: length / sampleRate,
            getChannelData: jest.fn((channel: number) => new Float32Array(length).fill(0))
        };
        return buffer;
    }
}

describe('ReverbProcessor', () => {
    let mockAudioContext: MockAudioContext;
    let reverbProcessor: ReverbProcessor;

    beforeEach(() => {
        mockAudioContext = new MockAudioContext();
        reverbProcessor = new ReverbProcessor(mockAudioContext as any);
    });

    afterEach(() => {
        reverbProcessor.destroy();
    });

    describe('initialization', () => {
        it('should initialize with default settings', () => {
            const settings = reverbProcessor.getSettings();
            expect(settings.enabled).toBe(false);
            expect(settings.decay).toBe(2.0);
            expect(settings.roomSize).toBe('medium');
            expect(settings.preDelay).toBe(20);
            expect(settings.wetLevel).toBe(0.3);
            expect(settings.dryLevel).toBe(0.7);
        });

        it('should initialize with custom settings', () => {
            const customSettings: Partial<ReverbSettings> = {
                enabled: true,
                decay: 3.5,
                roomSize: 'hall',
                preDelay: 50,
                wetLevel: 0.5,
                dryLevel: 0.5
            };
            const processor = new ReverbProcessor(mockAudioContext as any, customSettings);
            const settings = processor.getSettings();

            expect(settings.enabled).toBe(true);
            expect(settings.decay).toBe(3.5);
            expect(settings.roomSize).toBe('hall');
            expect(settings.preDelay).toBe(50);
            expect(settings.wetLevel).toBe(0.5);
            expect(settings.dryLevel).toBe(0.5);

            processor.destroy();
        });

        it('should be ready after initialization', () => {
            expect(reverbProcessor.isReady()).toBe(true);
        });

        it('should provide input and output nodes', () => {
            expect(reverbProcessor.getInput()).toBeDefined();
            expect(reverbProcessor.getOutput()).toBeDefined();
        });
    });

    describe('settings management', () => {
        it('should update decay time', () => {
            reverbProcessor.setDecay(5.0);
            const settings = reverbProcessor.getSettings();
            expect(settings.decay).toBe(5.0);
        });

        it('should clamp decay time to valid range', () => {
            reverbProcessor.setDecay(15.0);
            expect(reverbProcessor.getSettings().decay).toBe(10.0);

            reverbProcessor.setDecay(0.05);
            expect(reverbProcessor.getSettings().decay).toBe(0.1);
        });

        it('should update room size', () => {
            reverbProcessor.setRoomSize('large');
            const settings = reverbProcessor.getSettings();
            expect(settings.roomSize).toBe('large');
        });

        it('should update pre-delay', () => {
            reverbProcessor.setPreDelay(100);
            const settings = reverbProcessor.getSettings();
            expect(settings.preDelay).toBe(100);
        });

        it('should clamp pre-delay to valid range', () => {
            reverbProcessor.setPreDelay(250);
            expect(reverbProcessor.getSettings().preDelay).toBe(200);

            reverbProcessor.setPreDelay(-10);
            expect(reverbProcessor.getSettings().preDelay).toBe(0);
        });

        it('should update wet level', () => {
            reverbProcessor.setWetLevel(0.7);
            const settings = reverbProcessor.getSettings();
            expect(settings.wetLevel).toBe(0.7);
        });

        it('should clamp wet level to valid range', () => {
            reverbProcessor.setWetLevel(1.5);
            expect(reverbProcessor.getSettings().wetLevel).toBe(1.0);

            reverbProcessor.setWetLevel(-0.5);
            expect(reverbProcessor.getSettings().wetLevel).toBe(0);
        });

        it('should update dry level', () => {
            reverbProcessor.setDryLevel(0.8);
            const settings = reverbProcessor.getSettings();
            expect(settings.dryLevel).toBe(0.8);
        });

        it('should clamp dry level to valid range', () => {
            reverbProcessor.setDryLevel(1.5);
            expect(reverbProcessor.getSettings().dryLevel).toBe(1.0);

            reverbProcessor.setDryLevel(-0.5);
            expect(reverbProcessor.getSettings().dryLevel).toBe(0);
        });

        it('should update multiple settings at once', () => {
            const newSettings: Partial<ReverbSettings> = {
                decay: 4.0,
                wetLevel: 0.6,
                dryLevel: 0.4
            };
            reverbProcessor.setSettings(newSettings);
            const settings = reverbProcessor.getSettings();

            expect(settings.decay).toBe(4.0);
            expect(settings.wetLevel).toBe(0.6);
            expect(settings.dryLevel).toBe(0.4);
        });
    });

    describe('enable/disable', () => {
        it('should enable reverb effect', () => {
            reverbProcessor.setEnabled(true);
            expect(reverbProcessor.getSettings().enabled).toBe(true);
        });

        it('should disable reverb effect', () => {
            reverbProcessor.setEnabled(false);
            expect(reverbProcessor.getSettings().enabled).toBe(false);
        });
    });

    describe('presets', () => {
        it('should apply hall preset', () => {
            reverbProcessor.applyPreset('hall');
            const settings = reverbProcessor.getSettings();

            expect(settings.preset).toBe('hall');
            expect(settings.decay).toBe(3.5);
            expect(settings.roomSize).toBe('hall');
            expect(settings.preDelay).toBe(40);
        });

        it('should apply room preset', () => {
            reverbProcessor.applyPreset('room');
            const settings = reverbProcessor.getSettings();

            expect(settings.preset).toBe('room');
            expect(settings.decay).toBe(1.2);
            expect(settings.roomSize).toBe('medium');
            expect(settings.preDelay).toBe(10);
        });

        it('should apply plate preset', () => {
            reverbProcessor.applyPreset('plate');
            const settings = reverbProcessor.getSettings();

            expect(settings.preset).toBe('plate');
            expect(settings.decay).toBe(2.0);
            expect(settings.roomSize).toBe('medium');
            expect(settings.preDelay).toBe(5);
        });

        it('should apply chamber preset', () => {
            reverbProcessor.applyPreset('chamber');
            const settings = reverbProcessor.getSettings();

            expect(settings.preset).toBe('chamber');
            expect(settings.decay).toBe(1.8);
            expect(settings.roomSize).toBe('large');
            expect(settings.preDelay).toBe(20);
        });

        it('should apply spring preset', () => {
            reverbProcessor.applyPreset('spring');
            const settings = reverbProcessor.getSettings();

            expect(settings.preset).toBe('spring');
            expect(settings.decay).toBe(0.8);
            expect(settings.roomSize).toBe('small');
            expect(settings.preDelay).toBe(0);
        });

        it('should return available presets', () => {
            const presets = ReverbProcessor.getPresets();
            expect(presets).toHaveLength(5);
            expect(presets.map(p => p.name)).toContain('Hall');
            expect(presets.map(p => p.name)).toContain('Room');
            expect(presets.map(p => p.name)).toContain('Plate');
            expect(presets.map(p => p.name)).toContain('Chamber');
            expect(presets.map(p => p.name)).toContain('Spring');
        });
    });

    describe('cleanup', () => {
        it('should destroy processor and disconnect nodes', () => {
            const inputNode = reverbProcessor.getInput();
            const outputNode = reverbProcessor.getOutput();

            reverbProcessor.destroy();

            expect(reverbProcessor.isReady()).toBe(false);
        });
    });
});
