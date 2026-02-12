'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import type { PlaybackController } from '@/utils/audio/playbackController';

const KaraokePlayer = dynamic(() => import('@/components/Karaoke/KaraokePlayer').then(mod => mod.KaraokePlayer), {
  loading: () => <div className="h-64 flex items-center justify-center text-muted-foreground">Loading Karaoke Player...</div>,
  ssr: false
});

interface KaraokeViewProps {
  controller: PlaybackController;
  onBack: () => void;
}

export function KaraokeView({ controller, onBack }: KaraokeViewProps) {
  const t = useTranslations('HomePage');

  return (
    <div className="animate-in fade-in duration-700">
      <button
        onClick={onBack}
        className="mb-8 flex items-center gap-2 text-muted-foreground hover:text-white transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        {t('backToResults')}
      </button>
      <KaraokePlayer controller={controller} />
    </div>
  );
}
