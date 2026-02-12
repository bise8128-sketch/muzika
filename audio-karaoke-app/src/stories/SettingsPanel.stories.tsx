import type { Meta, StoryObj } from '@storybook/react';
import { SettingsPanel } from '@/components/UI/SettingsPanel';
import { NextIntlClientProvider } from 'next-intl';
import messages from '../../messages/en.json';
import { useState } from 'react';

// Mock VisualSettings
const defaultVisualSettings = {
    highlightColor: 'text-yellow-400',
    fontSize: 'base' as const,
    fontWeight: 'bold' as const,
    textShadow: true,
    showDualText: false,
    offset: 0
};

const meta: Meta<typeof SettingsPanel> = {
  title: 'UI/SettingsPanel',
  component: SettingsPanel,
  decorators: [
    (Story) => (
      <NextIntlClientProvider locale="en" messages={messages}>
        <div className="h-screen w-full bg-gray-900 relative">
          <Story />
        </div>
      </NextIntlClientProvider>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof SettingsPanel>;

export const Default: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
    selectedModelId: 'mdx-net-inst-v1',
    visualSettings: defaultVisualSettings,
  },
};

export const Closed: Story = {
  args: {
    isOpen: false,
    onClose: () => {},
    selectedModelId: 'mdx-net-inst-v1',
    visualSettings: defaultVisualSettings,
  },
};
