import { ModelInfo, ModelType } from '@/types/model';

/**
 * Fallback models if API fails.
 */
export const AVAILABLE_MODELS: ModelInfo[] = [
    {
        id: 'mdx-net-inst-v1',
        type: ModelType.MDX,
        name: 'MDX-Net Vocal 1',
        version: '1.0.0',
        size: 40 * 1024 * 1024,
        description: 'Standard lightweight model for vocals/instrumental separation.',
        url: '/api/proxy-model?url=' + encodeURIComponent('https://github.com/TRvlvr/model_repo/releases/download/all_public_uvr_models/UVR-MDX-NET-Inst_HQ_3.onnx'),
    },
];

export const DEFAULT_MODEL_ID = 'mdx-net-inst-v1';
