'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { PlaybackController } from '@/utils/audio/playbackController';
import { SeparationResult, PerformanceScore } from '@/types/audio';
import { useSeparation } from '@/hooks/useSeparation';
import { useRouter } from '@/i18n/routing';
import { useMachine } from '@xstate/react';
import { appMachine } from '@/state/appMachine';

interface AudioContextType {
    controller: PlaybackController | null;
    activeResult: SeparationResult | null;
    setActiveResult: (result: SeparationResult | null) => void;
    loadResultFromStorage: (fileHash: string) => Promise<boolean>;
    isLoading: boolean;
    separation: ReturnType<typeof useSeparation>;
    performanceScore: PerformanceScore | null;
    setPerformanceScore: (score: PerformanceScore | null) => void;
    machineState: any; // Using any briefly for brevity in this complex migration
    send: (event: any) => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [controller] = useState<PlaybackController | null>(() => {
        if (typeof window === 'undefined') return null;
        return new PlaybackController();
    });

    const [activeResult, setActiveResult] = useState<SeparationResult | null>(null);
    const [performanceScore, setPerformanceScore] = useState<PerformanceScore | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const separation = useSeparation();
    const [machineState, send] = useMachine(appMachine);
    const router = useRouter();

    // Global side-effects for state machine transitions
    useEffect(() => {
        if (separation.status === 'completed' && separation.result) {
            // Success navigation
            const result = separation.result;
            send({ type: 'PROCESS_COMPLETE' });

            // We don't have access to settings here easily, so we can use a simpler approach
            // or just rely on the machine state to drive the UI.
            // For now, let's keep it simple: redirect to results
            router.push(`/results/${result.fileHash}`);
        } else if (separation.status === 'error') {
            console.error("Global Separation Error:", separation.error);
            send({ type: 'PROCESS_ERROR', error: separation.error || 'Unknown error' });
        }
    }, [separation.status, separation.result, separation.error, send, router]);

    useEffect(() => {
        return () => {
            if (controller) {
                console.log('🎵 AudioProvider Disposing Controller');
                controller.dispose();
            }
        };
    }, [controller]);

    const loadResultFromStorage = useCallback(async (fileHash: string) => {
        if (!controller) return false;
        
        setIsLoading(true);
        try {
            // Check if we already have it in memory to avoid redundant loads
            if (activeResult?.fileHash === fileHash) {
                return true;
            }

            // In a real app, we'd fetch the buffers from songsStorage/audioCache
            // For now, we utilize the existing history management logic implicitly 
            // but this provider makes the result globally accessible.
            
            // Note: songsStorage stores paths/metadata, audioCache stores raw buffers.
            // This is a simplified placeholder for the route-based restoration logic.
            return true; 
        } catch (error) {
            console.error('Failed to load result from storage:', error);
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [controller, activeResult]);

    return (
        <AudioContext.Provider value={{ 
            controller, 
            activeResult, 
            setActiveResult, 
            loadResultFromStorage,
            isLoading,
            separation,
            performanceScore,
            setPerformanceScore,
            machineState,
            send
        }}>
            {children}
        </AudioContext.Provider>
    );
};

export const useAudio = () => {
    const context = useContext(AudioContext);
    if (!context) {
        throw new Error('useAudio must be used within an AudioProvider');
    }
    return context;
};
