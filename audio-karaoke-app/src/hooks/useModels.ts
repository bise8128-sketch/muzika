
import { useState, useEffect } from 'react';
import { ModelInfo } from '@/types/model';
import { AVAILABLE_MODELS as FALLBACK_MODELS } from '@/app/api/models/route';

export function useModels() {
    const [models, setModels] = useState<ModelInfo[]>(FALLBACK_MODELS);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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

        fetchModels();
    }, []);

    return { models, isLoading, error };
}
