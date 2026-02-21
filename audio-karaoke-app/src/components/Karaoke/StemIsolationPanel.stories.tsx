import type { Meta, StoryObj } from '@storybook/react';
import { StemIsolationPanel } from './StemIsolationPanel';
import type { PlaybackController } from '@/utils/audio/playback/PlaybackCore';
import type { StemSettings } from '@/types/audio';

// Mock implementation of PlaybackController
const createMockController = (): PlaybackController => {
  let stems: StemSettings[] = [
    { type: 'vocals', label: 'Vocals', volume: 1.0, muted: false, solo: false, icon: '🎤', panning: 0, reverbSend: 0.1, echoSend: 0 },
    { type: 'drums', label: 'Drums', volume: 0.8, muted: false, solo: false, icon: '🥁', panning: -0.2, reverbSend: 0, echoSend: 0 },
    { type: 'bass', label: 'Bass', volume: 0.8, muted: false, solo: false, icon: '🎸', panning: 0.2, reverbSend: 0, echoSend: 0 },
    { type: 'other', label: 'Other', volume: 0.7, muted: false, solo: false, icon: '🎹', panning: 0, reverbSend: 0.05, echoSend: 0.1 },
  ];

  return {
    getStemStates: () => [...stems],
    getStemLevels: () => stems.map(() => Math.random() * 0.5),
    setStemVolume: (index: number, volume: number) => {
      stems[index] = { ...stems[index], volume };
    },
    setStemPanning: (index: number, pan: number) => {
      stems[index] = { ...stems[index], panning: pan };
    },
    setStemReverbSend: (index: number, amount: number) => {
      stems[index] = { ...stems[index], reverbSend: amount };
    },
    setStemEchoSend: (index: number, amount: number) => {
      stems[index] = { ...stems[index], echoSend: amount };
    },
    toggleStemMute: (index: number) => {
      stems[index] = { ...stems[index], muted: !stems[index].muted };
    },
    toggleStemSolo: (index: number) => {
      stems[index] = { ...stems[index], solo: !stems[index].solo };
    },
    applyStemPreset: (preset: string) => {
      if (preset === 'karaoke') {
        stems[0].muted = true;
      } else if (preset === 'full-mix') {
        stems.forEach(s => s.muted = false);
      }
    },
  } as unknown as PlaybackController;
};

const meta: Meta<typeof StemIsolationPanel> = {
  title: 'Karaoke/StemIsolationPanel',
  component: StemIsolationPanel,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
    },
  },
};

export default meta;
type Story = StoryObj<typeof StemIsolationPanel>;

export const Default: Story = {
  args: {
    controller: createMockController(),
  },
  decorators: [
    (Story) => (
      <div className="w-[400px] p-4 bg-gray-900 rounded-xl">
        <Story />
      </div>
    ),
  ],
};
