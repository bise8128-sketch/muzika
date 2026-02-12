import { useState, useEffect, useCallback } from 'react';
import type { SeparationResult } from '@/types/audio';

interface ServerProcessingState {
  serverJobId: string | null;
  serverLogs: string;
  isPolling: boolean;
  result: SeparationResult | null;
  error: string | null;
}

export function useServerProcessing() {
  const [serverJobId, setServerJobId] = useState<string | null>(null);
  const [serverLogs, setServerLogs] = useState<string>('');
  const [result, setResult] = useState<SeparationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Poll for server job status
  useEffect(() => {
    let interval: NodeJS.Timeout;
    const abortCtrl = new AbortController();
    const { signal } = abortCtrl;

    if (!serverJobId) return;

    setIsPolling(true);

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/python-processing?jobId=${serverJobId}`, { signal });
        if (!res.ok || signal.aborted) return;

        const data = await res.json();
        if (signal.aborted) return;

        if (data.status === 'completed') {
          clearInterval(interval);

          try {
            const AudioContextClass = typeof window !== 'undefined' ? (window.AudioContext || (window as any).webkitAudioContext) : null;
            if (!AudioContextClass) {
              throw new Error("AudioContext not supported");
            }
            const ctx = new AudioContextClass();

            const [vocalsBuffer, instrumentalBuffer, originalBuffer] = await Promise.all([
              data.stems.vocals ? fetch(data.stems.vocals, { signal }).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)) : null,
              data.stems.other ? fetch(data.stems.other, { signal }).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)) : null,
              data.original ? fetch(data.original, { signal }).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)) : null
            ]);

            if (signal.aborted) return;

            let finalInstrumental = instrumentalBuffer;

            if (data.stems.drums && data.stems.bass && data.stems.other) {
              const fetchAndDecode = (url: string) => fetch(url, { signal }).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b));
              const [drums, bass, other] = await Promise.all([
                fetchAndDecode(data.stems.drums),
                fetchAndDecode(data.stems.bass),
                fetchAndDecode(data.stems.other)
              ]);

              if (signal.aborted) return;

              const length = vocalsBuffer?.length || drums.length;
              const mixed = ctx.createBuffer(2, length, ctx.sampleRate);
              for (let c = 0; c < 2; c++) {
                const d = drums.getChannelData(c);
                const b = bass.getChannelData(c);
                const o = other.getChannelData(c);
                const out = mixed.getChannelData(c);
                for (let i = 0; i < length; i++) {
                  out[i] = d[i] + b[i] + o[i];
                }
              }
              finalInstrumental = mixed;
            }

            if (!vocalsBuffer || !finalInstrumental) {
              throw new Error("Missing audio stems from server response");
            }

            if (!signal.aborted) {
              setResult({
                vocals: vocalsBuffer,
                instrumentals: finalInstrumental,
                originalAudio: originalBuffer,
                timestamp: Date.now(),
                fileHash: serverJobId || 'server-job'
              });
              setServerJobId(null);
              setIsPolling(false);
            }

          } catch (e) {
            if (signal.aborted) return;
            console.error("Failed to load server results", e);
            setError("Failed to load processed audio.");
            setIsPolling(false);
          }

        } else if (data.status === 'error') {
          clearInterval(interval);
          if (!signal.aborted) {
            setError(`Server Error: ${data.error}`);
            setIsPolling(false);
          }
        } else if (data.status === 'processing') {
          if (data.logs && !signal.aborted) setServerLogs(data.logs);
        }
      } catch (e) {
        if (!signal.aborted) console.error("Polling error", e);
      }
    };

    interval = setInterval(checkStatus, 2000);
    checkStatus(); // Initial check

    return () => {
      clearInterval(interval);
      abortCtrl.abort();
    };
  }, [serverJobId]);

  const handleServerProcessing = useCallback(async (url: string, config: { model: string, format: string }) => {
    try {
      setError(null);
      setResult(null);
      const res = await fetch('/api/python-processing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, ...config })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Server request failed');
      }

      const data = await res.json();
      setServerJobId(data.jobId);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Failed to start processing");
    }
  }, []);

  const reset = useCallback(() => {
    setServerJobId(null);
    setServerLogs('');
    setResult(null);
    setError(null);
    setIsPolling(false);
  }, []);

  return {
    serverJobId,
    serverLogs,
    isPolling,
    result,
    error,
    handleServerProcessing,
    reset,
  };
}
