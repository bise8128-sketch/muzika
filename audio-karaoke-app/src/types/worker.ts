export type WorkerMessageType =
    | 'LOAD_MODEL'
    | 'SEPARATE_CHUNK'
    | 'CANCEL'
    | 'CLEAR_CACHE'
    // Karaoke Engine Messages
    | 'INIT_ENGINE'
    | 'PLAY'
    | 'PAUSE'
    | 'SYNC_TIME'
    | 'UPDATE_SETTINGS'
    | 'LYRIC_UPDATE'
    | 'CDG_READY';

export interface WorkerRequest {
    type: WorkerMessageType;
    payload?: any;
}

/**
 * Standard response types recognized by the WorkerPool.
 * - ERROR / FAILED: Task rejection
 * - PROGRESS: Intermediate progress updates (not a terminal state)
 * - Everything else: Treated as a successful task completion
 */
export type WorkerResponseType =
    | 'SUCCESS'
    | 'COMPLETED'
    | 'DONE'
    | 'ERROR'
    | 'FAILED'
    | 'PROGRESS'
    // Domain-specific success types (audio worker)
    | 'STREAM_READY'
    | 'CHUNK_PROCESSED'
    | 'COMPLETE'
    | 'CHUNK_PLAYBACK';

export interface WorkerResponse {
    type: WorkerResponseType | WorkerMessageType;
    payload?: any;
}

export interface SeparationChunkPayload {
    inputData: Float32Array;
    channels: number;
    samples: number;
    modelId: string;
    chunkIndex: number;
}

export interface InitEnginePayload {
    lrcData: any; // LRCData
    cdgData?: Uint8Array;
    canvas?: OffscreenCanvas;
    visualSettings?: any; // VisualSettings
}

// --- Worker Pool Types ---

export type TaskPriority = 'HIGH' | 'NORMAL' | 'LOW';

export interface WorkerTask<TPayload = any, TResult = any> {
    id: string;
    type: string;
    priority: TaskPriority;
    payload: TPayload;
    transferables?: Transferable[];
    onProgress?: (progress: number) => void;
    resolve: (result: TResult) => void;
    reject: (error: Error) => void;
}

export interface WorkerPoolConfig {
    minWorkers?: number;
    maxWorkers?: number;
    idleTimeout?: number;
    workerScript?: string | URL;
    workerFactory?: () => Worker;
}
