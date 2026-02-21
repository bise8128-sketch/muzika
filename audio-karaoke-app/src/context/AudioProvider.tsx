'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { PlaybackController } from '@/utils/audio/playbackController';
import { SeparationResult } from '@/types/audio';
import { songsStorage } from '@/utils/storage/songsStorage';

interface AudioContextType {
    controller: PlaybackController | null;
    activeResult: SeparationResult | null;
    setActiveResult: (result: SeparationResult | null) => void;
    loadResultFromStorage: (fileHash: string) => Promise<boolean>;
    isLoading: boolean;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [controller] = useState<PlaybackController | null>(() => {
        if (typeof window === 'undefined') return null;
        return new PlaybackController();
    });

    const [activeResult, setActiveResult] = useState<SeparationResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);

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
            isLoading 
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
