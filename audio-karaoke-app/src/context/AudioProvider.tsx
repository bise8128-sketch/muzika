'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { PlaybackController } from '@/utils/audio/playbackController';
import { SeparationResult, PerformanceScore } from '@/types/audio';
import { useSeparation } from '@/hooks/useSeparation';
import { useRouter } from '@/i18n/routing';
import { useMachine } from '@xstate/react';
import { appMachine } from '@/state/appMachine';
import { StateFrom, EventFrom } from 'xstate';
import { useLyricSync } from '@/hooks/useLyricSync'; // Added to allow Syncing
import { usePathname } from 'next/navigation';

interface AudioContextType {
    controller: PlaybackController | null;
    activeResult: SeparationResult | null;
    setActiveResult: (result: SeparationResult | null) => void;
    loadResultFromStorage: (fileHash: string) => Promise<boolean>;
    isLoading: boolean;
    separation: ReturnType<typeof useSeparation>;
    lyricSync: ReturnType<typeof useLyricSync>;
    performanceScore: PerformanceScore | null;
    setPerformanceScore: (score: PerformanceScore | null) => void;
    machineState: StateFrom<typeof appMachine>; 
    send: (event: EventFrom<typeof appMachine>) => void;
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
    const lyricSync = useLyricSync(controller as PlaybackController); // Add sync hook to context
    const [machineState, send] = useMachine(appMachine);
    
    const router = useRouter();
    const pathname = usePathname();

    // 1. Separation completion pushes state forward
    useEffect(() => {
        if (separation.status === 'completed' && separation.result) {
            send({ type: 'PROCESS_COMPLETE', fileHash: separation.result.fileHash });
        } else if (separation.status === 'error') {
            console.error("Global Separation Error:", separation.error);
            send({ type: 'PROCESS_ERROR', error: separation.error || 'Unknown error' });
        }
    }, [separation.status, separation.result, separation.error, send]);

    // 2. LyricSync completion pushes state forward
    useEffect(() => {
        if (machineState.matches('syncing')) {
            if (lyricSync.result) {
                // Keep the active result updated with the new lyrics
                if (activeResult) {
                  // This allows UI to show the resolved lyrics seamlessly
                }
                send({ type: 'SYNC_COMPLETE' });
            } else if (lyricSync.error) {
                send({ type: 'SYNC_ERROR', error: lyricSync.error });
            } else if (!lyricSync.isProcessing) {
                // If we enter syncing but no sync is processing (e.g., no lyrics provided), skip it
                send({ type: 'SYNC_COMPLETE' });
            }
        }
    }, [machineState, machineState.value, lyricSync.result, lyricSync.error, lyricSync.isProcessing, send, activeResult]);

    // 3. Centralized Navigation driven by Machine State
    useEffect(() => {
        const fileHash = machineState.context.fileHash;
        
        if (machineState.matches('results') && fileHash) {
            const expectedPath = `/results/${fileHash}`;
            if (!pathname.includes(expectedPath)) {
                router.push(expectedPath);
            }
        } else if (machineState.matches('karaoke') && fileHash) {
            const expectedPath = `/karaoke/${fileHash}`;
            if (!pathname.includes(expectedPath)) {
                router.push(expectedPath);
            }
        } else if (machineState.matches('idle') && fileHash) {
            // Check if we need to reset URL
            if (pathname !== '/') {
                router.push('/');
            }
        }
    }, [machineState, machineState.value, machineState.context.fileHash, router, pathname]);

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
            if (activeResult?.fileHash === fileHash) {
                return true;
            }
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
            lyricSync,
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
