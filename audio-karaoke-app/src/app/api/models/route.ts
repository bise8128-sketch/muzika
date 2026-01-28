
import { NextResponse } from 'next/server';
import { ModelType, ModelInfo } from '@/types/model';

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
    {
        id: 'mdx-net-vocal-ft',
        type: ModelType.MDX,
        name: 'MDX-Net Vocals FT',
        version: '1.0.0',
        size: 45 * 1024 * 1024,
        description: 'Fine-tuned model for better vocal extraction.',
        url: '/api/proxy-model?url=' + encodeURIComponent('https://github.com/TRvlvr/model_repo/releases/download/all_public_uvr_models/UVR-MDX-NET-Voc_FT.onnx'),
    }
];

export async function GET() {
    return NextResponse.json({
        models: AVAILABLE_MODELS,
        total: AVAILABLE_MODELS.length
    });
}
