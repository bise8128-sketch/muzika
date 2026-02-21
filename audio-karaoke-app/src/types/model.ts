/**
 * ML model type definitions
 */

export enum ModelType {
    MDX = 'mdx',
    DEMUCS = 'demucs', // WASM Demucs v4
    BS_ROFORMER = 'bs_roformer',
    HTDEMUCS = 'htdemucs', // Python Backend
    HTDEMUCS_FT = 'htdemucs_ft', // Python Backend
    WHISPER = 'whisper' // Whisper ONNX for lyric sync
}

export const MODELS: Record<string, ModelInfo> = {
    [ModelType.DEMUCS]: {
        id: 'demucs-v4-quant',
        type: ModelType.DEMUCS,
        name: 'Demucs v4 (Local)',
        version: '4.0.0',
        size: 120 * 1024 * 1024,
        url: 'https://huggingface.co/onnx-community/demucs-v4/resolve/main/onnx/model_quantized.onnx',
        isGpuSupported: true,
        description: 'High-quality client-side vocal removal using Demucs v4.'
    }
};

export interface ModelConfig {
    fftSize?: number;
    hopLength?: number;
    windowSize?: number;
    sampleRate?: number; // Target sample rate for the model
    channels?: number;
    targetFreqs?: number;
    targetFrames?: number;
    useWebGPU?: boolean; // Whether to use WebGPU-accelerated path
}

export interface ModelInfo {
    id: string;
    type: ModelType;
    name: string;
    version: string;
    size: number; // Size in bytes
    config?: ModelConfig; // Architecture specific config
    url?: string;
    fallbackUrl?: string;
    sha256?: string;
    description?: string;
    downloadedAt?: number;
    isGpuSupported?: boolean;
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
export type ExecutionBackend = 'webgpu' | 'wasm' | 'server';


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
