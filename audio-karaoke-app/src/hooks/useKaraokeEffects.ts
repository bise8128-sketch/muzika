import { useState, useCallback } from 'react';
import { PlaybackController } from '@/utils/audio/playbackController';

export const useKaraokeEffects = (controller: PlaybackController | null) => {
    const [pitch, setPitch] = useState(0);
    const [tempo, setTempo] = useState(1.0);
    const [reverb, setReverb] = useState(0);
    const [echo, setEcho] = useState(0);

    const handlePitchChange = useCallback((val: number) => {
        setPitch(val);
        controller?.setPitch(val);
    }, [controller]);

    const handleTempoChange = useCallback((val: number) => {
        setTempo(val);
        controller?.setTempo(val);
    }, [controller]);

    const handleReverbChange = useCallback((val: number) => {
        setReverb(val);
        controller?.setReverbLevel(val);
    }, [controller]);

    const handleEchoChange = useCallback((val: number) => {
        setEcho(val);
        controller?.setEchoLevel(val);
    }, [controller]);

    const resetEffects = useCallback((resetEQ?: () => void) => {
        setPitch(0);
        controller?.setPitch(0);
        setTempo(1.0);
        controller?.setTempo(1.0);
        setReverb(0);
        controller?.setReverbLevel(0);
        setEcho(0);
        controller?.setEchoLevel(0);
        if (resetEQ) resetEQ();
    }, [controller]);

    return {
        pitch,
        tempo,
        reverb,
        echo,
        handlePitchChange,
        handleTempoChange,
        handleReverbChange,
        handleEchoChange,
        resetEffects
    };
};
