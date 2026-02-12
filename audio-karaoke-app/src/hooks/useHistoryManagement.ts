import { useState, useEffect, useCallback } from 'react';
import type { SeparationResult } from '@/types/audio';
import { getHistorySessions, restoreSession, clearHistory as dbClearHistory, HistorySession } from '@/utils/storage/historyStore';
import { float32ArrayToAudioBuffer } from '@/utils/audio/audioDecoder';

export function useHistoryManagement() {
  const [historyItems, setHistoryItems] = useState<HistorySession[]>([]);
  const [restoredResult, setRestoredResult] = useState<SeparationResult | null>(null);

  const loadHistory = useCallback(async () => {
    const sessions = await getHistorySessions();
    setHistoryItems(sessions);
  }, []);

  // Load history on mount
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const sessions = await getHistorySessions();
      if (mounted) {
        setHistoryItems(sessions);
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, []);

  const handleRestore = useCallback(async (fileHash: string) => {
    try {
      const session = await restoreSession(fileHash);
      if (!session) {
        throw new Error('Could not find session data');
      }

      const vocals = float32ArrayToAudioBuffer(new Float32Array(session.vocals), session.sampleRate, 2);
      const instrumentals = float32ArrayToAudioBuffer(new Float32Array(session.instrumentals), session.sampleRate, 2);

      setRestoredResult({
        vocals,
        instrumentals,
        originalAudio: null,
        timestamp: session.processedAt,
        fileHash: session.fileHash
      });

      return true;
    } catch (e) {
      console.error('Restore failed:', e);
      throw e;
    }
  }, []);

  const clearHistory = useCallback(async () => {
    await dbClearHistory();
    setHistoryItems([]);
  }, []);

  const clearRestoredResult = useCallback(() => {
    setRestoredResult(null);
  }, []);

  return {
    historyItems,
    restoredResult,
    loadHistory,
    handleRestore,
    clearHistory,
    clearRestoredResult,
  };
}
