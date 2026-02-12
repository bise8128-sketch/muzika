
import { NextResponse } from 'next/server';
import { ModelType, ModelInfo } from '@/types/model';

/**
 * Enhanced model list with SHA256 hashes for verification and better descriptions.
 */
import { AVAILABLE_MODELS } from '@/constants/models';


export async function GET() {
    let backendModels: ModelInfo[] = [];
    try {
        // Fetch models from Python backend if available
        const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
        const res = await fetch(`${pythonServiceUrl}/api/models`, { next: { revalidate: 60 } });
        if (res.ok) {
            const data = await res.json();

            interface BackendModel {
                id: string;
                name: string;
                description: string;
            }

            // Transform backend models to ModelInfo structure
            backendModels = (data.models as BackendModel[]).map((m) => ({
                id: m.id,
                type: m.id.includes('demucs') ? ModelType.HTDEMUCS : ModelType.BS_ROFORMER,
                name: m.name,
                version: '1.0.0', // Backend doesn't send version yet, default to 1.0.0
                size: 0, // Backend models are server-side, size doesn't matter for client download
                description: m.description,
                isGpuSupported: true // Backend usually runs on CUDA
            }));
        }
    } catch (e) {
        console.warn('Failed to fetch backend models:', e);
    }

    const allModels = [...AVAILABLE_MODELS, ...backendModels];

    return NextResponse.json({
        models: allModels,
        total: allModels.length,
        lastUpdated: new Date().toISOString(),
        status: 'stable'
    }, {
        headers: {
            'Cache-Control': 'no-store', // Disable caching to ensure backend status is fresh
        }
    });
}
