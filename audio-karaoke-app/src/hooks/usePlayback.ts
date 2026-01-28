/**
 * usePlayback Hook
 * Manages playback state and provides controls for the UI
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { PlaybackController } from '@/utils/audio/playbackController';

export function usePlayback(controller: PlaybackController | null) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [vocalsVolume, setVocalsVolume] = useState(1);
    const [instrumentalVolume, setInstrumentalVolume] = useState(1);

    useEffect(() => {
        if (!controller) return;

        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);
        const handleStop = () => {
            setIsPlaying(false);
            setCurrentTime(0);
        };
        const handleTimeUpdate = (data: { currentTime: number; duration: number }) => {
            setCurrentTime(data.currentTime);
            setDuration(data.duration);
        };
        const handleEnded = () => setIsPlaying(false);

        controller.on('play', handlePlay);
        controller.on('pause', handlePause);
        controller.on('stop', handleStop);
        controller.on('timeupdate', handleTimeUpdate);
        controller.on('ended', handleEnded);

        // Sync initial state
        setIsPlaying(controller.getIsPlaying());
        setCurrentTime(controller.getCurrentTime());
        setDuration(controller.getDuration());

        return () => {
            controller.off('play', handlePlay);
            controller.off('pause', handlePause);
            controller.off('stop', handleStop);
            controller.off('timeupdate', handleTimeUpdate);
            controller.off('ended', handleEnded);
        };
    }, [controller]);

    const play = useCallback(() => controller?.play(), [controller]);
    const pause = useCallback(() => controller?.pause(), [controller]);
    const stop = useCallback(() => controller?.stop(), [controller]);
    const seek = useCallback((time: number) => controller?.setCurrentTime(time), [controller]);

    const setVolume = useCallback((volume: number, trackIndex?: number) => {
        if (!controller) return;
        controller.setVolume(volume, trackIndex);
        if (trackIndex === 0) setVocalsVolume(volume);
        if (trackIndex === 1) setInstrumentalVolume(volume);
        if (trackIndex === undefined) {
            setVocalsVolume(volume);
            setInstrumentalVolume(volume);
        }
    }, [controller]);

    return {
        isPlaying,
        currentTime,
        duration,
        vocalsVolume,
        instrumentalVolume,
        play,
        pause,
        stop,
        seek,
        setVolume,
    };
}
