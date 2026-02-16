import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { KaraokePlayer } from '../KaraokePlayer';
import { PlaybackController } from '@/utils/audio/playbackController';
import { MockAudioContext } from '../../../../__mocks__/audioContextMock';

// Mocks
jest.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
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
        // visualizer mock
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

jest.mock('../Controls/KaraokeControls', () => ({
    KaraokeControls: () => <div data-testid="karaoke-controls">Controls</div>
}));

jest.mock('../Visualizer/VisualizerContainer', () => ({
    VisualizerContainer: () => <div data-testid="visualizer-container">Visualizer</div>
}));

jest.mock('@/utils/audio/playbackController', () => {
    return {
        PlaybackController: jest.fn().mockImplementation(() => ({
            setVoiceBuffer: jest.fn(),
            setVolume: jest.fn(),
            setEQ: jest.fn(),
            play: jest.fn(),
            pause: jest.fn(),
            stop: jest.fn(),
            seek: jest.fn(),
            context: new MockAudioContext(),
            vocalsVolume: 1,
            instrumentalVolume: 1,
            bass: 0,
            mid: 0,
            treble: 0
        }))
    };
});

// Setup Controller Mock
const mockController = new (require('@/utils/audio/playbackController').PlaybackController)();

describe('KaraokePlayer', () => {
    it('renders without crashing', () => {
        render(<KaraokePlayer controller={mockController} />);
        expect(screen.getByTestId('visualizer-container')).toBeInTheDocument();
    });

    it('shows pitch analysis button', () => {
        render(<KaraokePlayer controller={mockController} />);
        expect(screen.getByText('pitchAnalysis')).toBeInTheDocument();
    });
});
