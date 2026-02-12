import type { Meta, StoryObj } from '@storybook/react';
import LanguageSwitcher from '@/components/UI/LanguageSwitcher';
import { NextIntlClientProvider } from 'next-intl';
import messages from '../../messages/en.json';

const meta: Meta<typeof LanguageSwitcher> = {
  title: 'UI/LanguageSwitcher',
  component: LanguageSwitcher,
  decorators: [
    (Story) => (
      <NextIntlClientProvider locale="en" messages={messages}>
        <div className="p-4 bg-gray-900">
          <Story />
        </div>
      </NextIntlClientProvider>
    ),
  ],
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof LanguageSwitcher>;

export const Default: Story = {};
