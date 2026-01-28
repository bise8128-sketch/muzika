/**
 * ML model type definitions
 */

export interface ModelInfo {
    id: string;
    name: string;
    version: string;
    size: number; // Size in bytes
    url?: string;
    description?: string;
    downloadedAt?: number;
}

export interface ModelStorageData {
    id?: number;
    modelId: string;
    name: string;
    version: string;
    data: ArrayBuffer;
    size: number;
    downloadedAt: number;
}

export interface ModelDownloadProgress {
    loaded: number;
    total: number;
    percentage: number;
}

export type ExecutionProvider = 'webgpu' | 'webgl' | 'wasm' | 'cpu';

export interface ONNXConfig {
    executionProviders: ExecutionProvider[];
    graphOptimizationLevel?: 'disabled' | 'basic' | 'extended' | 'all';
    enableMemPattern?: boolean;
    enableCpuMemArena?: boolean;
    executionMode?: 'sequential' | 'parallel';
}

export interface InferenceInput {
    audio: Float32Array;
    sampleRate: number;
}

export interface InferenceOutput {
    vocals: Float32Array;
    instrumentals: Float32Array;
}
