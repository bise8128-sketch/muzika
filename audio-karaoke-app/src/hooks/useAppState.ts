import { useEffect, useCallback } from 'react';
import type { SeparationResult } from '@/types/audio';
import type { PlaybackController } from '@/utils/audio/playbackController';
import { useRouter } from '@/i18n/routing';
import { useAudio } from '@/context/AudioProvider';

export type AppState = 'idle' | 'upload' | 'uploading' | 'processing' | 'results' | 'karaoke' | 'batch' | 'models' | 'error';

interface UseAppStateOptions {
  separationStatus: 'idle' | 'processing' | 'completed' | 'error';
  separationResult: SeparationResult | null;
  separationError: string | null;
  autoStartKaraoke: boolean;
  controller: PlaybackController | null;
  onHistoryRefresh: () => void;
  onResetSeparation: () => void;
  onClearRestoredResult: () => void;
  restoredResult: SeparationResult | null;
}

export function useAppState(options: UseAppStateOptions) {
  const {
    separationStatus,
    separationResult,
    separationError,
    autoStartKaraoke,
    controller,
    onHistoryRefresh,
    onResetSeparation,
    onClearRestoredResult,
    restoredResult,
  } = options;

  const router = useRouter();
  const { machineState: state, send } = useAudio();

  // React to separation completion
  useEffect(() => {
    if (separationStatus === 'processing') {
      // Typically handled by manual event, but sync here too
      // send({ type: 'UPLOAD_COMPLETE' }); 
      // Actually, separationStatus 'processing' means client-side is working
    } else if (separationStatus === 'completed' && separationResult) {
      onHistoryRefresh();
      send({ type: 'PROCESS_COMPLETE' });

      if (autoStartKaraoke && controller) {
        controller.setAudioBuffers([separationResult.vocals, separationResult.instrumentals]);
        if (separationResult.file) {
          controller.setOriginalFile(separationResult.file);
        }
        send({ type: 'START_KARAOKE' });
        router.push(`/karaoke/${separationResult.fileHash}`);
      } else {
        router.push(`/results/${separationResult.fileHash}`);
      }
    } else if (separationStatus === 'error') {
      console.error("Separation Error:", separationError);
      send({ type: 'PROCESS_ERROR', error: separationError || 'Unknown separation error' });
      alert(`Error: ${separationError || 'Unknown error'}`);
    }
  }, [separationStatus, separationResult, autoStartKaraoke, controller, separationError, onHistoryRefresh, send, router]);


  const handleRestart = useCallback(() => {
    send({ type: 'RESET' });
    onResetSeparation();
    onClearRestoredResult();
  }, [onResetSeparation, onClearRestoredResult, send]);

  const handleTryKaraoke = useCallback(() => {
    const activeResult = separationResult || restoredResult;
    if (activeResult && controller) {
      controller.setAudioBuffers([activeResult.vocals, activeResult.instrumentals]);
      router.push(`/karaoke/${activeResult.fileHash}`);
    }
    send({ type: 'START_KARAOKE' });
  }, [separationResult, restoredResult, controller, send, router]);

  // Actions exposed to UI
  const setViewState = useCallback((view: 'upload' | 'processing' | 'results' | 'karaoke' | 'models' | 'batch') => {
    if (view === 'upload') send({ type: 'RESET' }); // rough mapping
    if (view === 'processing') send({ type: 'PROCESS_START' });
    if (view === 'results') send({ type: 'RESTORE_SESSION' }); // hacky mapping for now
    if (view === 'karaoke') send({ type: 'START_KARAOKE' });
    if (view === 'models') send({ type: 'VIEW_MODELS' });
    if (view === 'batch') send({ type: 'START_BATCH' });
  }, [send]);

  // The active result is whichever was most recently produced
  const activeResult = separationResult || restoredResult;

  // Helper to map machine state to string for UI
  const getMappedState = (): AppState => {
    if (state.matches('idle')) return 'upload';
    if (state.matches('uploading')) return 'upload'; // UI might show uploading state in upload view
    if (state.matches('processing')) return 'processing';
    if (state.matches('batchProcessing')) return 'batch';
    if (state.matches('results')) return 'results';
    if (state.matches('karaoke')) return 'karaoke';
    if (state.matches('models')) return 'models';
    return 'error';
  };

  return {
    state: getMappedState(),
    machineState: state, // expose raw machine state if needed
    send, // expose send for custom events
    setState: setViewState, // backward compatibility adapter
    activeResult,
    handleRestart,
    handleTryKaraoke,
  };
}
