import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from '@/i18n/routing';
import { useAudio } from '@/context/AudioProvider';

import { getSettings, saveSettings } from '@/utils/storage/settingsStore';
import { songsStorage } from '@/utils/storage/songsStorage';
import { audioCache } from '@/utils/storage/audioCache';
import { DEFAULT_MODEL_ID } from '@/utils/constants';

import { useBatchSeparation } from '@/hooks/useBatchSeparation';
import { useModels } from '@/hooks/useModels';
import { useHistoryManagement } from '@/hooks/useHistoryManagement';
import { useAudioExport } from '@/hooks/useAudioExport';
import { useServerProcessing } from '@/hooks/useServerProcessing';
import { ExtractedMetadata } from '@/types/schema';

export function usePageOrchestrator() {
  const router = useRouter();
  const { models: AVAILABLE_MODELS } = useModels();

  const {
    controller,
    setActiveResult,
    separation,
    machineState,
    send
  } = useAudio();

  // UI state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  
  const [autoStartKaraoke, setAutoStartKaraoke] = useState(() => {
    if (typeof window !== 'undefined') return getSettings().autoStartKaraoke;
    return false;
  });
  
  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_MODEL_ID);

  // Domain hooks
  const serverProcessing = useServerProcessing();
  const batch = useBatchSeparation();
  const history = useHistoryManagement();
  const { handleDownload, handleBatchDownload } = useAudioExport();

  // Unified Processing State
  const isProcessing = separation.status === 'processing' || serverProcessing.isPolling;
  const isError = separation.status === 'error' || !!serverProcessing.error;
  const errorMessage = separation.error || serverProcessing.error;
  const processingResult = separation.result || serverProcessing.result;

  // Update provider with new results automatically
  useEffect(() => {
    if (processingResult) {
      setActiveResult(processingResult);
    }
  }, [processingResult, setActiveResult]);

  const activeResult = processingResult || history.restoredResult;

  const handleRestart = useCallback(() => {
    send({ type: 'RESET' });
    separation.reset();
    serverProcessing.reset();
    history.clearRestoredResult();
  }, [send, separation, serverProcessing, history]);

  const handleTryKaraoke = useCallback(() => {
    if (activeResult && controller) {
      controller.setAudioBuffers([activeResult.vocals, activeResult.instrumentals]);
    }
    send({ type: 'START_KARAOKE' });
  }, [activeResult, controller, send]);

  // Handlers
  const handleUrlSubmit = async (url: string) => {
    const modelInfo = AVAILABLE_MODELS.find(m => m.id === selectedModelId);
    if (!modelInfo) {
      alert('Selected model not found!');
      return;
    }

    send({ type: 'PROCESS_START' });
    await serverProcessing.handleServerProcessing(url, { model: selectedModelId, format: 'mp3' });
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
      // Calculate hash early for route-based tracking
      const fileHash = await audioCache.hashFile(file);
      router.push(`/process/${fileHash}`);
      
      send({ type: 'PROCESS_START' });
      const fileMetadata = metadata ? metadata[0] : undefined;
      await separation.separate(file, modelInfo, false, fileMetadata);
    } catch (e) {
      console.error("Upload/Separation failed immediately:", e);
      send({ type: 'UPLOAD_ERROR', error: String(e) });
    }
  };

  const handleRestore = async (fileHash: string) => {
    try {
      await history.handleRestore(fileHash);
      send({ type: 'RESTORE_SESSION' });
      router.push(`/results/${fileHash}`);
    } catch {
      alert('Failed to restore session from database.');
    }
  };

  const toggleAutoStartKaraoke = (val: boolean) => {
    setAutoStartKaraoke(val);
    saveSettings({ autoStartKaraoke: val });
  };

  // Navigation Handlers
  const handleBack = () => send({ type: 'BACK' });
  const handleExitKaraoke = () => send({ type: 'EXIT_KARAOKE' });
  const handleViewModels = () => send({ type: 'VIEW_MODELS' });

  // Expose specific separation state for UI
  const compositeSeparation = {
    ...separation,
    status: unifiedStatus,
    progress: serverProcessing.isPolling ? 0 : separation.progress, 
    message: serverProcessing.isPolling ? (serverProcessing.serverLogs || 'Processing on server...') : separation.message,
    executionBackend: serverProcessing.isPolling || serverProcessing.result ? 'server' : separation.executionBackend,
  };

  return {
    machineState,
    send,
    activeResult,
    handleRestart,
    handleTryKaraoke,
    handleBack,
    handleExitKaraoke,
    handleViewModels,
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
    separation: compositeSeparation, 
    batch,
    history,
    handleDownload,
    handleBatchDownload,
    controller,
  };
}
