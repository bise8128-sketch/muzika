import { useCallback } from 'react';
import { exportAudio, MP3ExportError, getErrorMessage, warmUpExportPool } from '@/utils/audio/audioExporter';
import type { QueueItem } from '@/hooks/useBatchSeparation';
import type { ExportPriority } from '@/utils/audio/audioExportPool';

interface DownloadTrack {
  id: string;
  name: string;
  blob: Blob | AudioBuffer | null;
}

export function useAudioExport() {
  // Pre-warm the worker pool when the hook is used
  // This ensures workers are ready when user initiates export
  const handleWarmUp = useCallback(async () => {
    try {
      await warmUpExportPool();
    } catch (error) {
      console.warn('[useAudioExport] Failed to warm up export pool:', error);
    }
  }, []);

  const handleDownload = useCallback(async (
    track: DownloadTrack,
    format: 'wav' | 'mp3',
    priority?: ExportPriority,
    onProgress?: (progress: number) => void
  ) => {
    if (!track.blob) {
      throw new Error('Track data not available for download');
    }

    try {
      let buffer: AudioBuffer;

      // Handle both Blob and AudioBuffer types
      if (track.blob instanceof AudioBuffer) {
        buffer = track.blob;
      } else if (track.blob instanceof Blob) {
        // Convert Blob to AudioBuffer
        const arrayBuffer = await track.blob.arrayBuffer();
        const AudioContextClass = typeof window !== 'undefined' ? (window.AudioContext || (window as any).webkitAudioContext) : null;
        if (!AudioContextClass) {
          throw new Error("AudioContext not supported");
        }
        const audioContext = new AudioContextClass();
        buffer = await audioContext.decodeAudioData(arrayBuffer);
      } else {
        throw new Error('Invalid track data type');
      }

      const filename = `${track.name.toLowerCase()}_${Date.now()}.${format}`;
      await exportAudio(buffer, format, filename, undefined, priority, onProgress);
    } catch (e) {
      console.error('Download failed:', e);
      if (e instanceof MP3ExportError) {
        throw new Error(getErrorMessage(e));
      }
      throw e;
    }
  }, []);

  const handleBatchDownload = useCallback(async (item: QueueItem, priority?: ExportPriority) => {
    if (!item.result) return;
    const baseName = item.file.name.replace(/\.[^/.]+$/, "");
    await exportAudio(item.result.vocals, 'mp3', `${baseName}_vocals.mp3`, undefined, priority);
    await exportAudio(item.result.instrumentals, 'mp3', `${baseName}_instrumental.mp3`, undefined, priority);
  }, []);

  return {
    handleDownload,
    handleBatchDownload,
    handleWarmUp,
  };
}
