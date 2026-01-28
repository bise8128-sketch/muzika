import { ModelInfo, ModelType } from '@/types/model';

export const AVAILABLE_MODELS: ModelInfo[] = [
    {
        id: 'mdx-net-inst-v1',
        type: ModelType.MDX,
        name: 'MDX-Net Vocal 1',
        version: '1.0.0',
        size: 40 * 1024 * 1024, // Estimate
        description: 'Standard lightweight model for vocals/instrumental separation.',
        url: '/api/proxy-model?url=' + encodeURIComponent('https://github.com/TRvlvr/model_repo/releases/download/all_public_uvr_models/UVR-MDX-NET-Inst_HQ_3.onnx'),
    },
    {
        id: 'demucs-ht-v4',
        type: ModelType.DEMUCS,
        name: 'Hybrid Demucs v4',
        version: '4.0.0',
        size: 150 * 1024 * 1024, // Estimate
        description: 'High quality spectral model. Requires more memory.',
        config: {
            fftSize: 4096,
            hopLength: 1024,
            windowSize: 4096
        }
    },
    {
        id: 'bs-roformer-viperx',
        type: ModelType.BS_ROFORMER,
        name: 'BS-RoFormer (ViperX)',
        version: '1.0.0',
        size: 500 * 1024 * 1024, // Estimate
        description: 'State-of-the-art quality. Very heavy (WebGPU required).',
        config: {
            fftSize: 2048, /* Check specific config for RoFormer */
            hopLength: 512
        }
    }
];

export const DEFAULT_MODEL_ID = 'mdx-net-inst-v1';
