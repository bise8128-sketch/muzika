import { useState, useRef, useEffect, useCallback } from 'react';
import { VersionedAudioPlayer, TrackVersionState, VersionCreationOptions } from '../utils/audio/VersionedAudioPlayer';
import { Transport, start } from 'tone/build/esm/index';

export interface UseVersionedAudioReturn {
    isReady: boolean;
    versions: TrackVersionState[];
    activeVersionId: string | null;
    createVersion: (options: VersionCreationOptions) => void;
    activateVersion: (id: string) => void;
    setPitch: (id: string, semitones: number) => void;
    setTempo: (id: string, tempo: number) => void;
    loadAudio: (url: string | AudioBuffer) => Promise<void>;
    play: () => void;
    stop: () => void;
}

export function useVersionedAudio(): UseVersionedAudioReturn {
    const playerRef = useRef<VersionedAudioPlayer | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [versions, setVersions] = useState<TrackVersionState[]>([]);
    const [activeVersionId, setActiveVersionId] = useState<string | null>(null);

    useEffect(() => {
        const player = new VersionedAudioPlayer();
        playerRef.current = player;

        // Subscribe to changes in the player
        const unsubscribe = player.subscribe(() => {
            // Force update versions state
            if (playerRef.current) {
                const allVersions = playerRef.current.getAllVersions();
                setVersions([...allVersions]); // Create new array reference
                const active = allVersions.find(v => v.isActive);
                setActiveVersionId(active ? active.id : null);
            }
        });

        return () => {
            unsubscribe();
            player.dispose();
        };
    }, []);

    const loadAudio = useCallback(async (url: string | AudioBuffer) => {
        if (!playerRef.current) return;
        await playerRef.current.loadAudio(url);
        setIsReady(true);
    }, []);

    const createVersion = useCallback((options: VersionCreationOptions) => {
        if (!playerRef.current) return;
        playerRef.current.createVersion(options);
    }, []);

    const activateVersion = useCallback((id: string) => {
        if (!playerRef.current) return;
        playerRef.current.activateVersion(id);
    }, []);

    const setPitch = useCallback((id: string, semitones: number) => {
        if (!playerRef.current) return;
        playerRef.current.setVersionPitch(id, semitones);
    }, []);

    const setTempo = useCallback((id: string, tempo: number) => {
        if (!playerRef.current) return;
        playerRef.current.setVersionTempo(id, tempo);
    }, []);

    const play = useCallback(async () => {
        if (!playerRef.current) return;
        await start(); // Ensure context is running
        if (Transport.state !== 'started') {
            Transport.start();
        }
        playerRef.current.start();
    }, []);

    const stop = useCallback(() => {
        if (!playerRef.current) return;
        Transport.stop();
        playerRef.current.stop();
    }, []);

    return {
        isReady,
        versions,
        activeVersionId,
        createVersion,
        activateVersion,
        setPitch,
        setTempo,
        loadAudio,
        play,
        stop
    };
}
