import { useState, useCallback, useRef, useEffect } from 'react';
import type { ModelInfo } from '@/types/model';
import type { SeparationResult, ProcessingProgress } from '@/types/audio';
import { separateAudio } from '@/utils/ml/separateAudio';

export interface SeparationState {
    isProcessing: boolean;
    progress: number;
    status: 'idle' | 'processing' | 'completed' | 'error';
    currentPhase: ProcessingProgress['phase'] | null;
    message: string | null;
    error: string | null;
    result: SeparationResult | null;
}

export function useSeparation() {
    const [state, setState] = useState<SeparationState>({
        isProcessing: false,
        progress: 0,
        status: 'idle',
        currentPhase: null,
        message: null,
        error: null,
        result: null,
    });

    const abortControllerRef = useRef<AbortController | null>(null);

    const separate = useCallback(async (
        file: File,
        modelInfo: ModelInfo,
        skipCache: boolean = false
    ) => {
        // Reset state
        setState({
            isProcessing: true,
            progress: 0,
            status: 'processing',
            currentPhase: 'loading-model',
            message: 'Starting separation...',
            error: null,
            result: null,
        });

        abortControllerRef.current = new AbortController();

        try {
            const result = await separateAudio(file, {
                modelInfo,
                skipCache,
                onProgress: (p) => {
                    setState(s => ({
                        ...s,
                        progress: p.percentage,
                        currentPhase: p.phase,
                        message: p.message || null,
                    }));
                },
            });

            setState(s => ({
                ...s,
                isProcessing: false,
                status: 'completed',
                message: 'Separation completed successfully!',
                result,
            }));

            return result;

        } catch (error: any) {
            setState(s => ({
                ...s,
                isProcessing: false,
                status: 'error',
                error: error.message || 'Unknown error occurred during separation',
                message: null,
            }));
            throw error;
        }
    }, []);

    const cancel = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        setState({
            isProcessing: false,
            progress: 0,
            status: 'idle',
            currentPhase: null,
            message: 'Processing cancelled',
            error: null,
            result: null,
        });
    }, []);

    const reset = useCallback(() => {
        setState({
            isProcessing: false,
            progress: 0,
            status: 'idle',
            currentPhase: null,
            message: null,
            error: null,
            result: null,
        });
    }, []);

    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    return {
        ...state,
        separate,
        cancel,
        reset,
    };
}
