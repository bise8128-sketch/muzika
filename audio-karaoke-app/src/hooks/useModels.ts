
import { useState, useEffect } from 'react';
import { ModelInfo } from '@/types/model';
import { AVAILABLE_MODELS as FALLBACK_MODELS } from '@/app/api/models/route';
import { checkONNXSupport } from '@/utils/ml/onnxSetup';

export function useModels() {
    const [models, setModels] = useState<ModelInfo[]>(FALLBACK_MODELS);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [recommendedModelId, setRecommendedModelId] = useState<string | null>(null);

    useEffect(() => {
        async function fetchModels() {
            try {
                const response = await fetch('/api/models');
                if (!response.ok) {
                    throw new Error('Failed to fetch models');
                }
                const data = await response.json();
                setModels(data.models);
            } catch (err) {
                console.error('Error fetching models:', err);
                setError(err instanceof Error ? err.message : 'Unknown error');
                // Fallback models are already set
            } finally {
                setIsLoading(false);
            }
        }

        async function determineRecommendation() {
            const support = await checkONNXSupport();
            if (support.isLowEnd || !support.webgpu) {
                // Recommend the lightest model for low-end devices or if WebGPU is not available
                // In our route.ts, mdx-net-inst-v1 is the default and reasonably light
                setRecommendedModelId('mdx-net-inst-v1');
            } else {
                // Recommend a higher quality model for powerful devices with WebGPU support
                setRecommendedModelId('kim-vocal-2');
            }
        }

        fetchModels();
        determineRecommendation();
    }, []);

    return { models, isLoading, error, recommendedModelId };
}
