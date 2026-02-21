import type { Meta, StoryObj } from '@storybook/react';
import { KaraokeToolbar } from './KaraokeToolbar';
import { LRCData, VisualSettings } from '@/types/karaoke';

const mockLyrics: LRCData = {
    lines: [
        { startTime: 0, endTime: 5, text: "Sample lyric line 1" },
        { startTime: 5, endTime: 10, text: "Sample lyric line 2" }
    ],
    metadata: {
        title: "Test Song",
        artist: "Test Artist"
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
    autoQuality: true
};

const meta: Meta<typeof KaraokeToolbar> = {
    title: 'Karaoke/Visualizer/KaraokeToolbar',
    component: KaraokeToolbar,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        backgrounds: {
            default: 'dark',
        },
    },
    args: {
        lyrics: mockLyrics,
        cdgData: null,
        showEditor: false,
        theme: 'modern',
        showPractice: false,
        showRoom: false,
        showVoiceFx: false,
        showAutoKey: false,
        showLyricSync: false,
        isVisualSettingsOpen: false,
        visualSettings: defaultVisualSettings,
        isRecordingMix: false,
        recordedMixBlob: null,
        showSeparation: false,
        onThemeChange: (t) => console.log('Theme changed:', t),
        onTogglePractice: () => console.log('Toggle Practice'),
        onToggleRoom: () => console.log('Toggle Room'),
        onToggleVoiceFx: () => console.log('Toggle Voice FX'),
        onToggleAutoKey: () => console.log('Toggle Auto Key'),
        onToggleLyricSync: () => console.log('Toggle Lyric Sync'),
        onToggleEditor: (s) => console.log('Toggle Editor:', s),
        onToggleStageMode: (e) => console.log('Toggle Stage Mode:', e),
        onVisualSettingsChange: (s) => console.log('Visual Settings Change:', s),
        onStartRecordingMix: () => console.log('Start Recording Mix'),
        onStopRecordingMix: () => console.log('Stop Recording Mix'),
        onClearMixRecording: () => console.log('Clear Mix Recording'),
        onToggleSeparation: () => console.log('Toggle Separation')
    },
    decorators: [
        (Story) => (
            <div className="relative h-[200px] w-full bg-gray-900 group">
                <Story />
                <div className="absolute inset-0 flex items-center justify-center text-white/20 select-none pointer-events-none">
                    Hover to reveal toolbar
                </div>
            </div>
        ),
    ],
};

export default meta;
type Story = StoryObj<typeof KaraokeToolbar>;

export const Default: Story = {};

export const ActiveStates: Story = {
    args: {
        showPractice: true,
        showVoiceFx: true,
        showSeparation: true
    }
};

export const Recording: Story = {
    args: {
        isRecordingMix: true
    }
};

export const WithRecordedSession: Story = {
    args: {
        recordedMixBlob: new Blob(['mock data'], { type: 'audio/webm' })
    }
};

export const DifferentThemes: Story = {
    render: (args) => (
        <div className="flex flex-col gap-8 p-8">
            <div className="relative h-[100px] w-full bg-gray-900 group border border-white/10 rounded-xl">
                <KaraokeToolbar {...args} theme="modern" />
                <div className="p-4 text-xs text-white/40">Theme: Modern</div>
            </div>
            <div className="relative h-[100px] w-full bg-gray-800 group border border-white/10 rounded-xl font-serif">
                <KaraokeToolbar {...args} theme="classic" />
                <div className="p-4 text-xs text-white/40">Theme: Classic</div>
            </div>
            <div className="relative h-[100px] w-full bg-black group border border-purple-500/30 rounded-xl">
                <KaraokeToolbar {...args} theme="neon" />
                <div className="p-4 text-xs text-white/40">Theme: Neon</div>
            </div>
        </div>
    )
};
