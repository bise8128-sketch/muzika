'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { BatchQueue } from '@/components/Batch/BatchQueue';
import type { QueueItem } from '@/hooks/useBatchSeparation';
import type { ModelInfo } from '@/types/model';

interface BatchViewProps {
  queue: QueueItem[];
  isProcessing: boolean;
  onRemove: (id: string) => void;
  onClear: () => void;
  onStartBatch: (model: ModelInfo) => void;
  onBatchDownload: (item: QueueItem) => void;
  onBack: () => void;
  selectedModelId: string;
  models: ModelInfo[];
}

export function BatchView({
  queue,
  isProcessing,
  onRemove,
  onClear,
  onStartBatch,
  onBatchDownload,
  onBack,
  selectedModelId,
  models,
}: BatchViewProps) {
  const t = useTranslations('HomePage');

  return (
    <div className="animate-in fade-in slide-in-from-bottom-10 duration-500">
      <div className="flex justify-between items-center mb-6">
        <button onClick={onBack} className="text-sm hover:text-white flex items-center gap-2">
          <span>←</span> {t('back')}
        </button>
        <div className="space-x-4">
          <button
            onClick={onClear}
            disabled={isProcessing}
            className="text-red-400 hover:text-red-300 disabled:opacity-50 text-sm font-medium"
          >
            {t('clearAll')}
          </button>
          <button
            onClick={() => {
              const model = models.find(m => m.id === selectedModelId);
              if (model) onStartBatch(model);
            }}
            disabled={isProcessing || queue.length === 0}
            className="bg-primary hover:bg-primary/90 px-6 py-2 rounded-full font-bold disabled:opacity-50 transition-all"
          >
            {isProcessing ? t('processing') : t('startBatch')}
          </button>
        </div>
      </div>
      <BatchQueue
        queue={queue}
        onRemove={onRemove}
        onDownload={onBatchDownload}
      />
    </div>
  );
}
