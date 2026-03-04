import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { KaraokePlayer } from '../KaraokePlayer';

import { MockAudioContext } from '../../../__mocks__/audioContextMock';

// Mocks
jest.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
}));

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
    useParams: () => ({ id: 'test-id' }),
    useSearchParams: () => new URLSearchParams(),
}));

jest.mock('@/context/AudioProvider', () => ({
    useAudio: () => ({
        setPerformanceScore: jest.fn(),
        send: jest.fn()
    })
}));

jest.mock('@/hooks/usePlayback', () => ({
    usePlayback: () => ({
        isPlaying: false,
        duration: 200,
        currentTime: 0,
        play: jest.fn(),
        pause: jest.fn(),
        stop: jest.fn(),
        setVolume: jest.fn(),
        setEQ: jest.fn(),
        vocalsVolume: 1,
        instrumentalVolume: 1,
        bass: 0,
        mid: 0,
        treble: 0
    })
}));

jest.mock('@/hooks/useVoiceRecorder', () => ({
    useVoiceRecorder: () => ({
        startRecording: jest.fn(),
        stopRecording: jest.fn(),
        isRecording: false,
        recordedBuffer: null,
        clearRecording: jest.fn()
    })
}));

jest.mock('@/hooks/usePitchAnalysis', () => ({
    usePitchAnalysis: () => ({
        startAnalysis: jest.fn(),
        stopAnalysis: jest.fn(),
        resetAnalysis: jest.fn(),
        isListening: false,
        pitchHistory: [],
        currentScore: 0,
        currentPitch: 0,
        overallScore: 0
    })
}));

jest.mock('@/hooks/useKaraokeEngine', () => ({
    useKaraokeEngine: () => ({
        lyricState: { lineIndex: -1, wordIndex: -1 },
        handleCanvasReady: jest.fn()
    })
}));

jest.mock('@/hooks/useKaraokeEffects', () => ({
    useKaraokeEffects: () => ({
        pitch: 0,
        tempo: 1,
        reverb: 0,
        echo: 0,
        handlePitchChange: jest.fn(),
        handleTempoChange: jest.fn(),
        handleReverbChange: jest.fn(),
        handleEchoChange: jest.fn(),
        resetEffects: jest.fn()
    })
}));

jest.mock('@/hooks/useKaraokeExport', () => ({
    useKaraokeExport: () => ({
        isExportingVideo: false,
        isExportingAudio: false,
        exportProgress: 0,
        handleVideoExport: jest.fn(),
        handleAudioDownload: jest.fn()
    })
}));

jest.mock('@/hooks/useVisualizerOrchestrator', () => ({
    useVisualizerOrchestrator: () => ({
        setMode: jest.fn(),
        setPitchHistory: jest.fn(),
        setPitchTargets: jest.fn()
    })
}));

jest.mock('@/hooks/usePractice', () => ({
    usePractice: () => ({
        startPractice: jest.fn()
    })
}));

jest.mock('@/hooks/useKaraokeRoom', () => ({
    useKaraokeRoom: () => ({
        joinRoom: jest.fn(),
        leaveRoom: jest.fn()
    })
}));

jest.mock('@/hooks/useVoiceTransform', () => ({
    useVoiceTransform: () => ({
        currentPreset: 'clean',
        settings: {},
        isMonitoring: false,
        setPreset: jest.fn(),
        updateSettings: jest.fn(),
        toggleMonitoring: jest.fn(),
        isInitialized: true,
        initProcessor: jest.fn(),
        getProcessedStream: jest.fn()
    })
}));

jest.mock('@/hooks/useKaraokeUI', () => ({
    useKaraokeUI: () => ({
        state: { isStageMode: false, showEditor: false, visualSettings: { visualizationMode: 'default' } },
        actions: { setIsStageMode: jest.fn(), setShowEditor: jest.fn() }
    })
}));

jest.mock('@/hooks/useAutoKey', () => ({
    useAutoKey: () => ({
        isAnalyzing: false,
        detectedKey: null,
        vocalRange: { min: 'C3', max: 'C5' },
        suggestedShift: 0,
        currentShift: 0,
        analyzeTrack: jest.fn(),
        applyShift: jest.fn(),
        updateVocalRange: jest.fn()
    })
}));

jest.mock('@/hooks/useHarmonyGuide', () => ({
    useHarmonyGuide: () => ({
        activeKeyInfo: null
    })
}));

jest.mock('@/hooks/useMixRecorder', () => ({
    useMixRecorder: () => ({
        isRecordingMix: false,
        recordedMixBlob: null,
        getMixDestination: jest.fn(() => ({ connect: jest.fn(), disconnect: jest.fn() })),
        startRecordingMix: jest.fn(),
        stopRecordingMix: jest.fn(),
        clearMixRecording: jest.fn()
    })
}));

jest.mock('../Controls/KaraokeControls', () => ({
    KaraokeControls: () => <div data-testid="karaoke-controls">Controls</div>
}));

jest.mock('../Visualizer/KaraokeDisplay', () => ({
    KaraokeDisplay: ({ children }: { children: React.ReactNode }) => <div data-testid="visualizer-container">{children}</div>
}));

jest.mock('../KaraokeOverlay', () => ({
    KaraokeOverlay: () => <div data-testid="karaoke-overlay">Overlay</div>
}));

jest.mock('@/utils/audio/playbackController', () => {
    const { MockAudioContext } = require('../../../__mocks__/audioContextMock');
    return {
        PlaybackController: jest.fn().mockImplementation(() => ({
            setVoiceBuffer: jest.fn(),
            setVolume: jest.fn(),
            setEQ: jest.fn(),
            play: jest.fn(),
            pause: jest.fn(),
            stop: jest.fn(),
            seek: jest.fn(),
            on: jest.fn(),
            off: jest.fn(),
            getAudioBuffers: jest.fn().mockReturnValue([]),
            context: new MockAudioContext(),
            vocalsVolume: 1,
            instrumentalVolume: 1,
            bass: 0,
            mid: 0,
            treble: 0
        }))
    };
});

jest.mock('../EffectsPanel', () => ({
    EffectsPanel: () => <div data-testid="effects-panel">Effects</div>
}));

jest.mock('../StemIsolationPanel', () => ({
    StemIsolationPanel: () => <div data-testid="stem-isolation">Stems</div>
}));

jest.mock('../PitchVisualizer', () => ({
    PitchVisualizer: () => <div data-testid="pitch-visualizer">PitchVis</div>
}));

jest.mock('../PlayerHeader', () => ({
    PlayerHeader: () => <div data-testid="player-header">Header</div>
}));

jest.mock('../EffectsController', () => ({
    EffectsController: () => <div data-testid="effects-controller">EffectsController</div>
}));

jest.mock('../../UI/ErrorBoundary', () => ({
    ErrorBoundary: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

// Setup Controller Mock
import { PlaybackController } from '@/utils/audio/playbackController';
const mockController = new PlaybackController();

describe('KaraokePlayer', () => {
    it('renders without crashing', async () => {
        await act(async () => {
            render(<KaraokePlayer controller={mockController} />);
        });
        expect(screen.getByTestId('visualizer-container')).toBeInTheDocument();
    });

    it('shows the effects controller', async () => {
        await act(async () => {
            render(<KaraokePlayer controller={mockController} />);
        });
        expect(screen.getByTestId('effects-controller')).toBeInTheDocument();
    });
});
