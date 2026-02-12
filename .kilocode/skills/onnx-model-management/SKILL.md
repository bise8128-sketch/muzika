---
name: onnx-model-management
description: Manage ONNX machine learning models for audio processing. Use when user asks to download, configure, or manage ML models for the karaoke application.
metadata:
  category: ml-operations
  source:
    repository: https://github.com/kilo-code/skills
    path: onnx-model-management
---

# ONNX Model Management

Manage and configure ONNX models for audio source separation and other ML tasks in the Muzika karaoke application.

## Quick Start

### Model Selection

The app supports multiple ONNX models for audio separation:

```typescript
// Available models from constants
import { AVAILABLE_MODELS } from '@/constants/models';

// htdemucs_ft - High quality Demucs
// mdx-net-inst-v1 - MDX-Net for instrumental
// mdx-net-vocal - MDX-Net for vocals
```

### Loading a Model

```typescript
import { ModelManager } from '@/utils/ml/modelManager';

const manager = new ModelManager();

// Check if model is cached
const isCached = await manager.isModelCached('htdemucs_ft');

// Download model if needed
if (!isCached) {
  await manager.downloadModel('htdemucs_ft', (progress) => {
    console.log(`Downloaded ${progress}%`);
  });
}

// Load model for inference
const model = await manager.loadModel('htdemucs_ft', {
  device: 'webgpu',
  executionProvider: 'webgpu'
});
```

## Model Configuration

### WebGPU (Recommended)

Best performance for modern browsers:

```typescript
const session = await ort.InferenceSession.create(modelPath, {
  executionProviders: ['webgpu'],
  graphOptimizationLevel: 'all'
});
```

### WebGL (Fallback)

For browsers without WebGPU:

```typescript
const session = await ort.InferenceSession.create(modelPath, {
  executionProviders: ['webgl'],
  graphOptimizationLevel: 'all'
});
```

### WebAssembly (Final Fallback)

Universal compatibility:

```typescript
const session = await ort.InferenceSession.create(modelPath, {
  executionProviders: ['wasm'],
  intraOpNumThreads: navigator.hardwareConcurrency || 4,
  interOpNumThreads: 2
});
```

## Key Files

- [`audio-karaoke-app/src/utils/ml/modelManager.ts`](audio-karaoke-app/src/utils/ml/modelManager.ts) - Model loading/caching
- [`audio-karaoke-app/src/utils/ml/onnxSetup.ts`](audio-karaoke-app/src/utils/ml/onnxSetup.ts) - ONNX Runtime initialization
- [`audio-karaoke-app/src/utils/ml/modelDownloader.ts`](audio-karaoke-app/src/utils/ml/modelDownloader.ts) - Model download utility
- [`audio-karaoke-app/src/constants/models.ts`](audio-karaoke-app/src/constants/models.ts) - Model configurations
- [`audio-karaoke-app/src/components/ModelManager/ModelManager.tsx`](audio-karaoke-app/src/components/ModelManager/ModelManager.tsx) - UI component

## Model Storage

Models are cached in IndexedDB for offline use:

```typescript
import { modelStorage } from '@/utils/storage/modelStorage';

// Check storage
const storageInfo = await modelStorage.getStorageInfo();
console.log(`Using ${storageInfo.used} of ${storageInfo.quota} bytes`);
```

## Troubleshooting

### Model Download Failures

1. Check network connectivity
2. Verify CORS settings on model CDN
3. Clear IndexedDB and retry

### Inference Errors

- Ensure WebGPU/WebGL is available
- Check memory constraints
- Verify model format compatibility

### Memory Management

Models can consume significant memory:
- Unload unused models
- Use smaller models for longer audio
- Monitor with `performance.memory` API
