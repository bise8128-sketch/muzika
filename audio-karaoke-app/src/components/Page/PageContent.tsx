import React from 'react';
import { UploadView } from '@/components/Page/UploadView';
import { ProcessingView } from '@/components/Page/ProcessingView';
import { ResultsView } from '@/components/Page/ResultsView';
import { KaraokeView } from '@/components/Page/KaraokeView';
import { ModelsView } from '@/components/Page/ModelsView';
import { BatchView } from '@/components/Page/BatchView';
import type { ModelInfo } from '@/types/model';
import type { HistorySession } from '@/utils/storage/historyStore';
import type { QueueItem } from '@/hooks/useBatchSeparation';
import type { PlaybackController } from '@/utils/audio/playbackController';
import type { SeparationResult } from '@/types/audio';
import type { ExtractedMetadata } from '@/types/schema';

// We use any for machineState to avoid complex XState type imports
// The component just checks matches('stateName')
interface MachineState {
  matches: (state: string) => boolean;
}

interface SeparationState {
  status: 'idle' | 'processing' | 'completed' | 'error';
  progress: number;
  message: string;
  executionBackend?: 'webgpu' | 'wasm' | 'server' | null;
}

interface BatchState {
  queue: QueueItem[];
  isProcessing: boolean;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
  startBatch: (model: ModelInfo) => void;
}

interface HistoryState {
  historyItems: HistorySession[];
  clearHistory: () => void;
}

interface DownloadTrack {
  id: string;
  name: string;
  blob: Blob | AudioBuffer | null;
}

interface PageContentProps {
  machineState: MachineState;
  separation: SeparationState;
  batch: BatchState;
  history: HistoryState;
  activeResult: SeparationResult | null;
  selectedModelId: string;
  availableModels: ModelInfo[];
  autoStartKaraoke: boolean;
  
  // Actions
  onUpload: (files: File[], isKaraokeMode?: boolean, metadata?: ExtractedMetadata[]) => void;
  onUrlSubmit: (url: string) => void;
  onAutoStartToggle: (val: boolean) => void;
  onModelChange: (id: string) => void;
  onRestore: (fileHash: string) => void;
  onDownload: (track: DownloadTrack, format: 'wav' | 'mp3') => void;
  onBatchDownload: (item: QueueItem) => void;
  onRestart: () => void;
  onTryKaraoke: () => void;
  onBack: () => void;
  onExitKaraoke: () => void;
}

export function PageContent({
  machineState,
  separation,
  batch,
  history,
  activeResult,
  selectedModelId,
  availableModels,
  autoStartKaraoke,
  onUpload,
  onUrlSubmit,
  onAutoStartToggle,
  onModelChange,
  onRestore,
  onDownload,
  onBatchDownload,
  onRestart,
  onTryKaraoke,
  onBack,
  onExitKaraoke
}: PageContentProps) {
  
  if (machineState.matches('uploading') || machineState.matches('idle')) {
    return (
      <UploadView
        onUpload={onUpload}
        onUrlSubmit={onUrlSubmit}
        isLoading={machineState.matches('uploading') || separation.status === 'processing'}
        autoStartKaraoke={autoStartKaraoke}
        onAutoStartToggle={onAutoStartToggle}
        selectedModelId={selectedModelId}
        activeModelName={availableModels.find(m => m.id === selectedModelId)?.name || 'Default'}
        onModelChange={onModelChange}
        historyItems={history.historyItems}
        onRestore={onRestore}
        onClearHistory={history.clearHistory}
      />
    );
  }

  if (machineState.matches('processing')) {
    return (
      <ProcessingView
        progress={separation.progress}
        message={separation.message}
        status={separation.status}
        executionBackend={separation.executionBackend}
      />
    );
  }

  if (machineState.matches('results')) {
    return (
      <ResultsView
        activeResult={activeResult}
        onDownload={onDownload}
        onRestart={onRestart}
        onTryKaraoke={onTryKaraoke}
      />
    );
  }

  if (machineState.matches('karaoke')) {
    return (
      <KaraokeView
        onBack={onExitKaraoke}
      />
    );
  }

  if (machineState.matches('models')) {
    return (
      <ModelsView onBack={onBack} />
    );
  }

  if (machineState.matches('batchProcessing')) {
    return (
      <BatchView
        queue={batch.queue}
        isProcessing={batch.isProcessing}
        onRemove={batch.removeFromQueue}
        onClear={batch.clearQueue}
        onStartBatch={batch.startBatch}
        onBatchDownload={onBatchDownload}
        onBack={onBack}
        selectedModelId={selectedModelId}
        models={availableModels}
      />
    );
  }

  return null;
}
