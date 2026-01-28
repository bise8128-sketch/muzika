import { useState, useCallback, useRef, useEffect } from 'react';
import type { ModelInfo } from '@/types/model';
import type { SeparationResult, ProcessingProgress } from '@/types/audio';
import { separateAudio } from '@/utils/ml/separateAudio';

export interface QueueItem {
    id: string;
    file: File;
    status: 'pending' | 'processing' | 'completed' | 'error';
    progress: number;
    phase: ProcessingProgress['phase'] | null;
    message: string | null;
    result: SeparationResult | null;
    error: string | null;
}

export function useBatchSeparation() {
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    const addToQueue = useCallback((files: File[]) => {
        const newItems: QueueItem[] = files.map(file => ({
            id: Math.random().toString(36).substring(2, 9),
            file,
            status: 'pending',
            progress: 0,
            phase: null,
            message: 'Waiting...',
            result: null,
            error: null
        }));

        setQueue(prev => [...prev, ...newItems]);
    }, []);

    const removeFromQueue = useCallback((id: string) => {
        setQueue(prev => prev.filter(item => item.id !== id));
    }, []);

    const clearQueue = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        setQueue([]);
        setIsProcessing(false);
    }, []);

    const processNext = useCallback(async (modelInfo: ModelInfo) => {
        // Find next pending item
        // We use functional update to get latest queue state, but we need to act on it.
        // Actually, better to simply schedule an effect or loop.
        // But for reliable state updates, let's look at the current queue in helper.

        let targetId: string | null = null;

        setQueue(prev => {
            const nextItem = prev.find(item => item.status === 'pending');
            if (nextItem) {
                targetId = nextItem.id;
                // Mark as processing immediately to prevent double pick-up
                return prev.map(item =>
                    item.id === nextItem.id
                        ? { ...item, status: 'processing', message: 'Starting...' }
                        : item
                );
            }
            return prev;
        });

        if (!targetId) {
            setIsProcessing(false);
            return;
        }

        // Now process it
        const currentId = targetId!;
        // Need to get the file object. 
        // We really should use a ref for the queue if we want to read it imperatively,
        // or rely on the state update cycle.

        // Let's grab the file from state (which we just updated)
        // Wait, setQueue is async. We can't guarantee it's updated yet in this closure.
        // But we can pass the item if we found it.
        // Refactoring: Let's use a "Processor" useEffect that watches the queue.
        return;
    }, []);

    // Processor Effect
    // This is safer than imperative recursion for React hook state.
    // However, we need to know WHICH model to use.
    // So we'll trigger processing with a function that sets a "activeModel" ref or state.

    const [activeModel, setActiveModel] = useState<ModelInfo | null>(null);

    const startProcessing = useCallback((model: ModelInfo) => {
        setActiveModel(model);
        setIsProcessing(true);
    }, []);

    const stopProcessing = useCallback(() => {
        setIsProcessing(false);
        setActiveModel(null);
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
    }, []);

    useEffect(() => {
        if (!isProcessing || !activeModel) return;

        const processQueue = async () => {
            // Check if anything is currently 'processing' (we just marked it, or it is running)
            // Actually, we want to pick one 'pending' item and run it.
            // If something is ALREADY 'processing', we wait.

            // We need to access the current queue. using a ref for latest queue is good practice
            // alongside state. Or just use functional updates carefully.

            let itemToProcess: QueueItem | undefined;

            // Check if we are already busy
            // But since this is a loop controlled by effects, we need to be careful not to spawn multiple workers.
            // We'll use a local "busy" flag ref to ensure strict sequentiality if dependencies change.
        };
        // This is getting complicated with pure useEffect.
        // Let's use a simpler recursive function approach triggered by startProcessing.
    }, [isProcessing, activeModel]);


    // --- SIMPLER APPROACH ---
    // Recursive async function that pulls from queue ref.

    const queueRef = useRef<QueueItem[]>([]);

    // Sync ref
    useEffect(() => {
        queueRef.current = queue;
    }, [queue]);

    const runBatchLoop = async (model: ModelInfo) => {
        if (abortControllerRef.current?.signal.aborted) return;

        // Find next pending
        const nextIdx = queueRef.current.findIndex(i => i.status === 'pending');
        if (nextIdx === -1) {
            setIsProcessing(false);
            return; // All done
        }

        const item = queueRef.current[nextIdx];

        // Update Status to Processing
        updateItemStatus(item.id, { status: 'processing', message: 'Starting...' });

        try {
            // Separate
            const result = await separateAudio(item.file, {
                modelInfo: model,
                onProgress: (p) => {
                    updateItemStatus(item.id, {
                        progress: p.percentage,
                        phase: p.phase,
                        message: p.message
                    });
                }
            });

            // Complete
            updateItemStatus(item.id, {
                status: 'completed',
                progress: 100,
                message: 'Done',
                result
            });

        } catch (err: any) {
            updateItemStatus(item.id, {
                status: 'error',
                message: null,
                error: err.message || 'Error processing file'
            });
        }

        // Loop
        if (queueRef.current.find(i => i.status === 'pending')) {
            runBatchLoop(model);
        } else {
            setIsProcessing(false);
        }
    };

    const updateItemStatus = (id: string, updates: Partial<QueueItem>) => {
        setQueue(prev => prev.map(item =>
            item.id === id ? { ...item, ...updates } : item
        ));
    };

    const startBatch = useCallback((model: ModelInfo) => {
        if (isProcessing) return; // Already running
        setIsProcessing(true);
        // Start loop
        // We need to wait for state to update? No, we use ref in loop.
        // But ref needs to be fresh.
        // We'll pass the *current future* intention.

        // Small timeout to ensure ref is synced if we just added items?
        // Actually addToQueue updates state, which updates ref in Effect.
        // So if we call add then start immediately, we might miss it.
        // Better to have "auto-start" or manual start.

        // For manual start:
        runBatchLoop(model);
    }, [isProcessing]); // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-continue if we are "processing" but stopped loop? 
    // No, keep it simple.

    return {
        queue,
        isProcessing,
        addToQueue,
        removeFromQueue,
        clearQueue,
        startBatch
    };
}
