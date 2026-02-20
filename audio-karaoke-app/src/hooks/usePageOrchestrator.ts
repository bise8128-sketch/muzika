import { useState, useEffect } from 'react';
import { useRouter } from '@/i18n/routing';

import { PlaybackController } from '@/utils/audio/playbackController';
import { getSettings, saveSettings } from '@/utils/storage/settingsStore';
import { songsStorage } from '@/utils/storage/songsStorage';
import { DEFAULT_MODEL_ID } from '@/utils/constants';

import { useSeparation } from '@/hooks/useSeparation';
import { useBatchSeparation } from '@/hooks/useBatchSeparation';
import { useModels } from '@/hooks/useModels';
import { useHistoryManagement } from '@/hooks/useHistoryManagement';
import { useAudioExport } from '@/hooks/useAudioExport';
import { useAppState } from '@/hooks/useAppState';
import { apiClient } from '@/api/ApiClient';
import { ExtractedMetadata } from '@/types/schema';

export function usePageOrchestrator() {
  const router = useRouter();
  const { models: AVAILABLE_MODELS } = useModels();

  // PlaybackController
  const [controller, setController] = useState<PlaybackController | null>(null);
  useEffect(() => {
    setController(new PlaybackController());
  }, []);
  
  useEffect(() => {
    return () => { if (controller) controller.dispose(); };
  }, [controller]);

  // UI state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  
  const [autoStartKaraoke, setAutoStartKaraoke] = useState(() => {
    if (typeof window !== 'undefined') return getSettings().autoStartKaraoke;
    return false;
  });
  
  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_MODEL_ID);

  // Domain hooks
  const separation = useSeparation();
  const batch = useBatchSeparation();
  const history = useHistoryManagement();
  const { handleDownload, handleBatchDownload } = useAudioExport();

  const { state, machineState, send, activeResult, handleRestart, handleTryKaraoke } = useAppState({
    separationStatus: separation.status,
    separationResult: separation.result,
    separationError: separation.error,
    autoStartKaraoke,
    controller,
    onHistoryRefresh: history.loadHistory,
    onResetSeparation: separation.reset,
    onClearRestoredResult: history.clearRestoredResult,
    restoredResult: history.restoredResult,
  });

  // Handlers
  const handleUrlSubmit = async (url: string) => {
    const modelInfo = AVAILABLE_MODELS.find(m => m.id === selectedModelId);
    if (!modelInfo) {
      alert('Selected model not found!');
      return;
    }

    try {
      send({ type: 'PROCESS_START' });
      await apiClient.startProcessing({ url, model: selectedModelId, format: 'mp3' });
    } catch (e) {
      console.error('YouTube download/separation failed:', e);
      send({ type: 'UPLOAD_ERROR', error: String(e) });
    }
  };

  const handleUpload = async (files: File[], isKaraokeMode: boolean = false, metadata?: ExtractedMetadata[]) => {
    if (files.length === 0) return;

    if (isKaraokeMode) {
      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const fileMetadata = metadata ? metadata[i] : undefined;
          await songsStorage.saveDirectKaraoke(file, fileMetadata);
        }
        router.push('/library');
      } catch (e) {
        console.error("Failed to save karaoke song:", e);
        alert("Failed to save song to library.");
      }
      return;
    }

    if (files.length > 1) {
      batch.addToQueue(files);
      send({ type: 'START_BATCH' });
      return;
    }

    const file = files[0];
    const modelInfo = AVAILABLE_MODELS.find(m => m.id === selectedModelId);
    if (!modelInfo) {
      alert('Selected model not found!');
      return;
    }

    try {
      send({ type: 'PROCESS_START' });
      await separation.separate(file, modelInfo);
    } catch (e) {
      console.error("Upload/Separation failed immediately:", e);
      send({ type: 'UPLOAD_ERROR', error: String(e) });
    }
  };

  const handleRestore = async (fileHash: string) => {
    try {
      await history.handleRestore(fileHash);
      send({ type: 'RESTORE_SESSION' });
    } catch {
      alert('Failed to restore session from database.');
    }
  };

  const toggleAutoStartKaraoke = (val: boolean) => {
    setAutoStartKaraoke(val);
    saveSettings({ autoStartKaraoke: val });
  };

  return {
    state,
    machineState,
    send,
    activeResult,
    handleRestart,
    handleTryKaraoke,
    isSettingsOpen,
    setIsSettingsOpen,
    showHelp,
    setShowHelp,
    selectedModelId,
    setSelectedModelId,
    AVAILABLE_MODELS,
    autoStartKaraoke,
    toggleAutoStartKaraoke,
    handleUpload,
    handleUrlSubmit,
    handleRestore,
    separation,
    batch,
    history,
    handleDownload,
    handleBatchDownload,
    controller,
  };
}
