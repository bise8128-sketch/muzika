# API Specifikacija - Audio Separacija i Obrada

## 1. Audio Separacijski API

### `separateAudio(file: File, options?: SeparationOptions): Promise<SeparationResult>`

Glavna funkcija za razdvajanje audio izvora.

**Parametri:**
```typescript
interface SeparationOptions {
  modelType?: 'mdx-net' | 'demucs' | 'bs-roformer'; // Default: 'mdx-net'
  chunkSize?: number; // Default: 30 sekundi
  useCache?: boolean; // Default: true
  onProgress?: (progress: ProcessingProgress) => void;
  gpuAcceleration?: boolean; // Default: true ako dostupno
}

interface SeparationResult {
  vocals: AudioBuffer;
  instrumentals: AudioBuffer;
  metadata: {
    modelUsed: string;
    processingTime: number;
    fileSize: number;
    duration: number;
  };
}

interface ProcessingProgress {
  phase: 'loading-model' | 'segmenting' | 'separating' | 'merging';
  currentSegment: number;
  totalSegments: number;
  percentage: number;
  message: string;
}
```

**Primjer korištenja:**
```typescript
import { separateAudio } from '@/utils/ml/inference';

const handleSeparation = async (file: File) => {
  try {
    const result = await separateAudio(file, {
      modelType: 'mdx-net',
      onProgress: (progress) => {
        console.log(`${progress.percentage}% - ${progress.message}`);
        updateUI(progress);
      },
    });

    console.log('Separation complete!', result);
    return result;
  } catch (error) {
    console.error('Separation failed:', error);
  }
};
```

**Interna logika:**
```
1. Provjeri cache (IndexedDB)
   ├─ Ako postoji: vrati cached rezultat
   └─ Ako ne postoji: nastavi
2. Učitaj model (ili iz cache-a ili download)
3. Dekodira audio file (Web Audio API)
4. Podijeli audio u segmente
5. Za svaki segment:
   ├─ Run inference (ONNX Model + GPU)
   ├─ Pohrani rezultate u bufere
   └─ Emit progress event
6. Spoji segmente (crossfading)
7. Spremi u cache
8. Vrati rezultat
```

---

## 2. Model Management API

### `loadModel(modelName: string): Promise<Session>`

Učitava ONNX model s diskom ili downloadom.

**Parametri:**
```typescript
interface ModelInfo {
  name: 'mdx-net' | 'demucs' | 'bs-roformer';
  version: string;
  size: number; // u MB
  downloadUrl?: string;
  localPath?: string; // za offline
  requiredVRAM: number; // u GB
}

interface Session {
  model: ort.InferenceSession;
  info: ModelInfo;
  loaded: boolean;
  lastUsed: number;
}
```

**Primjer:**
```typescript
import { loadModel, getAvailableModels } from '@/utils/ml/modelManager';

const models = await getAvailableModels();
// Output: [{ name: 'mdx-net', size: 150, loaded: true }, ...]

const session = await loadModel('mdx-net');
console.log('Model loaded:', session.info.name);
```

### `checkModelAvailability(): Promise<ModelStatus>`

Provjerava dostupnost modela u lokalnoj pohrani.

```typescript
interface ModelStatus {
  mdxNet: { loaded: boolean; version: string; size: number };
  demucs: { loaded: boolean; version: string; size: number };
  bsRoFormer: { loaded: boolean; version: string; size: number };
  diskUsage: number; // u MB
}

const status = await checkModelAvailability();
// { mdxNet: { loaded: true, version: '1.0.1', size: 145 }, ... }
```

### `downloadModel(modelName: string): Promise<void>`

Preuzima model s interneta i pohrani lokalno.

```typescript
await downloadModel('mdx-net', {
  onProgress: (percent) => console.log(`Downloaded: ${percent}%`),
});
```

---

## 3. Audio Processing API

### `decodeAudioFile(file: File): Promise<AudioBuffer>`

Dekodira MP3, WAV, OGG datoteku.

```typescript
interface AudioBuffer {
  channelData: Float32Array[];
  sampleRate: number;
  duration: number;
  numberOfChannels: number;
}

const audioBuffer = await decodeAudioFile(audioFile);
console.log(`Audio: ${audioBuffer.duration}s @ ${audioBuffer.sampleRate}Hz`);
```

### `segmentAudio(audio: AudioBuffer, segmentDuration: number): AudioSegment[]`

Dijeli audio na segmente.

```typescript
interface AudioSegment {
  id: string;
  start: number;
  end: number;
  channelData: Float32Array[];
  duration: number;
}

const segments = segmentAudio(audioBuffer, 30); // 30-sekundni segmenti
console.log(`Created ${segments.length} segments`);
```

### `encodeAudio(channelData: Float32Array[], sampleRate: number, format: 'wav' | 'mp3'): Blob`

Kodira audio u WAV ili MP3 format.

```typescript
const vocalsBlob = encodeAudio(result.vocals.channelData, 44100, 'wav');
const downloadUrl = URL.createObjectURL(vocalsBlob);
// <a href={downloadUrl}>Download Vocals</a>
```

### `applyPitchShift(audio: AudioBuffer, semitones: number): AudioBuffer`

Pomakne tonalnost za određeni broj polustepena.

```typescript
const shiftedAudio = applyPitchShift(audioBuffer, 5); // Podigni za 5 polustepena
```

### `applyTimeStretch(audio: AudioBuffer, factor: number): AudioBuffer`

Promijeni tempo bez promjene tonalnosti.

```typescript
const fasterAudio = applyTimeStretch(audioBuffer, 1.2); // 20% brže
```

---

## 4. Karaoke Rendering API

### `renderKaraoke(instrumentals: AudioBuffer, lyrics: LyricLine[], cdgData?: CDGData): Promise<KaraokeMedia>`

Kreira karaoke produkciju.

```typescript
interface LyricLine {
  text: string;
  startTime: number; // u sekundama
  endTime: number;
  color?: string; // HEX ili rgba
  alignment?: 'center' | 'left' | 'right';
}

interface CDGData {
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
}

interface KaraokeMedia {
  audio: Blob; // WAV ili MP3
  video?: Blob; // MP4 s CD+G grafikom (opciono)
  subtitles: VTTContent;
}

const karaoke = await renderKaraoke(
  instrumentals,
  [
    { text: 'Hello world', startTime: 0, endTime: 2, color: '#FF0000' },
    { text: 'This is karaoke', startTime: 2, endTime: 4, color: '#00FF00' },
  ]
);
```

### `renderCDGGraphics(lyrics: LyricLine[], duration: number): Canvas[]`

Renderira CD+G grafiku za svaki frame (75 fps).

```typescript
const frames = renderCDGGraphics(lyrics, 120); // 120 sekundi
frames.forEach((canvas, index) => {
  // Spremi frame kao sliku
});
```

---

## 5. Cache/Storage API

### `cacheResult(fileHash: string, result: SeparationResult): Promise<void>`

Sprema rezultat u IndexedDB.

```typescript
import { cacheResult, getCachedResult } from '@/utils/storage/cacheManager';

await cacheResult('abc123hash', separationResult);
```

### `getCachedResult(fileHash: string): Promise<SeparationResult | null>`

Preuzima cachiran rezultat.

```typescript
const cached = await getCachedResult('abc123hash');
if (cached) {
  console.log('Using cached result');
  return cached;
}
```

### `clearCache(): Promise<void>`

Briše sve cachingirane podatke.

```typescript
await clearCache();
console.log('Cache cleared');
```

### `getCacheStats(): Promise<CacheStats>`

Vraća informacije o korištenju cache-a.

```typescript
interface CacheStats {
  numberOfCachedAudios: number;
  totalSize: number; // u MB
  numberOfCachedModels: number;
  oldestEntry: Date;
  newestEntry: Date;
}

const stats = await getCacheStats();
console.log(`Cache using ${stats.totalSize}MB`);
```

---

## 6. Web Worker API (Background Processing)

### Audio Separation Worker

**Primjer korištenja:**
```typescript
const worker = new Worker('/workers/audioSeparationWorker.ts');

worker.postMessage({
  type: 'SEPARATE_AUDIO',
  payload: {
    audioData: Float32Array,
    sampleRate: 44100,
    modelType: 'mdx-net',
  },
});

worker.onmessage = (event) => {
  const { type, data, progress } = event.data;
  
  if (type === 'PROGRESS') {
    console.log(`Processing: ${progress.percentage}%`);
  }
  
  if (type === 'COMPLETE') {
    console.log('Vocals:', data.vocals);
    console.log('Instrumentals:', data.instrumentals);
  }
  
  if (type === 'ERROR') {
    console.error('Separation failed:', data.error);
  }
};

worker.terminate();
```

### Model Loader Worker

```typescript
const modelWorker = new Worker('/workers/modelLoaderWorker.ts');

modelWorker.postMessage({
  type: 'LOAD_MODEL',
  payload: {
    modelName: 'mdx-net',
    useGPU: true,
  },
});

modelWorker.onmessage = (event) => {
  if (event.data.type === 'MODEL_LOADED') {
    console.log('Model ready for inference');
  }
};
```

---

## 7. Playback/Audio Context API

### `createAudioContext(audioBuffer: AudioBuffer): PlaybackController`

Kreira Audio Context za playback.

```typescript
interface PlaybackController {
  play(): void;
  pause(): void;
  stop(): void;
  setTime(seconds: number): void;
  setVolume(level: 0-1): void;
  setPlaybackRate(rate: 0.5-2.0): void;
  on(event: 'timeupdate' | 'ended' | 'play' | 'pause', callback: Function): void;
}

const controller = createAudioContext(audioBuffer);
controller.play();
controller.on('timeupdate', (time) => console.log(`Now playing: ${time}s`));
```

---

## 8. Utility Functions

### `calculateFileHash(file: File): Promise<string>`

Kreira hash datoteke za cache lookup.

```typescript
const hash = await calculateFileHash(audioFile);
// '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ae8be'
```

### `formatDuration(seconds: number): string`

Formatira vrijeme.

```typescript
formatDuration(125); // "2:05"
formatDuration(3661); // "1:01:01"
```

### `estimateMemoryUsage(audioBuffer: AudioBuffer): number`

Procjenjuje RAM potreban za separaciju.

```typescript
const estimatedMB = estimateMemoryUsage(audioBuffer);
console.log(`This will require ~${estimatedMB}MB RAM`);
```

---

## Error Handling

### Standard Error Types

```typescript
class AudioProcessingError extends Error {
  constructor(message: string, code: string) {
    this.code = code;
  }
}

// Kodovi
'INSUFFICIENT_MEMORY' // RAM iscrpljen
'UNSUPPORTED_FORMAT' // Audio format nije podržan
'MODEL_DOWNLOAD_FAILED' // Preuzimanje modela neuspješno
'WEBGPU_NOT_AVAILABLE' // WebGPU nije dostupno
'INVALID_AUDIO_FILE' // Audio datoteka je oštećena
'CACHE_ERROR' // IndexedDB greška
```

### Primjer error handlinga

```typescript
try {
  const result = await separateAudio(file);
} catch (error) {
  if (error.code === 'INSUFFICIENT_MEMORY') {
    alert('Not enough RAM. Try a shorter audio file.');
  } else if (error.code === 'WEBGPU_NOT_AVAILABLE') {
    alert('WebGPU not supported. Processing will be slow.');
  }
}
```

---

## Performance Optimizations

### Chunking Strategy
- Audio veći od 10MB se automatski chunka
- Preporučena veličina chunk-a: 30 sekundi
- Crossfading između chunk-a: 1 sekunda overlap

### GPU Memory Management
- Modeli se drže u GPU memoriji (ne prebacuju nakon svakog segmenta)
- Intermediate rezultati se čuvaju samo za trenutni segment
- Stari buferi se eksplicitno briše nakon spajanja

### Cache Eviction Policy
- LRU (Least Recently Used) za modele
- FIFO (First In First Out) za audio rezultate
- Max cache size: 1GB po defaultu (konfigurabilan)

