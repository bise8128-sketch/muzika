import { useState, useEffect, useRef, useCallback } from 'react';
import { AudioEngine } from '../utils/audio/audioEngine';

export function useAudioEngine() {
    const engineRef = useRef<AudioEngine | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [pitch, setPitch] = useState(0);
    const [tempo, setTempo] = useState(1);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        // Initialize engine only once
        if (!engineRef.current) {
            engineRef.current = new AudioEngine();
        }

        const engine = engineRef.current;

        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);
        const handleStop = () => {
            setIsPlaying(false);
            setCurrentTime(0);
        };
        const handleTimeUpdate = (data: unknown) => {
            if (typeof data === 'object' && data !== null) {
                const d = data as { currentTime?: number; duration?: number };
                if (typeof d.currentTime === 'number') setCurrentTime(d.currentTime);
                if (typeof d.duration === 'number') setDuration(d.duration);
            }
        };
        const handleLoad = (data: unknown) => {
            if (typeof data === 'object' && data !== null) {
                const d = data as { duration?: number };
                if (typeof d.duration === 'number') setDuration(d.duration);
            }
            setIsReady(true);
        };
        const handleEnded = () => setIsPlaying(false);

        engine.on('play', handlePlay);
        engine.on('pause', handlePause);
        engine.on('stop', handleStop);
        engine.on('timeupdate', handleTimeUpdate);
        engine.on('ended', handleEnded);
        engine.on('load', handleLoad);

        return () => {
            // Cleanup
            engine.dispose();
            engineRef.current = null;
        };
    }, []);

    const load = useCallback(async (buffer: ArrayBuffer) => {
        if (engineRef.current) {
            await engineRef.current.load(buffer);
        }
    }, []);

    const play = useCallback(async () => {
        if (engineRef.current) {
            await engineRef.current.play();
        }
    }, []);

    const pause = useCallback(() => {
        if (engineRef.current) {
            engineRef.current.pause();
        }
    }, []);

    const stop = useCallback(() => {
        if (engineRef.current) {
            engineRef.current.stop();
        }
    }, []);

    const seek = useCallback((time: number) => {
        if (engineRef.current) {
            engineRef.current.seek(time);
        }
    }, []);

    const setAudioPitch = useCallback((semitones: number) => {
        if (engineRef.current) {
            engineRef.current.setPitch(semitones);
            setPitch(semitones);
        }
    }, []);

    const setAudioTempo = useCallback((rate: number) => {
        if (engineRef.current) {
            engineRef.current.setTempo(rate);
            setTempo(rate);
        }
    }, []);

    return {
        isReady,
        isPlaying,
        currentTime,
        duration,
        pitch,
        tempo,
        load,
        play,
        pause,
        stop,
        seek,
        setPitch: setAudioPitch,
        setTempo: setAudioTempo
    };
}
