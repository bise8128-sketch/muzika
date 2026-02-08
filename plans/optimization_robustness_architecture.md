# Optimization & Robustness Architecture

This document outlines the technical design for improving the performance, reliability, and user experience of the Muzika Karaoke application. It focuses on three key areas: a generic Worker Pool, advanced File Validation, and a comprehensive Error Recovery strategy.

## 1. Generic Worker Pool Architecture

### Problem

Currently, the application spawns a new Web Worker (`audio.worker.ts`) for each separation task and terminates it upon completion. This approach has several drawbacks:

- **High Overhead:** Instantiating workers and loading heavy ML models (ONNX Runtime) repeatedly is expensive.
- **No Concurrency Control:** Uploading multiple files simultaneously can spawn unrestricted workers, leading to UI freezes or browser crashes due to memory exhaustion.
- **Resource Waste:** Compiled WASM modules and loaded models are discarded and reloaded unnecessarily.

### Solution: `WorkerPoolManager`

A generic, singleton `WorkerPoolManager` will act as an orchestrator for all background processing. It will manage a fixed pool of workers, queue tasks, and handle lifecycle events.

#### System Design

```mermaid
graph TD
    A[Client/UI Component] -->|Submit Task| B[WorkerPoolManager]
    B -->|Check Availability| C{Available Worker?}
    C -->|Yes| D[Assign to Worker]
    C -->|No| E[Push to Priority Queue]
    
    subgraph "Worker Pool"
        W1[Worker 1 (Active)]
        W2[Worker 2 (Idle)]
        W3[Worker 3 (Initializing)]
    end
    
    D --> W1
    D --> W2
    E -->|Worker Frees Up| D
    
    W1 -->|PostMessage| B
    B -->|Resolve Promise/Callback| A
```

#### Key Components

1. **`WorkerPool` Class**:
    - **Configuration**:
        - `minWorkers`: Minimum active workers (default: 1).
        - `maxWorkers`: Maximum concurrent workers (default: `navigator.hardwareConcurrency - 1` or fixed cap like 4).
        - `idleTimeout`: Time before an idle worker is terminated (to save memory).
    - **State**:
        - `activeWorkers`: List of currently busy workers.
        - `idleWorkers`: List of ready-to-use workers.
        - `taskQueue`: Priority queue of pending tasks.

2. **`WorkerWrapper` Class**:
    - Wraps the raw `Worker` instance.
    - Handles message correlation (matching requests to responses via IDs).
    - Monitors health and handles unexpected termination.

3. **Task Interface**:

    ```typescript
    interface WorkerTask<TPayload = any, TResult = any> {
        id: string;
        type: 'SEPARATION' | 'EXPORT' | 'ANALYSIS';
        priority: 'HIGH' | 'NORMAL' | 'LOW';
        payload: TPayload;
        transferables?: Transferable[];
        onProgress?: (progress: number) => void;
        resolve: (result: TResult) => void;
        reject: (error: Error) => void;
    }
    ```

#### Implementation Strategy

- **Worker Script**: The `audio.worker.ts` will be refactored to handle a "keep-alive" state. Instead of exiting after one job, it waits for the next `START` message.
- **Memory Management**: Workers will implement a `RESET` or `CLEANUP` message to free large buffers without terminating the thread/WASM context.

## 2. Proactive File Validation Module

### Problem

Current validation is hardcoded in `AudioUpload.tsx`. It checks file types and a static 50MB limit. This is brittle and doesn't account for:

- Device storage limitations (critical for client-side processing).
- Browser-specific constraints.
- Dynamic server-side limits (if hybrid processing is enabled).

### Solution: `ValidationService`

A unified service that runs a series of synchronous and asynchronous checks before processing begins.

#### Validation Pipeline

1. **Static Checks (Instant)**:
    - MIME type verification (using file signatures/magic numbers, not just extensions).
    - File size constraints (configurable).

2. **Environment Checks (Async)**:
    - **Storage Quota**: Use `navigator.storage.estimate()` to ensure the device has enough space for the input file, processed stems, and temporary buffers.
        - *Formula*: `Required = FileSize * 3 (Raw + PCM) + ModelOverhead`
    - **Memory Check**: Estimate available RAM (via `navigator.deviceMemory` if available, or heuristics) to warn users on low-end devices.

#### Configuration Interface

```typescript
interface ValidationConfig {
    maxFileSize: number; // e.g., 100MB
    allowedTypes: string[];
    minFreeStorage: number; // Buffer space required
    audioConstraints: {
        minDuration: number;
        maxDuration: number;
    }
}
```

#### User Feedback

- Instead of a generic error, provide specific actionable feedback:
  - *"Not enough disk space. You need 150MB free, but only have 50MB."*
  - *"File duration (15:00) exceeds the maximum allowed (10:00) for this model."*

## 3. Error Recovery & Resilience Strategy

### Problem

Network failures (model downloading) or worker crashes (OOM) currently result in a generic error state. The user loses progress and must restart.

### Solution: Resilience Layer

#### 1. Retry Logic with Exponential Backoff

For transient failures (network glitches during model download), implement a retry utility.

```typescript
async function withRetry<T>(
    fn: () => Promise<T>, 
    retries = 3, 
    baseDelay = 1000
): Promise<T> {
    try {
        return await fn();
    } catch (error) {
        if (retries === 0 || isFatal(error)) throw error;
        await delay(baseDelay * (2 ** (3 - retries))); // 1s, 2s, 4s
        return withRetry(fn, retries - 1, baseDelay);
    }
}
```

#### 2. Circuit Breaker for External Services

If the backend API or model CDN is down, the `CircuitBreaker` will "open" to fail fast and prevent resource exhaustion, potentially switching to an alternative (e.g., local-only mode or a different mirror).

#### 3. State Preservation & Recovery

Use IndexedDB to persist the *state* of the job, not just the result.

- **Job Store**:
  - `jobId`: UUID
  - `status`: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  - `progress`: 45%
  - `lastError`: string

**Recovery Flow**:

1. On app load, check `JobStore` for interrupted jobs.
2. If found, prompt user: *"You have an interrupted separation task. Resume?"*
3. If resumed, the `WorkerPool` requests the job. Since we can't "snapshot" the worker memory, we restart the process but skip already completed steps if architectural checkpoints exist (or simply restart with original parameters).

#### 4. Graceful Degradation

* **OOM Handling**: If a worker crashes (likely OOM), the pool catches the error.
  - *Action*: Restart the worker with a "Safe Mode" flag (e.g., smaller chunk sizes, disable high-res output) and retry the task.
  - *Notify*: Tell the user "Processing required more memory than available. Retrying in Low-Memory mode..."

---

## Implementation Roadmap

1. **Phase 1: Worker Pool Foundation**
    - Implement `WorkerPool` and `WorkerWrapper`.
    - Refactor `audio.worker.ts` to accept reuse.
    - Update `separateAudio.ts` to use the pool.

2. **Phase 2: Validation Hardening**
    - Implement `ValidationService`.
    - Add Storage Quota checks.
    - Update `AudioUpload.tsx` to use the service.

3. **Phase 3: Resilience**
    - Add `retry` logic to `modelDownloader`.
    - Implement global Error Boundary for React components.
    - Add "Safe Mode" retry for worker crashes.
