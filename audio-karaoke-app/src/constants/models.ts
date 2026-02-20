
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
        url: '/api/proxy-model?url=' + encodeURIComponent('https://github.com/TRvlvr/model_repo/releases/download/all_public_uvr_models/UVR-MDX-NET-Inst_HQ_3.onnx') + '&fallbackUrl=' + encodeURIComponent('https://huggingface.co/seanghay/uvr_models/resolve/main/UVR-MDX-NET-Inst_HQ_3.onnx'),
        sha256: '317554b07fe1ea5279a77f2b1520a41ea4b93432560c4ffd08792c30fddf9adc',
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
        url: '/api/proxy-model?url=' + encodeURIComponent('https://github.com/TRvlvr/model_repo/releases/download/all_public_uvr_models/UVR-MDX-NET-Voc_FT.onnx') + '&fallbackUrl=' + encodeURIComponent('https://huggingface.co/seanghay/uvr_models/resolve/main/UVR-MDX-NET-Voc_FT.onnx'),
        sha256: '534b2070fcc7df514b13ef660dc8cbb328679c2374d04354a5c42bb14ecce111',
        config: {
            fftSize: 6144,
            hopLength: 1024,
            windowSize: 6144,
            targetFreqs: 3072,
            targetFrames: 256
        }
    },
    {
        id: 'kim-vocal-2',
        type: ModelType.DEMUCS,
        name: 'Kim Vocal 2',
        version: '2.0.0',
        size: 50 * 1024 * 1024,
        description: 'Premier model for ultra-clean vocal extraction with minimal artifacts. Preferred by professionals.',
        url: '/api/proxy-model?url=' + encodeURIComponent('https://github.com/TRvlvr/model_repo/releases/download/all_public_uvr_models/Kim_Vocal_2.onnx') + '&fallbackUrl=' + encodeURIComponent('https://huggingface.co/seanghay/uvr_models/resolve/main/Kim_Vocal_2.onnx'),
        sha256: 'ce74ef3b6a6024ce44211a07be9cf8bc6d87728cc852a68ab34eb8e58cde9c8b',
        config: {
            fftSize: 6144,
            hopLength: 1024,
            windowSize: 6144,
            targetFreqs: 3072,
            targetFrames: 256
        }
    },
    {
        id: 'mdx-kara-2',
        type: ModelType.DEMUCS,
        name: 'MDX-Net Karaoke 2',
        version: '2.0.0',
        size: 45 * 1024 * 1024,
        description: 'Specialized for karaoke: removes lead vocals while preserving backing harmonies.',
        url: '/api/proxy-model?url=' + encodeURIComponent('https://github.com/TRvlvr/model_repo/releases/download/all_public_uvr_models/UVR_MDXNET_KARA_2.onnx') + '&fallbackUrl=' + encodeURIComponent('https://huggingface.co/seanghay/uvr_models/resolve/main/UVR_MDXNET_KARA_2.onnx'),
        sha256: '5f9342b926cb00eadb626494f80f1ebabca21a2bf98841c7d692fe207449b8f5',
        config: {
            fftSize: 4096,
            hopLength: 1024,
            windowSize: 4096,
            targetFreqs: 2048,
            targetFrames: 256
        }
    },
    {
        id: 'mdx-net-main',
        type: ModelType.DEMUCS,
        name: 'MDX-Net Main',
        version: '1.0.0',
        size: 45 * 1024 * 1024,
        description: 'A robust general-purpose model for balanced vocal and instrumental separation.',
        url: '/api/proxy-model?url=' + encodeURIComponent('https://github.com/TRvlvr/model_repo/releases/download/all_public_uvr_models/UVR_MDXNET_Main.onnx') + '&fallbackUrl=' + encodeURIComponent('https://huggingface.co/seanghay/uvr_models/resolve/main/UVR_MDXNET_Main.onnx'),
        sha256: '8289784cda38543ff431add4070662813311a8cccfc0112ca82f76d9dba2b4ca',
        config: {
            fftSize: 4096,
            hopLength: 1024,
            windowSize: 4096,
            targetFreqs: 2048,
            targetFrames: 256
        }
    }
];
