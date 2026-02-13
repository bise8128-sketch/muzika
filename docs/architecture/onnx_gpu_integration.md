# ONNX Runtime Web & GPU Acceleration Integration Guide

## 1. ONNX Runtime Web Osnove

ONNX (Open Neural Network Exchange) je format koji omogućuje pokretanje AI modela bez vezanosti na specifičan framework.

```
PyTorch Model (.pt)  ──┐
TensorFlow Model (.pb)┤  → Convert → ONNX Model (.onnx) → ONNX Runtime
Custom Model ─────────┘

ONNX Runtime Web → JavaScript API → GPU/CPU Execution
```

### Što je ONNX Runtime Web?

- Runtime koji izvršava ONNX modele u JavaScript/TypeScript
- Podrška za WebGPU (GPU), WebAssembly (CPU), i WASM+SIMD
- Automatska optimizacija za različite execution providere
- Kompatibilan sa svim ONNX modelima (MDX-Net, Demucs, BS-RoFormer)

---

## 2. Instalacija i Setup

### Instalacija paketa

```bash
npm install onnxruntime-web
npm install -D @types/onnxruntime-web

# Za WebGPU podrsku (opciono, já je uključeno)
npm install onnxruntime-web-latest # Latest verzija sa WebGPU
```

### Konfiguracija Next.js (next.config.js)

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Omogući WebAssembly
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Konfiguracija WASM datoteka
    config.output.webassemblyModuleFilename =
      isServer
        ? '../static/wasm/[modulehash].wasm'
        : 'static/wasm/[modulehash].wasm';

    // WASM loader
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    });

    // Web Worker loader
    config.module.rules.push({
      test: /\.worker\.(ts|js)$/,
      loader: 'worker-loader',
      options: {
        filename: 'static/[hash].worker.js',
      },
    });

    return config;
  },

  // Omogući statički WASM fajlove
  staticPageGenerationTimeout: 1000,
};

module.exports = nextConfig;
```

### Postavi WASM datoteke

```bash
# ONNX Runtime WASM datoteke trebaju biti dostupne
# Obično su u node_modules/onnxruntime-web/dist/

# Kreiraj symbolic link ili copy:
mkdir -p public/wasm
cp node_modules/onnxruntime-web/dist/*.wasm public/wasm/
```

---

## 3. Konfiguracija Execution Providera

### WebGPU (Preporučeno - za NVIDIA, AMD, Intel GPU)

```typescript
import * as ort from 'onnxruntime-web';

// Konfiguracija za WebGPU
export async function initializeONNX(useGPU: boolean = true) {
  try {
    // Detektuj GPU support
    const hasWebGPU = !!(navigator as any).gpu;

    if (useGPU && hasWebGPU) {
      // WebGPU execution provider
      ort.env.wasm.wasmPaths = '/wasm/'; // Putanja do WASM datoteka
      ort.env.wasm.numThreads = navigator.hardwareConcurrency || 4;
      ort.env.wasm.simdSupported = true;

      console.log('✅ WebGPU initialized');
      return 'webgpu';
    } else {
      // Fallback na WASM
      ort.env.wasm.wasmPaths = '/wasm/';
      ort.env.wasm.numThreads = navigator.hardwareConcurrency || 4;

      console.log('⚠️  Using WASM instead of WebGPU');
      return 'wasm';
    }
  } catch (error) {
    console.error('ONNX initialization failed:', error);
    throw error;
  }
}
```

### WebGL2 (Fallback - Stariji browseri)

```typescript
// Ako WebGPU nije dostupan, koristi WebGL2
const executionProviders = [
  'webgl', // Older GPU API
  'wasm', // CPU fallback
];

const session = await ort.InferenceSession.create(modelPath, {
  executionProviders: executionProviders,
});
```

### CPU (WASM+SIMD - Za sve)

```typescript
const executionProviders = ['wasm']; // CPU-only, ali brže s SIMD

const session = await ort.InferenceSession.create(modelPath, {
  executionProviders: executionProviders,
  graphOptimizationLevel: 'all',
});
```

### Priority redoslijed

```typescript
const executionProviders = [
  'webgpu', // Primjer: NVIDIA RTX 3080 - vrlo brzo
  'webgl', // Fallback: Intel iGPU - brže
  'wasm', // CPU s SIMD - standardno
];

const session = await ort.InferenceSession.create(modelPath, {
  executionProviders: executionProviders,
  graphOptimizationLevel: 'all',
});

console.log('Usando:', session.executionProviders); // Prikaži što se koristi
```

---

## 4. Model Formatiranje za ONNX

### Konverzija iz PyTorch

```python
# convert_to_onnx.py
import torch
import onnx
from mdx_net_model import MDXNet

# Učitaj PyTorch model
model = MDXNet()
model.load_state_dict(torch.load('mdx-net-weights.pt'))
model.eval()

# Kreiraj dummy input
dummy_input = torch.randn(1, 2, 16384, 128) # Batch, Channels, Time, Freq

# Eksportiraj u ONNX
torch.onnx.export(
    model,
    dummy_input,
    'mdx-net.onnx',
    input_names=['input'],
    output_names=['vocals', 'instrumentals'],
    opset_version=13,
    do_constant_folding=True,
    export_params=True,
)

print("✅ Model exported to mdx-net.onnx")
```

### Quantizacija modela (smanjenje veličine)

```python
# quantize_model.py
import onnx
from onnxruntime.quantization import quantize_dynamic

# Učitaj ONNX model
onnx_model_path = 'mdx-net.onnx'

# Kvantizacija (FP32 → INT8)
quantize_dynamic(
    onnx_model_path,
    'mdx-net-int8.onnx',
    weight_type=QuantType.QInt8,
)

# Rezultat: 145 MB → ~40 MB (3.6x manji!)
```

### FP16 kvantizacija (za malo manji gubitak preciznosti)

```python
from onnxruntime.transformers import optimizer
from onnxruntime.quantization import quantize_dynamic, QuantType

# Optimizacija
optimizer.optimize_model(
    'mdx-net.onnx',
    model_type='bert',
    num_heads=12,
    hidden_size=768,
    optimization_options=OptimizationOptions(enable_embed_layer_norm=True)
)

# FP32 → FP16
quantize_dynamic(
    'mdx-net.onnx',
    'mdx-net-fp16.onnx',
    weight_type=QuantType.QFloat16,
)
```

---

## 5. Inference implementacija

### Osnovna inference

```typescript
import * as ort from 'onnxruntime-web';
import { Tensor } from 'onnxruntime-web';

export async function runInference(
  session: ort.InferenceSession,
  audioData: Float32Array,
  sampleRate: number
) {
  try {
    // Pripremi input tensor
    // Audio spectrogram obično: [batch, channels, time, frequency]
    const inputTensor = new Tensor('float32', audioData, [1, 2, 512, 128]);

    // Pokreni model
    const outputs = await session.run({
      input: inputTensor, // Prilagodi po modelu
    });

    // Ekstrahira rezultate
    const vocals = outputs['vocals'] as Tensor;
    const instrumentals = outputs['instrumentals'] as Tensor;

    // Konvertuj u Float32Array
    const vocalsData = new Float32Array(vocals.data as ArrayBuffer);
    const instrumentalsData = new Float32Array(
      instrumentals.data as ArrayBuffer
    );

    // Oslobodi memoriju
    inputTensor.dispose();
    vocals.dispose();
    instrumentals.dispose();

    return {
      vocals: vocalsData,
      instrumentals: instrumentalsData,
    };
  } catch (error) {
    console.error('Inference failed:', error);
    throw error;
  }
}
```

### Batch processing sa chunking-om

```typescript
export async function processAudioInChunks(
  session: ort.InferenceSession,
  audioBuffer: AudioBuffer,
  chunkDuration: number = 30, // sekundi
  onProgress?: (percent: number) => void
) {
  const sampleRate = audioBuffer.sampleRate;
  const chunkSamples = chunkDuration * sampleRate;
  const totalSamples = audioBuffer.length;
  const numChunks = Math.ceil(totalSamples / chunkSamples);

  const vocalsChunks: Float32Array[] = [];
  const instrumentalsChunks: Float32Array[] = [];

  for (let i = 0; i < numChunks; i++) {
    const start = i * chunkSamples;
    const end = Math.min(start + chunkSamples, totalSamples);

    const chunk = audioBuffer.getChannelData(0).slice(start, end);

    // Pokreni inference na chunk-u
    const result = await runInference(session, chunk, sampleRate);

    vocalsChunks.push(result.vocals);
    instrumentalsChunks.push(result.instrumentals);

    // Progress update
    if (onProgress) {
      onProgress(Math.round(((i + 1) / numChunks) * 100));
    }
  }

  // Kombinira sve chunk-e
  return mergeChunks(vocalsChunks, instrumentalsChunks);
}
```

---

## 6. GPU Memory Management

### Allocacija i dealokacija

```typescript
export class GPUMemoryManager {
  private activeTensors: Tensor[] = [];
  private maxMemoryMB: number = 2048; // 2GB limit

  allocateTensor(data: Float32Array, shape: number[]): Tensor {
    const tensor = new ort.Tensor('float32', data, shape);
    this.activeTensors.push(tensor);

    const estimatedMB = (data.byteLength / 1024 / 1024).toFixed(2);
    console.log(`Allocated ${estimatedMB}MB - Total tensors: ${this.activeTensors.length}`);

    return tensor;
  }

  releaseTensor(tensor: Tensor): void {
    tensor.dispose();
    this.activeTensors = this.activeTensors.filter((t) => t !== tensor);
    console.log(`Released tensor - Remaining: ${this.activeTensors.length}`);
  }

  releaseAll(): void {
    this.activeTensors.forEach((t) => t.dispose());
    this.activeTensors = [];
    console.log('All tensors released');
  }

  getCurrentUsage(): string {
    const totalSize = this.activeTensors.reduce(
      (sum, t) => sum + (t.data?.byteLength || 0),
      0
    );
    return (totalSize / 1024 / 1024).toFixed(2) + 'MB';
  }
}
```

### GPU Memory Leak Prevention

```typescript
export async function safeInference(
  session: ort.InferenceSession,
  audioData: Float32Array
) {
  const memoryManager = new GPUMemoryManager();

  try {
    const inputTensor = memoryManager.allocateTensor(audioData, [1, 2, 512, 128]);

    const outputs = await session.run({
      input: inputTensor,
    });

    const vocalsData = new Float32Array(outputs['vocals'].data as ArrayBuffer);
    const instrumentalsData = new Float32Array(
      outputs['instrumentals'].data as ArrayBuffer
    );

    // Oslobodi sve
    memoryManager.releaseTensor(inputTensor);
    Object.values(outputs).forEach((tensor) => {
      if (tensor instanceof Tensor) {
        tensor.dispose();
      }
    });

    return { vocalsData, instrumentalsData };
  } catch (error) {
    // Osiguraj očištavanje i pri greški
    memoryManager.releaseAll();
    throw error;
  }
}
```

---

## 7. Monitoring i Debugging

### Performance Monitoring

```typescript
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  start(label: string): () => void {
    const startTime = performance.now();

    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;

      if (!this.metrics.has(label)) {
        this.metrics.set(label, []);
      }

      this.metrics.get(label)!.push(duration);

      console.log(`${label}: ${duration.toFixed(2)}ms`);
    };
  }

  getStats(label: string) {
    const times = this.metrics.get(label) || [];
    if (times.length === 0) return null;

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);

    return {
      avg: avg.toFixed(2) + 'ms',
      min: min.toFixed(2) + 'ms',
      max: max.toFixed(2) + 'ms',
      count: times.length,
    };
  }
}
```

### Primjer korištenja

```typescript
const monitor = new PerformanceMonitor();

const endInference = monitor.start('inference');
const result = await runInference(session, audioData, 44100);
endInference();

console.log('Inference stats:', monitor.getStats('inference'));
// Output: { avg: '245.32ms', min: '240.15ms', max: '250.80ms', count: 5 }
```

### Debug Network API

```typescript
export async function checkONNXSupport() {
  const report = {
    webgpu: (navigator as any).gpu ? '✅ Available' : '❌ Not available',
    webgl: document.createElement('canvas').getContext('webgl2')
      ? '✅ Available'
      : '❌ Not available',
    wasm: typeof WebAssembly !== 'undefined' ? '✅ Available' : '❌ Not available',
    hardwareConcurrency: navigator.hardwareConcurrency || 'Unknown',
    deviceMemory: (navigator as any).deviceMemory || 'Unknown',
    platform: navigator.platform,
    userAgent: navigator.userAgent,
  };

  console.table(report);
  return report;
}
```

---

## 8. Primjer Kompletan Setup

### File: `src/utils/ml/onnxSetup.ts`

```typescript
import * as ort from 'onnxruntime-web';

export async function setupONNXRuntime() {
  // 1. Inicijalizuj WASM putanje
  ort.env.wasm.wasmPaths = '/wasm/';
  ort.env.wasm.numThreads = navigator.hardwareConcurrency || 4;

  // 2. Detektuj GPU support
  const hasWebGPU = !!(navigator as any).gpu;

  // 3. Postavi execution provajdere
  const executionProviders = hasWebGPU
    ? ['webgpu', 'wasm'] // Preferiraj GPU
    : ['wasm']; // Koristi CPU

  console.log('📊 ONNX Runtime Setup:');
  console.log('  - Execution Provider:', executionProviders[0]);
  console.log('  - Hardware Threads:', ort.env.wasm.numThreads);
  console.log('  - WASM Paths:', ort.env.wasm.wasmPaths);

  return { executionProviders, hasWebGPU };
}

export async function createSession(
  modelPath: string,
  executionProviders: string[]
): Promise<ort.InferenceSession> {
  try {
    console.log(`Loading model from: ${modelPath}`);

    const session = await ort.InferenceSession.create(modelPath, {
      executionProviders,
      graphOptimizationLevel: 'all',
    });

    console.log(`✅ Session created with provider: ${session.executionProviders}`);
    return session;
  } catch (error) {
    console.error('Failed to create session:', error);
    throw error;
  }
}
```

---

## 9. Troubleshooting

| Problem | Razlog | Rješenje |
|---------|--------|---------|
| "WebGPU not available" | Stariji browser | Koristi Chrome 113+, Edge 113+, ili --enable-features flag |
| Out of Memory | Veliki audio file | Koristi chunking (30s segmenti) |
| Slow inference | WASM umjesto GPU | Provjerite WebGPU support; testira sa `checkONNXSupport()` |
| Model not found | Netačna putanja | Provjeri `/public/wasm/` i model datoteke |
| "WASM not loading" | Krivi MIME type | Server mora vratiti `application/wasm` za `.wasm` datoteke |

