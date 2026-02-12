import { useCallback } from 'react';
import { exportAudio, MP3ExportError, getErrorMessage } from '@/utils/audio/audioExporter';
import type { QueueItem } from '@/hooks/useBatchSeparation';

interface DownloadTrack {
  id: string;
  name: string;
  blob: Blob | AudioBuffer | null;
}

export function useAudioExport() {
  const handleDownload = useCallback(async (track: DownloadTrack, format: 'wav' | 'mp3') => {
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
      await exportAudio(buffer, format, filename);
    } catch (e) {
      console.error('Download failed:', e);
      if (e instanceof MP3ExportError) {
        throw new Error(getErrorMessage(e));
      }
      throw e;
    }
  }, []);

  const handleBatchDownload = useCallback(async (item: QueueItem) => {
    if (!item.result) return;
    const baseName = item.file.name.replace(/\.[^/.]+$/, "");
    await exportAudio(item.result.vocals, 'mp3', `${baseName}_vocals.mp3`);
    await exportAudio(item.result.instrumentals, 'mp3', `${baseName}_instrumental.mp3`);
  }, []);

  return {
    handleDownload,
    handleBatchDownload,
  };
}
