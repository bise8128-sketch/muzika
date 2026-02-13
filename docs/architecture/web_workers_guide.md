# Web Workers Implementation Guide

## 1. Što su Web Workers?

Web Workers omogućavaju pokretanje JavaScript koda na zasebnoj niti bez blokiranja glavnog UI threada. To je kritično za audio separaciju jer je CPU-intenzivna i može zamrznuti aplikaciju.

```
┌─────────────────────────────────────┐
│      MAIN THREAD (UI)               │
│  - Event listeners                  │
│  - DOM updates                      │
│  - User interactions                │
│  ↓ postMessage()                    │
└─────────────────────────────────────┘
         ↕ message passing
┌─────────────────────────────────────┐
│   WORKER THREAD (Computation)       │
│  - Heavy AI inference               │
│  - Audio processing                 │
│  - No DOM access                    │
│  ↓ postMessage()                    │
└─────────────────────────────────────┘
```

---

## 2. Audio Separation Worker

### File: `src/workers/audioSeparationWorker.ts`

```typescript
// Importaj ONNX Runtime i audio utilities
import * as ort from 'onnxruntime-web';
import {
  performInference,
  mergeSegments,
} from '../utils/ml/inference';
import { decodeAudioSegment } from '../utils/audio/audioProcessor';

// Globalnog stanja za worker
let currentSession: ort.InferenceSession | null = null;
let isProcessing = false;

// Message handler
self.onmessage = async (event: MessageEvent) => {
  const { type, payload, id } = event.data;

  try {
    switch (type) {
      case 'LOAD_MODEL':
        await handleLoadModel(payload);
        break;

      case 'SEPARATE_AUDIO':
        await handleSeparateAudio(payload, id);
        break;

      case 'CANCEL':
        handleCancel();
        break;

      case 'CLEAR_MODEL':
        handleClearModel();
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    // Pošalji error natrag main threadu
    self.postMessage({
      id,
      type: 'ERROR',
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
  }
};

/**
 * Učitaj ONNX model
 */
async function handleLoadModel(payload: {
  modelPath: string;
  useGPU: boolean;
}) {
  const { modelPath, useGPU } = payload;

  try {
    // Postavi execution provider (GPU ako dostupno)
    if (useGPU) {
      ort.env.wasm.wasmPaths = '/wasm/';
      ort.env.wasm.numThreads = navigator.hardwareConcurrency || 4;
      ort.env.wasm.simdSupported = true;
    }

    // Učitaj model
    currentSession = await ort.InferenceSession.create(modelPath, {
      executionProviders: useGPU ? ['webgpu', 'wasm'] : ['wasm'],
      graphOptimizationLevel: 'all',
    });

    self.postMessage({
      type: 'MODEL_LOADED',
      data: {
        modelName: modelPath.split('/').pop(),
        success: true,
      },
    });
  } catch (error) {
    currentSession = null;
    throw new Error(`Failed to load model: ${error.message}`);
  }
}

/**
 * Glavna audio separacija
 */
async function handleSeparateAudio(
  payload: {
    audioSegments: Array<{
      id: string;
      channelData: Float32Array;
      sampleRate: number;
    }>;
    chunkIndex: number;
    totalChunks: number;
  },
  messageId: string
) {
  if (!currentSession) {
    throw new Error('Model not loaded. Call LOAD_MODEL first.');
  }

  const { audioSegments, chunkIndex, totalChunks } = payload;
  isProcessing = true;

  const vocalSegments: Float32Array[] = [];
  const instrumentalSegments: Float32Array[] = [];

  try {
    // Procesiraj svaki segment
    for (let i = 0; i < audioSegments.length; i++) {
      if (!isProcessing) break;

      const segment = audioSegments[i];

      // Pošalji progress update
      self.postMessage({
        id: messageId,
        type: 'PROGRESS',
        progress: {
          phase: 'separating',
          currentSegment: chunkIndex * audioSegments.length + i + 1,
          totalSegments: totalChunks,
          percentage: Math.round(
            ((chunkIndex * audioSegments.length + i + 1) / totalChunks) * 100
          ),
          message: `Processing segment ${i + 1}/${audioSegments.length}`,
        },
      });

      // Pripremi input za model
      const input = new ort.Tensor(
        'float32',
        segment.channelData,
        [1, 1, segment.channelData.length]
      );

      // Pokreni inference
      const output = await currentSession.run({
        input: input,
      });

      // Ekstrahira vocals i instrumentals iz outputa
      const vocalsOutput = output.vocals.data as Float32Array;
      const instrumentalsOutput = output.instrumentals.data as Float32Array;

      vocalSegments.push(new Float32Array(vocalsOutput));
      instrumentalSegments.push(new Float32Array(instrumentalsOutput));

      // Oslobodi memoriju
      input.dispose();
      Object.values(output).forEach((tensor) => tensor.dispose());
    }

    // Pošalji rezultate
    self.postMessage({
      id: messageId,
      type: 'SEGMENT_COMPLETE',
      data: {
        vocals: vocalSegments.length > 0 ? vocalSegments[0] : new Float32Array(),
        instrumentals:
          instrumentalSegments.length > 0
            ? instrumentalSegments[0]
            : new Float32Array(),
        segmentIndex: chunkIndex,
      },
    });
  } finally {
    isProcessing = false;
  }
}

/**
 * Prekini procesiranje
 */
function handleCancel() {
  isProcessing = false;
  self.postMessage({
    type: 'CANCELLED',
    data: { message: 'Processing cancelled' },
  });
}

/**
 * Oslobodi model iz memorije
 */
function handleClearModel() {
  if (currentSession) {
    currentSession.release();
    currentSession = null;
  }
  self.postMessage({
    type: 'MODEL_CLEARED',
  });
}
```

---

## 3. Model Loader Worker

### File: `src/workers/modelLoaderWorker.ts`

```typescript
import * as ort from 'onnxruntime-web';
import { getCachedModel, cacheModel } from '../utils/storage/indexedDBStore';

self.onmessage = async (event: MessageEvent) => {
  const { type, payload, id } = event.data;

  try {
    switch (type) {
      case 'LOAD_MODEL':
        await handleLoadModel(payload, id);
        break;

      case 'CHECK_AVAILABILITY':
        await handleCheckAvailability(id);
        break;

      case 'DOWNLOAD_MODEL':
        await handleDownloadModel(payload, id);
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    self.postMessage({
      id,
      type: 'ERROR',
      error: error.message,
    });
  }
};

/**
 * Učitaj model (iz cache-a ili preuzmi)
 */
async function handleLoadModel(
  payload: {
    modelName: 'mdx-net' | 'demucs' | 'bs-roformer';
    useCache?: boolean;
  },
  messageId: string
) {
  const { modelName, useCache = true } = payload;

  try {
    let modelData: ArrayBuffer;
    let fromCache = false;

    // Pokušaj učitati iz cache-a
    if (useCache) {
      const cached = await getCachedModel(modelName);
      if (cached) {
        modelData = cached.modelData;
        fromCache = true;

        self.postMessage({
          id: messageId,
          type: 'PROGRESS',
          progress: {
            phase: 'loading-model',
            percentage: 100,
            message: `Loaded ${modelName} from cache`,
          },
        });
      }
    }

    // Ako nema u cache-u, preuzmi
    if (!modelData) {
      modelData = await downloadModelFromURL(modelName, (percent) => {
        self.postMessage({
          id: messageId,
          type: 'PROGRESS',
          progress: {
            phase: 'downloading-model',
            percentage: percent,
            message: `Downloading ${modelName}... ${percent}%`,
          },
        });
      });

      // Spremi u cache
      await cacheModel(modelName, modelData);
    }

    // Kreiraj Blob i Object URL za ONNX Runtime
    const blob = new Blob([modelData], { type: 'application/octet-stream' });
    const modelUrl = URL.createObjectURL(blob);

    self.postMessage({
      id: messageId,
      type: 'MODEL_READY',
      data: {
        modelName,
        modelUrl,
        fromCache,
        size: modelData.byteLength,
      },
    });
  } catch (error) {
    throw new Error(`Failed to load model ${modelName}: ${error.message}`);
  }
}

/**
 * Provjeri dostupnost modela
 */
async function handleCheckAvailability(messageId: string) {
  const models = ['mdx-net', 'demucs', 'bs-roformer'];
  const availability = {};

  for (const model of models) {
    const cached = await getCachedModel(model);
    availability[model] = {
      available: !!cached,
      size: cached ? cached.modelData.byteLength : null,
      version: cached ? cached.version : null,
    };
  }

  self.postMessage({
    id: messageId,
    type: 'AVAILABILITY_CHECK',
    data: availability,
  });
}

/**
 * Preuzmi model s interneta
 */
async function handleDownloadModel(
  payload: {
    modelName: string;
  },
  messageId: string
) {
  const { modelName } = payload;

  const modelUrls: Record<string, string> = {
    'mdx-net':
      'https://huggingface.co/path/to/mdx-net-model.onnx', // Prilagodi URL
    demucs: 'https://huggingface.co/path/to/demucs-v4.onnx',
    'bs-roformer': 'https://huggingface.co/path/to/bs-roformer.onnx',
  };

  const url = modelUrls[modelName];
  if (!url) {
    throw new Error(`Unknown model: ${modelName}`);
  }

  const modelData = await downloadModelFromURL(modelName, (percent) => {
    self.postMessage({
      id: messageId,
      type: 'PROGRESS',
      progress: {
        phase: 'downloading',
        percentage: percent,
        message: `${modelName}: ${percent}%`,
      },
    });
  });

  await cacheModel(modelName, modelData);

  self.postMessage({
    id: messageId,
    type: 'DOWNLOAD_COMPLETE',
    data: {
      modelName,
      size: modelData.byteLength,
    },
  });
}

/**
 * Utility: Preuzmi model iz URLa
 */
async function downloadModelFromURL(
  modelName: string,
  onProgress: (percent: number) => void
): Promise<ArrayBuffer> {
  const response = await fetch(
    `https://huggingface.co/api/models/${modelName}` // Prilagodi
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const contentLength = response.headers.get('content-length');
  const total = parseInt(contentLength || '0', 10);

  if (total === 0) {
    return await response.arrayBuffer();
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  // Čitaj po chunck-ovima i pratiti napredak
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    loaded += value.length;

    const percent = Math.round((loaded / total) * 100);
    onProgress(percent);
  }

  // Kombinira sve chunck-e
  const arrayBuffer = new ArrayBuffer(loaded);
  const view = new Uint8Array(arrayBuffer);
  let offset = 0;

  for (const chunk of chunks) {
    view.set(chunk, offset);
    offset += chunk.length;
  }

  return arrayBuffer;
}
```

---

## 4. Korištenje Web Workera iz Main Threada

### File: `src/hooks/useSeparation.ts`

```typescript
import { useRef, useCallback, useState } from 'react';

interface SeparationProgress {
  phase: string;
  currentSegment: number;
  totalSegments: number;
  percentage: number;
  message: string;
}

export function useSeparation() {
  const workerRef = useRef<Worker | null>(null);
  const [progress, setProgress] = useState<SeparationProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Inicijalizuj worker
  const initializeWorker = useCallback(() => {
    if (workerRef.current) return;

    workerRef.current = new Worker(
      new URL('../workers/audioSeparationWorker.ts', import.meta.url),
      { type: 'module' }
    );

    workerRef.current.onerror = (error) => {
      console.error('Worker error:', error);
      setIsLoading(false);
    };
  }, []);

  // Učitaj model u worker
  const loadModel = useCallback(
    async (modelPath: string, useGPU: boolean = true) => {
      initializeWorker();

      return new Promise<void>((resolve, reject) => {
        const handler = (event: MessageEvent) => {
          if (event.data.type === 'MODEL_LOADED') {
            workerRef.current?.removeEventListener('message', handler);
            resolve();
          } else if (event.data.type === 'ERROR') {
            workerRef.current?.removeEventListener('message', handler);
            reject(new Error(event.data.error.message));
          }
        };

        workerRef.current?.addEventListener('message', handler);

        workerRef.current?.postMessage({
          type: 'LOAD_MODEL',
          payload: { modelPath, useGPU },
        });
      });
    },
    [initializeWorker]
  );

  // Pokreni separaciju
  const separateAudio = useCallback(
    async (audioSegments: any[], chunkIndex: number, totalChunks: number) => {
      initializeWorker();
      setIsLoading(true);

      return new Promise<any>((resolve, reject) => {
        const messageId = Math.random().toString(36);

        const handler = (event: MessageEvent) => {
          const { id, type, data, error, progress } = event.data;

          if (id !== messageId) return;

          if (type === 'PROGRESS') {
            setProgress(progress);
          } else if (type === 'SEGMENT_COMPLETE') {
            workerRef.current?.removeEventListener('message', handler);
            setIsLoading(false);
            resolve(data);
          } else if (type === 'ERROR') {
            workerRef.current?.removeEventListener('message', handler);
            setIsLoading(false);
            reject(new Error(error.message));
          }
        };

        workerRef.current?.addEventListener('message', handler);

        workerRef.current?.postMessage({
          id: messageId,
          type: 'SEPARATE_AUDIO',
          payload: {
            audioSegments,
            chunkIndex,
            totalChunks,
          },
        });
      });
    },
    [initializeWorker]
  );

  // Prekini procesiranje
  const cancel = useCallback(() => {
    workerRef.current?.postMessage({
      type: 'CANCEL',
    });
  }, []);

  // Očisti worker
  const cleanup = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
  }, []);

  return {
    loadModel,
    separateAudio,
    cancel,
    cleanup,
    progress,
    isLoading,
  };
}
```

---

## 5. Primjer korištenja u React komponenti

### File: `src/components/SeparationEngine/SeparationEngine.tsx`

```typescript
import React, { useCallback } from 'react';
import { useSeparation } from '@/hooks/useSeparation';

export function SeparationEngine() {
  const { loadModel, separateAudio, progress, isLoading, cleanup } = useSeparation();

  const handleSeparate = useCallback(async () => {
    try {
      // Korak 1: Učitaj model u worker
      await loadModel('/models/mdx-net.onnx', true);

      // Korak 2: Pripremi audio segmente
      const audioSegments = [
        {
          id: '0',
          channelData: new Float32Array([/* audio data */]),
          sampleRate: 44100,
        },
        // ... više segmenata
      ];

      // Korak 3: Pokreni separaciju
      const result = await separateAudio(audioSegments, 0, 1);

      console.log('Separation complete:', result);
    } catch (error) {
      console.error('Separation failed:', error);
    } finally {
      cleanup();
    }
  }, [loadModel, separateAudio, cleanup]);

  return (
    <div>
      <button onClick={handleSeparate} disabled={isLoading}>
        Separate Audio
      </button>

      {progress && (
        <div>
          <p>{progress.message}</p>
          <progress value={progress.percentage} max="100" />
        </div>
      )}
    </div>
  );
}
```

---

## 6. Best Practices

### ✅ Što trebaš raditi

- **Uvijek** inicijalizuj worker prije korištenja
- **Passaj** samo strukturirane podatke (ArrayBuffer, TypedArray)
- **Emit progress** redovito kako korisnik vidi napredak
- **Cleanup** worker kada je gotov (`.terminate()`)
- **Error handling** za mrežne greške i OOM situacije

### ❌ Što NE trebaš raditi

- Ne passaj DOM objekte ili closure-ove
- Ne drži worker pokrenuta duže nego što trebaš
- Ne kreiraj previše worker-a odjednom (max 4-8)
- Ne ignorira `onmessage` error slučajeve

---

## 7. Debugging Web Workera

### Chrome DevTools
1. Otvori DevTools (F12)
2. Idi na **Sources** tab
3. U lijevoj panel, pronađi **Workers**
4. Odaberi worker i postavi breakpoints

### Logging
```typescript
// U worker-u
console.log('Worker log:', data); // Vidiš u DevTools
self.postMessage({ type: 'DEBUG', data });
```

### Performance Monitoring
```typescript
// U main thread-u
const startTime = performance.now();
const result = await separateAudio(...);
const elapsed = performance.now() - startTime;
console.log(`Audio separation took ${elapsed}ms`);
```

