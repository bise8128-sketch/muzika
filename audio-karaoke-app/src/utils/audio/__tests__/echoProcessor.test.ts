/**
 * Tests for EchoProcessor
 */

import { EchoProcessor } from '../echoProcessor';
import { EchoSettings } from '../../../types/audio';

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

    createDelay(maxDelayTime?: number) {
        return {
            delayTime: { value: 0 },
            connect: jest.fn(),
            disconnect: jest.fn()
        };
    }

    createChannelSplitter(numberOfOutputs: number) {
        return {
            connect: jest.fn(),
            disconnect: jest.fn()
        };
    }

    createChannelMerger(numberOfInputs: number) {
        return {
            connect: jest.fn(),
            disconnect: jest.fn()
        };
    }
}

describe('EchoProcessor', () => {
    let mockAudioContext: MockAudioContext;
    let echoProcessor: EchoProcessor;

    beforeEach(() => {
        mockAudioContext = new MockAudioContext();
        echoProcessor = new EchoProcessor(mockAudioContext as any);
    });

    afterEach(() => {
        echoProcessor.destroy();
    });

    describe('initialization', () => {
        it('should initialize with default settings', () => {
            const settings = echoProcessor.getSettings();
            expect(settings.enabled).toBe(false);
            expect(settings.delayTime).toBe(300);
            expect(settings.feedback).toBe(0.3);
            expect(settings.wetLevel).toBe(0.3);
            expect(settings.dryLevel).toBe(0.7);
            expect(settings.stereoDelay).toBe(false);
        });

        it('should initialize with custom settings', () => {
            const customSettings: Partial<EchoSettings> = {
                enabled: true,
                delayTime: 500,
                feedback: 0.5,
                wetLevel: 0.6,
                dryLevel: 0.4,
                stereoDelay: true
            };
            const processor = new EchoProcessor(mockAudioContext as any, customSettings);
            const settings = processor.getSettings();

            expect(settings.enabled).toBe(true);
            expect(settings.delayTime).toBe(500);
            expect(settings.feedback).toBe(0.5);
            expect(settings.wetLevel).toBe(0.6);
            expect(settings.dryLevel).toBe(0.4);
            expect(settings.stereoDelay).toBe(true);

            processor.destroy();
        });

        it('should be ready after initialization', () => {
            expect(echoProcessor.isReady()).toBe(true);
        });

        it('should provide input and output nodes', () => {
            expect(echoProcessor.getInput()).toBeDefined();
            expect(echoProcessor.getOutput()).toBeDefined();
        });
    });

    describe('settings management', () => {
        it('should update delay time', () => {
            echoProcessor.setDelayTime(500);
            const settings = echoProcessor.getSettings();
            expect(settings.delayTime).toBe(500);
        });

        it('should clamp delay time to valid range', () => {
            echoProcessor.setDelayTime(1500);
            expect(echoProcessor.getSettings().delayTime).toBe(1000);

            echoProcessor.setDelayTime(25);
            expect(echoProcessor.getSettings().delayTime).toBe(50);
        });

        it('should update feedback', () => {
            echoProcessor.setFeedback(0.7);
            const settings = echoProcessor.getSettings();
            expect(settings.feedback).toBe(0.7);
        });

        it('should clamp feedback to valid range', () => {
            echoProcessor.setFeedback(1.0);
            expect(echoProcessor.getSettings().feedback).toBe(0.9);

            echoProcessor.setFeedback(-0.5);
            expect(echoProcessor.getSettings().feedback).toBe(0);
        });

        it('should update wet level', () => {
            echoProcessor.setWetLevel(0.7);
            const settings = echoProcessor.getSettings();
            expect(settings.wetLevel).toBe(0.7);
        });

        it('should clamp wet level to valid range', () => {
            echoProcessor.setWetLevel(1.5);
            expect(echoProcessor.getSettings().wetLevel).toBe(1.0);

            echoProcessor.setWetLevel(-0.5);
            expect(echoProcessor.getSettings().wetLevel).toBe(0);
        });

        it('should update dry level', () => {
            echoProcessor.setDryLevel(0.8);
            const settings = echoProcessor.getSettings();
            expect(settings.dryLevel).toBe(0.8);
        });

        it('should clamp dry level to valid range', () => {
            echoProcessor.setDryLevel(1.5);
            expect(echoProcessor.getSettings().dryLevel).toBe(1.0);

            echoProcessor.setDryLevel(-0.5);
            expect(echoProcessor.getSettings().dryLevel).toBe(0);
        });

        it('should update left delay time for stereo mode', () => {
            echoProcessor.setLeftDelay(400);
            const settings = echoProcessor.getSettings();
            expect(settings.leftDelay).toBe(400);
        });

        it('should clamp left delay time to valid range', () => {
            echoProcessor.setLeftDelay(1500);
            expect(echoProcessor.getSettings().leftDelay).toBe(1000);

            echoProcessor.setLeftDelay(25);
            expect(echoProcessor.getSettings().leftDelay).toBe(50);
        });

        it('should update right delay time for stereo mode', () => {
            echoProcessor.setRightDelay(600);
            const settings = echoProcessor.getSettings();
            expect(settings.rightDelay).toBe(600);
        });

        it('should clamp right delay time to valid range', () => {
            echoProcessor.setRightDelay(1500);
            expect(echoProcessor.getSettings().rightDelay).toBe(1000);

            echoProcessor.setRightDelay(25);
            expect(echoProcessor.getSettings().rightDelay).toBe(50);
        });

        it('should update multiple settings at once', () => {
            const newSettings: Partial<EchoSettings> = {
                delayTime: 400,
                feedback: 0.6,
                wetLevel: 0.5,
                dryLevel: 0.5
            };
            echoProcessor.setSettings(newSettings);
            const settings = echoProcessor.getSettings();

            expect(settings.delayTime).toBe(400);
            expect(settings.feedback).toBe(0.6);
            expect(settings.wetLevel).toBe(0.5);
            expect(settings.dryLevel).toBe(0.5);
        });
    });

    describe('enable/disable', () => {
        it('should enable echo effect', () => {
            echoProcessor.setEnabled(true);
            expect(echoProcessor.getSettings().enabled).toBe(true);
        });

        it('should disable echo effect', () => {
            echoProcessor.setEnabled(false);
            expect(echoProcessor.getSettings().enabled).toBe(false);
        });
    });

    describe('stereo delay mode', () => {
        it('should enable stereo delay mode', () => {
            echoProcessor.setStereoDelay(true);
            expect(echoProcessor.getSettings().stereoDelay).toBe(true);
        });

        it('should disable stereo delay mode', () => {
            echoProcessor.setStereoDelay(false);
            expect(echoProcessor.getSettings().stereoDelay).toBe(false);
        });

        it('should allow different left and right delay times in stereo mode', () => {
            echoProcessor.setStereoDelay(true);
            echoProcessor.setLeftDelay(300);
            echoProcessor.setRightDelay(450);

            const settings = echoProcessor.getSettings();
            expect(settings.leftDelay).toBe(300);
            expect(settings.rightDelay).toBe(450);
        });
    });

    describe('cleanup', () => {
        it('should destroy processor and disconnect nodes', () => {
            const inputNode = echoProcessor.getInput();
            const outputNode = echoProcessor.getOutput();

            echoProcessor.destroy();

            expect(echoProcessor.isReady()).toBe(false);
        });
    });
});
