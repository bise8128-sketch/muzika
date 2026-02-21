import type { Meta, StoryObj } from '@storybook/react';
import { LyricsContainer } from './LyricsContainer';
import { LRCData, VisualSettings } from '@/types/karaoke';
import { PlaybackController } from '@/utils/audio/playback/PlaybackCore';
import { AudioVisualizer } from '@/utils/audio/audioVisualizer';

const mockLRC: LRCData = {
    lines: [
        { startTime: 0, endTime: 5, text: "Welcome to Muzika Karaoke", translation: "Dobrodošli u Muzika Karaoke" },
        { 
            startTime: 5, 
            endTime: 10, 
            text: "Unleash your inner rockstar", 
            translation: "Oslobodite svoju unutrašnju rok zvezdu",
            words: [
                { startTime: 5, endTime: 6, text: "Unleash" },
                { startTime: 6, endTime: 7, text: "your" },
                { startTime: 7, endTime: 8, text: "inner" },
                { startTime: 8, endTime: 10, text: "rockstar" }
            ]
        },
        { startTime: 10, endTime: 15, text: "The stage is yours tonight", translation: "Bina je tvoja večeras" }
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
    showDualText: true,
    visualizationMode: 'bars',
    autoQuality: false,
    ghostMode: false
};

// Mock Controller
const mockController = {
    getAudioBuffers: () => [null, null],
    on: () => {},
    off: () => {},
    getCurrentTime: () => 7,
    getDuration: () => 180,
    play: () => console.log('Playing'),
    pause: () => console.log('Paused'),
    stop: () => console.log('Stopped'),
    setCurrentTime: (t: number) => console.log('Seeking to:', t)
} as unknown as PlaybackController;

// Mock Visualizer
const mockVisualizer = {
    getFrequencyData: () => new Uint8Array(64).fill(128),
    domainData: new Float32Array(1024).fill(0)
} as unknown as AudioVisualizer;

const meta: Meta<typeof LyricsContainer> = {
    title: 'Karaoke/Visualizer/LyricsContainer',
    component: LyricsContainer,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        backgrounds: {
            default: 'dark',
        },
    },
    args: {
        lyrics: mockLRC,
        cdgData: null,
        showEditor: false,
        isStageMode: false,
        theme: 'modern',
        stageTheme: 'neon-tokyo',
        visualSettings: defaultVisualSettings,
        currentLineIndex: 1,
        currentWordIndex: 2, // "inner"
        visualizer: mockVisualizer,
        controller: mockController,
        pitchHistory: [],
        onCanvasReady: () => {},
        onToggleEditor: () => {},
        onSaveLRC: () => {},
        onLRCUpload: () => {}
    },
    decorators: [
        (Story) => (
            <div className="h-screen w-full bg-black flex flex-col items-center justify-center p-8 overflow-hidden">
                <Story />
            </div>
        ),
    ],
};

export default meta;
type Story = StoryObj<typeof LyricsContainer>;

export const Default: Story = {};

export const StageMode: Story = {
    args: {
        isStageMode: true,
        stageTheme: 'neon-tokyo',
        currentLineIndex: 1,
        currentWordIndex: 2
    }
};

export const GhostMode: Story = {
    args: {
        visualSettings: {
            ...defaultVisualSettings,
            ghostMode: true
        }
    }
};

export const WithCDG: Story = {
    args: {
        cdgData: new Uint8Array([0, 1, 2, 3]), // Mock CDG bytes
        lyrics: null
    }
};

export const EditorOpen: Story = {
    args: {
        showEditor: true
    }
};

export const EmptyState: Story = {
    args: {
        lyrics: null,
        cdgData: null,
        showEditor: false
    }
};
