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

export interface WorkerResponse {
    type: WorkerMessageType | 'PROGRESS' | 'ERROR' | 'SUCCESS';
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
