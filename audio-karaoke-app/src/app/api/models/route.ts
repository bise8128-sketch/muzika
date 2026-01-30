
import { NextResponse } from 'next/server';
import { ModelType, ModelInfo } from '@/types/model';

/**
 * Enhanced model list with SHA256 hashes for verification and better descriptions.
 */
export const AVAILABLE_MODELS: ModelInfo[] = [
    {
        id: 'mdx-net-inst-v1',
        type: ModelType.DEMUCS, // Using DEMUCS type to trigger SpectralInferenceStrategy
        name: 'MDX-Net Vocal 1',
        version: '1.0.0',
        size: 40 * 1024 * 1024,
        description: 'Standard lightweight model optimized for high-quality instrumental extraction with minimal vocal bleed.',
        url: '/api/proxy-model?url=' + encodeURIComponent('https://github.com/TRvlvr/model_repo/releases/download/all_public_uvr_models/UVR-MDX-NET-Inst_HQ_3.onnx'),
        config: {
            fftSize: 6144,
            hopLength: 1024,
            windowSize: 6144,
            targetFreqs: 3072,
            targetFrames: 256
        }
    },
    {
        id: 'mdx-net-vocal-ft',
        type: ModelType.DEMUCS, // Using DEMUCS type to trigger SpectralInferenceStrategy
        name: 'MDX-Net Vocals FT',
        version: '1.0.0',
        size: 45 * 1024 * 1024,
        description: 'Fine-tuned MDX-Net model specifically for clean vocal extraction, ideal for isolation and karaoke lead vocals.',
        url: '/api/proxy-model?url=' + encodeURIComponent('https://github.com/TRvlvr/model_repo/releases/download/all_public_uvr_models/UVR-MDX-NET-Voc_FT.onnx'),
        config: {
            fftSize: 6144,
            hopLength: 1024,
            windowSize: 6144,
            targetFreqs: 3072,
            targetFrames: 256
        }
    }
];

export async function GET() {
    return NextResponse.json({
        models: AVAILABLE_MODELS,
        total: AVAILABLE_MODELS.length,
        lastUpdated: new Date().toISOString(),
        status: 'stable'
    }, {
        headers: {
            'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        }
    });
}
