import type { Meta, StoryObj } from '@storybook/react';
import { StemIsolationPanel } from './StemIsolationPanel';
import type { PlaybackController } from '@/utils/audio/playback/PlaybackCore';
import type { StemSettings } from '@/types/audio';

// Mock implementation of PlaybackController
const createMockController = (): PlaybackController => {
  let stems: StemSettings[] = [
    { type: 'vocals', label: 'Vocals', volume: 1.0, muted: false, solo: false, icon: '🎤' },
    { type: 'drums', label: 'Drums', volume: 0.8, muted: false, solo: false, icon: '🥁' },
    { type: 'bass', label: 'Bass', volume: 0.8, muted: false, solo: false, icon: '🎸' },
    { type: 'other', label: 'Other', volume: 0.7, muted: false, solo: false, icon: '🎹' },
  ];

  return {
    getStemStates: () => [...stems],
    setStemVolume: (index: number, volume: number) => {
      stems[index] = { ...stems[index], volume };
      console.log(`Set volume for stem ${index} to ${volume}`);
    },
    toggleStemMute: (index: number) => {
      stems[index] = { ...stems[index], muted: !stems[index].muted };
      console.log(`Toggled mute for stem ${index}`);
    },
    toggleStemSolo: (index: number) => {
      stems[index] = { ...stems[index], solo: !stems[index].solo };
      console.log(`Toggled solo for stem ${index}`);
    },
    applyStemPreset: (preset: string) => {
      console.log(`Applied preset: ${preset}`);
      // Mock logic for presets
      if (preset === 'karaoke') {
        stems[0].muted = true;
      } else if (preset === 'full-mix') {
        stems.forEach(s => s.muted = false);
      }
    },
    // Add other required methods as no-ops if needed by the interface but not used in the component
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
