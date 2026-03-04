import { useAudioStore } from '@/store/audioStore';
import { useShallow } from 'zustand/react/shallow';

export function usePlayback() {
    // We ignore the controller prop and only use the global store to prevent mismatches
    return useAudioStore(useShallow((state) => ({
        isPlaying: state.isPlaying,
        currentTime: state.currentTime,
        duration: state.duration,
        vocalsVolume: state.vocalsVolume,
        instrumentalVolume: state.instrumentalVolume,
        bass: state.bass,
        mid: state.mid,
        treble: state.treble,
        play: state.play,
        pause: state.pause,
        stop: state.stop,
        seek: state.seek,
        setVolume: state.setVolume,
        setEQ: state.setEQ
    })));
}
