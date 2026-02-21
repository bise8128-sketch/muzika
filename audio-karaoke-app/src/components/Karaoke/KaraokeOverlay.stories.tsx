import type { Meta, StoryObj } from '@storybook/react';
import { KaraokeOverlay } from './KaraokeOverlay';
import { LRCData, VisualSettings } from '@/types/karaoke';
import { PlaybackController } from '@/utils/audio/playback/PlaybackCore';
import { AudioVisualizer } from '@/utils/audio/audioVisualizer';
import { KaraokeUIState, KaraokeUIActions } from '@/hooks/useKaraokeUI';

const mockLRC: LRCData = {
    lines: [
        { startTime: 0, endTime: 5, text: "Welcome to Muzika Karaoke" },
        { startTime: 5, endTime: 10, text: "Unleash your inner rockstar" },
        { startTime: 10, endTime: 15, text: "The stage is yours tonight" }
    ],
    metadata: {
        title: "Starlight Symphony",
        artist: "The Antigravities"
    }
};

const defaultVisualSettings: VisualSettings = {
    highlightColor: 'text-yellow-400',
    fontSize: 'base',
    fontWeight: 'bold',
    textShadow: true,
    offset: 0,
    showDualText: false,
    visualizationMode: 'bars',
    autoQuality: false
};

const mockUIState: KaraokeUIState = {
    showEditor: false,
    theme: 'modern',
    stageTheme: 'neon-tokyo',
    isStageMode: false,
    showSettings: false,
    showPractice: false,
    showRoom: false,
    showVoiceFx: false,
    showAutoKey: false,
    showLyricSync: false,
    isVisualSettingsOpen: false,
    visualSettings: defaultVisualSettings
};

const mockUIActions: KaraokeUIActions = {
    setShowEditor: () => {},
    setTheme: () => {},
    setStageTheme: () => {},
    setIsStageMode: () => {},
    setShowSettings: () => {},
    setShowPractice: () => {},
    setShowRoom: () => {},
    setShowVoiceFx: () => {},
    setShowAutoKey: () => {},
    setShowLyricSync: () => {},
    setIsVisualSettingsOpen: () => {},
    setVisualSettings: () => {},
    toggleStageMode: () => {},
    togglePractice: () => {},
    toggleRoom: () => {},
    toggleVoiceFx: () => {},
    toggleAutoKey: () => {},
    toggleLyricSync: () => {},
    toggleSettings: () => {},
    toggleVisualSettings: () => {},
    toggleEditor: () => {},
    updateTheme: () => {},
    updateVisualSettings: () => {}
};

// Mock Machine State
const createMachineState = (value: string) => ({
    value,
    matches: (val: string) => val === value,
    context: { songId: 'test', error: null, progress: 0 },
    can: () => true,
    hasTag: () => false,
    status: 'active' as any
} as any);

const meta: Meta<typeof KaraokeOverlay> = {
    title: 'Karaoke/KaraokeOverlay',
    component: KaraokeOverlay,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        backgrounds: {
            default: 'dark',
        },
    },
    args: {
        uiState: mockUIState,
        uiActions: mockUIActions,
        lyrics: mockLRC,
        cdgData: null,
        controller: {} as any,
        visualizer: {} as any,
        currentLineIndex: 1,
        currentWordIndex: 0,
        pitchHistory: [],
        recorder: { isRecording: false },
        voiceFxProps: { currentPreset: 'studio' },
        practiceProps: {},
        roomProps: {},
        autoKeyProps: {},
        lyricSyncProps: {},
        onCanvasReady: () => {},
        onLRCUpload: () => {},
        onSaveLRC: () => {},
        isRecordingMix: false,
        recordedMixBlob: null,
        onStartRecordingMix: () => {},
        onStopRecordingMix: () => {},
        onClearMixRecording: () => {},
        machineState: createMachineState('ready')
    },
    decorators: [
        (Story) => (
            <div className="h-screen w-full bg-slate-900 group">
                <Story />
            </div>
        ),
    ],
};

export default meta;
type Story = StoryObj<typeof KaraokeOverlay>;

export const Ready: Story = {};

export const Loading: Story = {
    args: {
        machineState: createMachineState('loading')
    }
};

export const Playing: Story = {
    args: {
        machineState: createMachineState('playing')
    }
};

export const Recording: Story = {
    args: {
        isRecordingMix: true,
        machineState: createMachineState('playing')
    }
};

export const StageMode: Story = {
    args: {
        uiState: {
            ...mockUIState,
            isStageMode: true
        }
    }
};
