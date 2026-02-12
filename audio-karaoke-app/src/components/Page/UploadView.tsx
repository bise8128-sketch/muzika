'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { AudioUpload } from '@/components/AudioUpload/AudioUpload';
import dynamic from 'next/dynamic';
import type { HistorySession } from '@/utils/storage/historyStore';
import type { ExtractedMetadata } from '@/types/schema';

const History = dynamic(() => import('@/components/UI/History').then(mod => mod.History), {
  ssr: false
});

interface UploadViewProps {
  onUpload: (files: File[], isKaraokeMode?: boolean, metadata?: ExtractedMetadata[]) => void;
  isLoading: boolean;
  autoStartKaraoke: boolean;
  onAutoStartToggle: (val: boolean) => void;
  selectedModelId: string;
  onModelChange: (id: string) => void;
  onServerProcessing: (url: string, config: { model: string; format: string }) => void;
  historyItems: HistorySession[];
  onRestore: (fileHash: string) => void;
  onClearHistory: () => void;
}

export function UploadView({
  onUpload,
  isLoading,
  autoStartKaraoke,
  onAutoStartToggle,
  selectedModelId,
  onModelChange,
  onServerProcessing,
  historyItems,
  onRestore,
  onClearHistory,
}: UploadViewProps) {
  const t = useTranslations('HomePage');

  return (
    <div className="animate-in fade-in slide-in-from-bottom-10 duration-1000 max-w-2xl mx-auto">
      <AudioUpload
        onUpload={onUpload}
        isLoading={isLoading}
        autoStartKaraoke={autoStartKaraoke}
        onAutoStartToggle={onAutoStartToggle}
        selectedModelId={selectedModelId}
        onModelChange={onModelChange}
        onServerProcessing={onServerProcessing}
      />
      <div className="mt-16">
        <History
          items={historyItems.map(h => ({
            id: h.fileHash,
            fileName: h.fileName,
            date: new Date(h.date).toLocaleDateString(),
            duration: `${Math.floor(h.duration / 60)}:${(h.duration % 60).toString().padStart(2, '0')}`
          }))}
          onRestore={onRestore}
          onClear={onClearHistory}
        />
      </div>
    </div>
  );
}
