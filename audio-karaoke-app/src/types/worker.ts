export type WorkerMessageType =
    | 'LOAD_MODEL'
    | 'SEPARATE_CHUNK'
    | 'CANCEL'
    | 'CLEAR_CACHE';

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
