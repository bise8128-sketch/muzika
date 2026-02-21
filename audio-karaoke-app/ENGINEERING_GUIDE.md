# Muzika Engineering Guide

This guide outlines the technical architecture, development standards, and performance optimization strategies for the Muzika audio-karaoke application.

## 1. Technical Architecture Overview

Muzika leverages a multi-threaded architecture to handle high-performance audio processing and visualization without blocking the main UI thread.

- **Main Thread**: React (Next.js) for UI, state management (Zustand/XState), and coordinating workers.
- **Web Workers**: Off-thread processing for heavy tasks:
  - `visualizer.worker.ts`: OffscreenCanvas rendering for high-frequency updates.
  - `pitchAnalysis.worker.ts`: ONNX Runtime (WASM) for vocal track analysis.
  - `ffmpeg.worker.ts`: Client-side audio transcoding and exporting.
- **Audio Worklets**: Low-latency, real-time audio processing in the `AudioContext` render quantum.
  - `audioWorkletProcessor.ts`: Base processor with performance monitoring.
  - `pitchDetector.worklet.ts`: Real-time pitch detection.

## 2. Dependency Management & WASM

The project uses several libraries that rely on WASM and external JS binaries (ffmpeg, ONNX). These are managed through a specific pattern in `next.config.ts`.

### WASM Asset Serving

We use `CopyWebpackPlugin` to copy required assets from `node_modules` to the `public/` directory during build/dev.

```typescript
// next.config.ts snippet
new CopyWebpackPlugin({
  patterns: [
    { from: 'node_modules/onnxruntime-web/dist/*.{wasm,mjs}', to: 'public/wasm/[name][ext]' },
    { from: 'node_modules/@ffmpeg/core/dist/esm/*.{js,wasm}', to: 'public/ffmpeg/[name][ext]' },
  ],
})
```

> [!IMPORTANT]
> Never import WASM files directly into components. Always reference them via the public URL (e.g., `/wasm/ort-wasm-simd.wasm`) or configure the library (like `onnxruntime-web`) to look in `/wasm/`.

## 3. Version Control & Large Files

Handling large model files (ONNX, weights) requires a balance between developer experience and repository health.

### Git LFS vs. External Storage

- **Git LFS**: Recommended for files between 10MB and 100MB that are critical for the application's basic functionality. This ensures the repo remains cloneable while keeping history manageable.
- **External Storage (S3/GCS)**: Use for models > 100MB or dynamic datasets. Reference these via a `manifest.json` and a downloader utility that handles progress tracking and IndexedDB caching.

> [!TIP]
> Use `.gitattributes` to track `.wasm` and `.onnx` files via LFS:
> `*.onnx filter=lfs diff=lfs merge=lfs -text`

## 4. Performance Optimization

### Audio Worklet Best Practices

The `process()` method in an `AudioWorkletProcessor` runs in a real-time thread. Avoid **garbage collection** at all costs.

- **Pre-allocate Buffers**: Initialize `Float32Array` or `RingBuffer` in the constructor.
- **No Object Allocation**: Do not create new objects `{}`, arrays `[]`, or strings inside `process()`.
- **Minimal Logic**: Compute only what is necessary for the current 128-sample quantum.

### Memory Management (ML & WASM)

ONNX Runtime sessions can consume significant memory.

- **Singleton Workers**: Keep ML models in long-lived Web Workers to avoid re-loading weights.
- **Explicit Release**: Call `session.release()` (if available/needed) when a component or worker is destroyed.
- **IndexedDB**: Large model files are cached in IndexedDB to minimize network overhead on subsequent loads.

### React Rendering

High-frequency visualizers can cause excessive re-renders.

- **OffscreenCanvas**: Always use `visualizer.worker.ts` for rendering visualizers to keep the main thread free for UI interactions.
- **Zustand Selectors**: Use granular selectors to prevent components from re-rendering on unrelated state changes.

### Profiling with React DevTools

- **Identify "Flame" Spikes**: Look for frequent re-renders in visualizer components. If a component re-renders every 16ms (60fps) but doesn't manage DOM state, move that logic into an `Effect` or the Worker.
- **Record Interactions**: Profile while playing audio/singing to see how the synchronous game engine interacts with the React tree.

## 5. Safe Refactoring

### TypeScript Strictness

The codebase enforces `strict: true` in `tsconfig.json`.

- **Internal Types**: Keep domain-specific types in `src/types/` or co-locate with the relevant module.
- **Discriminated Unions**: Use for complex states (e.g., Audio playback states, Model loading states).

### Component Decomposition

Large modules like `KaraokeDisplay.tsx` should be broken down into:

- **Presentation Components**: Pure functional components for layout.
- **Logic Hooks**: Custom hooks for managing specific features (e.g., `useKaraokeEngine`, `useVisualizerPort`).

## 6. Debugging & Troubleshooting

### Root Cause Analysis

1. **Is it the Main Thread?**: Check if the issue persists when expensive components are disabled. Use Chrome Performance tab to identify long tasks (>50ms).
2. **Is it the Worker?**: Use helper logs with thread prefixes (e.g., `[VISUALIZER_WORKER]`). Check `chrome://inspect/#workers` to debug worker-specific memory issues.
3. **Is it the Worklet?**: Monitor `metrics` sent from `audioWorkletProcessor.ts`. If `cpuUsage > 80%`, the worklet is likely dropping frames.

### Logging

- **LogRocket**: Used for session replay and capturing thread-safe errors. Great for "time-traveling" through state changes that led to an audio glitch.
- **Sentry**: Captures crashes across both SSR and Client-side. Ensure `Sentry.init` is configured for both the main app and dedicated workers where possible.

## 7. Automated Testing

- **Jest**: For unit logic (math, state machines, utility functions).
- **Playwright**: For E2E testing.
  - **Specialized Audio Tests**: Playwright can simulate user interaction with the `AudioContext` and verify visual output via canvas snapshots.

---

*Created by Antigravity - Muzika Engineering Team*
