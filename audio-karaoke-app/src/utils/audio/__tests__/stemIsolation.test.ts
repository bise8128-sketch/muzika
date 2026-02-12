/**
 * Tests for Stem Isolation (PlaybackController stem methods)
 */

import { StemSettings, StemPreset, StemType } from '../../../types/audio';

// ── Mocks ──────────────────────────────────────────────────────────

class MockAudioContext {
    sampleRate = 44100;
    currentTime = 0;
    state = 'running';
    audioWorklet = {
        addModule: jest.fn().mockResolvedValue(undefined),
    };
    resume = jest.fn().mockResolvedValue(undefined);

    createGain() {
        return {
            gain: {
                value: 1,
                setValueAtTime: jest.fn(),
            },
            connect: jest.fn(),
            disconnect: jest.fn(),
        };
    }

    createBufferSource() {
        return {
            buffer: null,
            connect: jest.fn(),
            disconnect: jest.fn(),
            start: jest.fn(),
            stop: jest.fn(),
            onended: null,
        };
    }
}

// Mock the audioContext module
jest.mock('../audioContext', () => ({
    getAudioContext: () => new MockAudioContext(),
}));

// Mock EffectsChain
jest.mock('../playback/EffectsChain', () => ({
    EffectsChain: jest.fn().mockImplementation(() => ({
        getDestination: jest.fn().mockReturnValue({ connect: jest.fn() }),
        connectSourceToEffects: jest.fn(),
        initializeAudioWorklet: jest.fn().mockResolvedValue(undefined),
        resetProcessor: jest.fn(),
        dispose: jest.fn(),
        setPitch: jest.fn(),
        setTempo: jest.fn(),
        getTempo: jest.fn().mockReturnValue(1),
        getPitch: jest.fn().mockReturnValue(0),
        setReverbLevel: jest.fn(),
        setEchoLevel: jest.fn(),
        setMasterGain: jest.fn(),
        setBassGain: jest.fn(),
        setMidGain: jest.fn(),
        setTrebleGain: jest.fn(),
        setEQ: jest.fn(),
        setReverbSettings: jest.fn(),
        getReverbSettings: jest.fn().mockReturnValue({}),
        setReverbEnabled: jest.fn(),
        applyReverbPreset: jest.fn(),
        setEchoSettings: jest.fn(),
        getEchoSettings: jest.fn().mockReturnValue({}),
        setEchoEnabled: jest.fn(),
        setStereoDelayEnabled: jest.fn(),
        getEchoProcessor: jest.fn().mockReturnValue({}),
        getReverbProcessor: jest.fn().mockReturnValue({}),
        getPitchCorrector: jest.fn().mockReturnValue({}),
        setPitchCorrectionSettings: jest.fn().mockResolvedValue(undefined),
        getPitchCorrectionSettings: jest.fn().mockReturnValue({}),
        setPitchCorrectionEnabled: jest.fn().mockResolvedValue(undefined),
        setPitchCorrectionScale: jest.fn().mockResolvedValue(undefined),
        setPitchCorrectionReferenceKey: jest.fn().mockResolvedValue(undefined),
        setPitchCorrectionRetuneSpeed: jest.fn().mockResolvedValue(undefined),
        setPitchCorrectionAmount: jest.fn().mockResolvedValue(undefined),
        processor: { process: jest.fn() },
    })),
}));

// Mock EventManager
jest.mock('../playback/EventManager', () => ({
    EventManager: jest.fn().mockImplementation(() => ({
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
        setTimeSource: jest.fn(),
        startTimeUpdateLoop: jest.fn(),
        stopTimeUpdateLoop: jest.fn(),
        dispose: jest.fn(),
    })),
}));

import { PlaybackController } from '../playback/PlaybackCore';

// Helper: create a mocked AudioBuffer
function createMockBuffer(duration = 1.0, sampleRate = 44100, channels = 2): AudioBuffer {
    const length = Math.floor(sampleRate * duration);
    return {
        duration,
        length,
        sampleRate,
        numberOfChannels: channels,
        getChannelData: jest.fn().mockReturnValue(new Float32Array(length)),
    } as unknown as AudioBuffer;
}

// ── Tests ──────────────────────────────────────────────────────────

describe('PlaybackController — Stem Isolation', () => {
    let ctrl: PlaybackController;

    beforeEach(() => {
        ctrl = new PlaybackController();
        // Set up 2 mock buffers (vocals + instrumental)
        ctrl.setAudioBuffers([createMockBuffer(), createMockBuffer()]);
        ctrl.initStemStates(['vocals', 'instrumental']);
    });

    afterEach(() => {
        ctrl.dispose();
    });

    describe('initStemStates', () => {
        it('should initialise with correct labels and defaults', () => {
            const states = ctrl.getStemStates();
            expect(states).toHaveLength(2);
            expect(states[0].type).toBe('vocals');
            expect(states[0].label).toBe('Vocals');
            expect(states[0].volume).toBe(1.0);
            expect(states[0].muted).toBe(false);
            expect(states[0].solo).toBe(false);
            expect(states[1].type).toBe('instrumental');
        });

        it('should lazy-initialise if getStemStates called before explicit init', () => {
            const ctrl2 = new PlaybackController();
            ctrl2.setAudioBuffers([createMockBuffer(), createMockBuffer()]);
            const states = ctrl2.getStemStates();
            expect(states.length).toBe(2);
            ctrl2.dispose();
        });
    });

    describe('setStemVolume', () => {
        it('should set volume for a specific stem', () => {
            ctrl.setStemVolume(0, 0.5);
            const states = ctrl.getStemStates();
            expect(states[0].volume).toBe(0.5);
        });

        it('should clamp volume to 0-1 range', () => {
            ctrl.setStemVolume(0, 1.5);
            expect(ctrl.getStemStates()[0].volume).toBe(1);
            ctrl.setStemVolume(0, -0.5);
            expect(ctrl.getStemStates()[0].volume).toBe(0);
        });

        it('should be a no-op for invalid index', () => {
            ctrl.setStemVolume(99, 0.5);
            ctrl.setStemVolume(-1, 0.5);
            // Should not throw
        });
    });

    describe('toggleStemMute', () => {
        it('should mute and unmute a stem', () => {
            ctrl.toggleStemMute(0);
            expect(ctrl.getStemStates()[0].muted).toBe(true);

            ctrl.toggleStemMute(0);
            expect(ctrl.getStemStates()[0].muted).toBe(false);
        });

        it('should restore original volume on unmute', () => {
            ctrl.setStemVolume(0, 0.7);
            ctrl.toggleStemMute(0); // mute
            ctrl.toggleStemMute(0); // unmute
            expect(ctrl.getStemStates()[0].volume).toBe(0.7);
        });
    });

    describe('toggleStemSolo', () => {
        it('should solo a stem, effectively muting others', () => {
            ctrl.toggleStemSolo(0); // solo vocals
            const states = ctrl.getStemStates();
            expect(states[0].solo).toBe(true);
            expect(states[1].solo).toBe(false);
        });

        it('should un-solo a stem on second toggle', () => {
            ctrl.toggleStemSolo(0);
            ctrl.toggleStemSolo(0);
            expect(ctrl.getStemStates()[0].solo).toBe(false);
        });

        it('should allow multiple solos', () => {
            ctrl.setAudioBuffers([createMockBuffer(), createMockBuffer(), createMockBuffer()]);
            ctrl.initStemStates(['vocals', 'drums', 'bass']);
            ctrl.toggleStemSolo(0);
            ctrl.toggleStemSolo(1);
            const states = ctrl.getStemStates();
            expect(states[0].solo).toBe(true);
            expect(states[1].solo).toBe(true);
            expect(states[2].solo).toBe(false);
        });
    });

    describe('resetStems', () => {
        it('should reset all stems to defaults', () => {
            ctrl.setStemVolume(0, 0.3);
            ctrl.toggleStemMute(1);
            ctrl.toggleStemSolo(0);

            ctrl.resetStems();

            const states = ctrl.getStemStates();
            states.forEach(s => {
                expect(s.volume).toBe(1.0);
                expect(s.muted).toBe(false);
                expect(s.solo).toBe(false);
            });
        });
    });

    describe('applyStemPreset', () => {
        it('karaoke preset should mute vocals', () => {
            ctrl.applyStemPreset('karaoke');
            const states = ctrl.getStemStates();
            const vocals = states.find(s => s.type === 'vocals');
            expect(vocals?.muted).toBe(true);
        });

        it('a-capella preset should solo vocals', () => {
            ctrl.applyStemPreset('a-capella');
            const states = ctrl.getStemStates();
            const vocals = states.find(s => s.type === 'vocals');
            expect(vocals?.solo).toBe(true);
        });

        it('full-mix preset should reset all', () => {
            ctrl.toggleStemMute(0);
            ctrl.applyStemPreset('full-mix');
            const states = ctrl.getStemStates();
            states.forEach(s => {
                expect(s.muted).toBe(false);
                expect(s.solo).toBe(false);
                expect(s.volume).toBe(1.0);
            });
        });

        it('drums-only preset should solo drums if available', () => {
            ctrl.setAudioBuffers([createMockBuffer(), createMockBuffer(), createMockBuffer()]);
            ctrl.initStemStates(['vocals', 'drums', 'bass']);
            ctrl.applyStemPreset('drums-only');
            const states = ctrl.getStemStates();
            expect(states.find(s => s.type === 'drums')?.solo).toBe(true);
        });

        it('bass-only preset should solo bass if available', () => {
            ctrl.setAudioBuffers([createMockBuffer(), createMockBuffer(), createMockBuffer()]);
            ctrl.initStemStates(['vocals', 'drums', 'bass']);
            ctrl.applyStemPreset('bass-only');
            const states = ctrl.getStemStates();
            expect(states.find(s => s.type === 'bass')?.solo).toBe(true);
        });
    });
});
