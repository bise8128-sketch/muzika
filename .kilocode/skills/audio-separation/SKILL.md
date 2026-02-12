---
name: audio-separation
description: Handle audio source separation using ONNX models. Use when user asks to separate audio tracks, extract vocals, remove vocals, split stems, or process audio with Demucs/MDX models.
metadata:
  category: audio-processing
  source:
    repository: https://github.com/kilo-code/skills
    path: audio-separation
---

# Audio Source Separation

Process audio files to separate vocals from instrumentals using ONNX-based machine learning models.

## Quick Start

### Local Browser Processing (Primary)

The application uses WebGPU/WebAssembly for in-browser separation:

```typescript
// Import the separation utility
import { separateAudio } from '@/utils/ml/separateAudio';

// Process audio file
const result = await separateAudio(audioFile, {
  model: 'htdemucs_ft',  // Model to use
  stems: ['vocals', 'bass', 'drums', 'other'],  // Output stems
  device: 'webgpu'  // 'webgpu' | 'cpu' | 'wasm'
});
```

### Available Models

- `htdemucs_ft` - High quality Demucs model (best results)
- `mdx-net-inst-v1` - MDX-Net for instrumental extraction
- `mdx-net-vocal` - MDX-Net for vocal extraction

### Server-Side Processing (Fallback)

For heavy processing, use the backend API:

```bash
# Upload audio for separation
curl -X POST https://your-backend.com/api/python-processing \
  -F "file=@audio.mp3" \
  -F "model=htdemucs_ft"
```

## Configuration

### WebGPU Strategy (Recommended)

The app uses ONNX Runtime Web with WebGPU acceleration:

```typescript
// Check WebGPU availability
import { initWebGPU } from '@/utils/ml/onnxSetup';

const gpuAvailable = await initWebGPU();
```

### Fallback to WebGL/WASM

If WebGPU is unavailable, the system automatically falls back to:
1. WebGL
2. WebAssembly (SIMD + threading)

## Implementation Details

### Key Files

- [`audio-karaoke-app/src/utils/ml/separateAudio.ts`](audio-karaoke-app/src/utils/ml/separateAudio.ts) - Main separation logic
- [`audio-karaoke-app/src/utils/ml/inference/`](audio-karaoke-app/src/utils/ml/inference/) - Inference strategies
- [`audio-karaoke-app/src/utils/ml/inference/webgpuStrategy.ts`](audio-karaoke-app/src/utils/ml/inference/webgpuStrategy.ts) - WebGPU implementation
- [`audio-karaoke-app/src/utils/ml/inference/spectralStrategy.ts`](audio-karaoke-app/src/utils/ml/inference/spectralStrategy.ts) - Spectral processing

### Processing Pipeline

1. **Audio Decoding** - Convert file to audio buffer
2. **Preprocessing** - Apply STFT to convert to frequency domain
3. **Model Inference** - Run ONNX model on GPU/CPU
4. **Postprocessing** - Convert back to time domain
5. **Stem Export** - Save separated stems as WAV files

## Troubleshooting

### Out of Memory

If you encounter OOM errors:
- Reduce batch size
- Use smaller model (mdx-net instead of htdemucs_ft)
- Process shorter audio segments

### WebGPU Not Available

Check browser compatibility:
- Chrome 113+ with WebGPU flag enabled
- Edge 113+
- Firefox Nightly with webgpu.enabled

### Model Loading Failures

Ensure models are cached in IndexedDB:
- Check `ModelManager` component
- Verify model downloads in `modelStorage.ts`
