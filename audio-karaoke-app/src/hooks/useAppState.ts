import { useState, useEffect, useCallback } from 'react';
import type { SeparationResult } from '@/types/audio';
import type { PlaybackController } from '@/utils/audio/playbackController';

export type AppState = 'upload' | 'processing' | 'results' | 'karaoke' | 'models' | 'batch';

interface UseAppStateOptions {
  separationStatus: 'idle' | 'processing' | 'completed' | 'error';
  separationResult: SeparationResult | null;
  separationError: string | null;
  serverProcessingResult: SeparationResult | null;
  serverProcessingError: string | null;
  autoStartKaraoke: boolean;
  controller: PlaybackController | null;
  onHistoryRefresh: () => void;
  onResetSeparation: () => void;
  onResetServerProcessing: () => void;
  onClearRestoredResult: () => void;
  restoredResult: SeparationResult | null;
}

export function useAppState(options: UseAppStateOptions) {
  const {
    separationStatus,
    separationResult,
    separationError,
    serverProcessingResult,
    serverProcessingError,
    autoStartKaraoke,
    controller,
    onHistoryRefresh,
    onResetSeparation,
    onResetServerProcessing,
    onClearRestoredResult,
    restoredResult,
  } = options;

  const [state, setState] = useState<AppState>('upload');

  // React to separation completion
  useEffect(() => {
    if (separationStatus === 'completed' && separationResult) {
      onHistoryRefresh();

      if (autoStartKaraoke && controller) {
        controller.setAudioBuffers([separationResult.vocals, separationResult.instrumentals]);
        setState('karaoke');
      } else {
        const timer = setTimeout(() => setState('results'), 500);
        return () => clearTimeout(timer);
      }
    } else if (separationStatus === 'error') {
      console.error("Separation Error:", separationError);
      setState('upload');
      alert(`Error: ${separationError || 'Unknown error'}`);
    }
  }, [separationStatus, separationResult, autoStartKaraoke, controller, separationError, onHistoryRefresh]);

  // React to server processing completion
  useEffect(() => {
    if (serverProcessingResult) {
      setState('results');
    }
  }, [serverProcessingResult]);

  // React to server processing error
  useEffect(() => {
    if (serverProcessingError) {
      alert(serverProcessingError);
      setState('upload');
    }
  }, [serverProcessingError]);

  const handleRestart = useCallback(() => {
    setState('upload');
    onResetSeparation();
    onClearRestoredResult();
    onResetServerProcessing();
  }, [onResetSeparation, onClearRestoredResult, onResetServerProcessing]);

  const handleTryKaraoke = useCallback(() => {
    const activeResult = separationResult || restoredResult || serverProcessingResult;
    if (activeResult && controller) {
      controller.setAudioBuffers([activeResult.vocals, activeResult.instrumentals]);
    }
    setState('karaoke');
  }, [separationResult, restoredResult, serverProcessingResult, controller]);

  // The active result is whichever was most recently produced
  const activeResult = separationResult || restoredResult || serverProcessingResult;

  return {
    state,
    setState,
    activeResult,
    handleRestart,
    handleTryKaraoke,
  };
}
