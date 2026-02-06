# MP3 Download Fix Plan

## Problem Analysis

Based on analysis of the codebase, the MP3 download functionality uses FFmpeg.wasm via a Web Worker to convert AudioBuffer to MP3 format. Several potential issues have been identified that could cause MP3 downloads to fail.

## Identified Issues

### 1. Worker URL Resolution Issue

**File:** [`audio-karaoke-app/src/utils/audio/audioExporter.ts:113`](audio-karaoke-app/src/utils/audio/audioExporter.ts:113)

The worker is created using:

```typescript
const worker = new Worker(new URL('./mp3.worker.ts', import.meta.url));
```

This may fail in certain Next.js environments due to bundling complexities.

### 2. FFmpeg UMD Loading Issues

**File:** [`audio-karaoke-app/src/utils/audio/mp3.worker.ts:59`](audio-karaoke-app/src/utils/audio/mp3.worker.ts:59)

The worker uses `importScripts` to load FFmpeg:

```typescript
importScripts(`${baseUrl}/ffmpeg.js`);
```

Potential failures:

- Incorrect baseUrl computation
- Files not properly copied to public directory
- CORS issues preventing script loading
- Module resolution conflicts

### 3. SharedArrayBuffer/Cross-Origin Isolation

**File:** [`audio-karaoke-app/next.config.ts:90-96`](audio-karaoke-app/next.config.ts:90-96)

FFmpeg.wasm requires `SharedArrayBuffer` which needs specific COOP/COEP headers:

```typescript
{
  key: "Cross-Origin-Embedder-Policy",
  value: "require-corp",
},
{
  key: "Cross-Origin-Opener-Policy",
  value: "same-origin",
}
```

These headers may not be properly enforced in all deployment environments.

### 4. Worker Termination Race Conditions

**File:** [`audio-karaoke-app/src/utils/audio/audioExporter.ts:128-132`](audio-karaoke-app/src/utils/audio/audioExporter.ts:128-132)

The worker is terminated immediately after success/error:

```typescript
worker.terminate();
resolve(new Blob([payload], { type: 'audio/mpeg' }));
```

This could cause issues if multiple exports are triggered quickly.

### 5. Limited Error Handling

**File:** [`audio-karaoke-app/src/utils/audio/mp3.worker.ts:77-79`](audio-karaoke-app/src/utils/audio/mp3.worker.ts:77-79)

Error messages are generic:

```typescript
} catch (error: any) {
    self.postMessage({ type: 'ERROR', payload: error.message });
}
```

Users don't get actionable feedback about what went wrong.

### 6. Memory Management for Large Files

Large audio files could cause memory issues during WAV to MP3 conversion, especially on devices with limited RAM.

### 7. Browser Compatibility

Some browsers may have issues with the worker implementation or SharedArrayBuffer support.

## Proposed Solutions

### Solution 1: Fix Worker URL Resolution

- Use a more robust worker initialization method
- Add fallback mechanisms for different environments
- Ensure worker file is properly bundled

### Solution 2: Improve FFmpeg Loading

- Add better error handling for FFmpeg initialization
- Verify file existence before loading
- Add retry logic for failed loads
- Provide better error messages

### Solution 3: Strengthen Cross-Origin Isolation

- Verify headers are properly set
- Add environment detection
- Provide fallback for environments without SharedArrayBuffer support

### Solution 4: Implement Worker Pool

- Create a worker pool to avoid termination overhead
- Reuse workers for multiple exports
- Add proper cleanup on component unmount

### Solution 5: Enhanced Error Handling

- Add detailed error types and messages
- Provide user-friendly error descriptions
- Add logging for debugging
- Implement error recovery suggestions

### Solution 6: Memory Optimization

- Add file size checks before processing
- Implement chunked processing for large files
- Add memory usage monitoring
- Provide warnings for large files

### Solution 7: Browser Compatibility Layer

- Add feature detection for SharedArrayBuffer
- Provide fallback for unsupported browsers
- Add browser-specific workarounds

## Implementation Plan

### Phase 1: Core Fixes (High Priority)

1. Fix worker URL resolution in [`audioExporter.ts`](audio-karaoke-app/src/utils/audio/audioExporter.ts)
2. Improve FFmpeg loading with better error handling in [`mp3.worker.ts`](audio-karaoke-app/src/utils/audio/mp3.worker.ts)
3. Add detailed error messages and user feedback

### Phase 2: Robustness Improvements (Medium Priority)

4. Implement worker pool for better resource management
2. Add file size validation and warnings
3. Improve error recovery mechanisms

### Phase 3: Advanced Features (Low Priority)

7. Add progress reporting for long conversions
2. Implement chunked processing for very large files
3. Add browser compatibility layer

## Files to Modify

1. [`audio-karaoke-app/src/utils/audio/audioExporter.ts`](audio-karaoke-app/src/utils/audio/audioExporter.ts)
   - Fix worker initialization
   - Add error handling
   - Implement worker pool

2. [`audio-karaoke-app/src/utils/audio/mp3.worker.ts`](audio-karaoke-app/src/utils/audio/mp3.worker.ts)
   - Improve FFmpeg loading
   - Add detailed error reporting
   - Add retry logic

3. [`audio-karaoke-app/next.config.ts`](audio-karaoke-app/next.config.ts)
   - Verify COOP/COEP headers
   - Add additional security headers if needed

4. [`audio-karaoke-app/src/app/[locale]/page.tsx`](audio-karaoke-app/src/app/[locale]/page.tsx)
   - Add error handling for download failures
   - Add user feedback for download status

5. [`audio-karaoke-app/src/components/SeparationEngine/ResultsDisplay.tsx`](audio-karaoke-app/src/components/SeparationEngine/ResultsDisplay.tsx)
   - Add loading states for MP3 downloads
   - Add error display

## Testing Strategy

1. Test MP3 download with various file sizes (small, medium, large)
2. Test in different browsers (Chrome, Firefox, Safari, Edge)
3. Test in different environments (development, production, Vercel)
4. Test with rapid successive downloads
5. Test error scenarios (invalid files, network issues, memory limits)

## Success Criteria

- MP3 downloads work reliably across all supported browsers
- Users receive clear error messages when downloads fail
- Large files can be downloaded without memory issues
- Multiple downloads can be performed without issues
- Error recovery is possible for common failure scenarios
