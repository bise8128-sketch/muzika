'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import type { SeparationResult } from '@/types/audio';

const ResultsDisplay = dynamic(() => import('@/components/SeparationEngine/ResultsDisplay').then(mod => mod.ResultsDisplay), {
  loading: () => <div className="h-64 flex items-center justify-center text-muted-foreground">Preparing results...</div>,
  ssr: false
});

interface DownloadTrack {
  id: string;
  name: string;
  blob: Blob | AudioBuffer | null;
}

interface ResultsViewProps {
  activeResult: SeparationResult | null;
  onDownload: (track: DownloadTrack, format: 'wav' | 'mp3') => void;
  onRestart: () => void;
  onTryKaraoke: () => void;
}

export function ResultsView({ activeResult, onDownload, onRestart, onTryKaraoke }: ResultsViewProps) {
  const t = useTranslations('HomePage');

  return (
    <ResultsDisplay
      tracks={[
        { id: 'original', name: t('original'), blob: activeResult?.originalAudio || null },
        { id: 'vocals', name: t('vocals'), blob: activeResult?.vocals || null },
        { id: 'instrumental', name: t('instrumental'), blob: activeResult?.instrumentals || null }
      ]}
      onDownload={onDownload}
      onRestart={onRestart}
      onTryKaraoke={onTryKaraoke}
    />
  );
}
