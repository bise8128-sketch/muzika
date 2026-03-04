import { create } from 'zustand';
import { PlaybackController } from '@/utils/audio/playbackController';
import { SeparationResult } from '@/types/audio';

export interface AudioState {
    // Core references
    controller: PlaybackController | null;
    activeResult: SeparationResult | null;
    
    // Playback state (frequently updated)
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    
    // Mix state
    vocalsVolume: number;
    instrumentalVolume: number;
    bass: number;
    mid: number;
    treble: number;

    // Actions
    setController: (controller: PlaybackController | null) => void;
    setActiveResult: (result: SeparationResult | null) => void;
    
    // Sync actions (called by hook/listeners to sync from controller)
    syncPlaybackState: (state: Partial<AudioState>) => void;
    
    // Control actions
    play: () => void;
    pause: () => void;
    stop: () => void;
    seek: (time: number) => void;
    setVolume: (volume: number, trackIndex?: number) => void;
    setEQ: (bass: number, mid: number, treble: number) => void;
}

export const useAudioStore = create<AudioState>()((set, get) => ({
    controller: typeof window !== 'undefined' ? new PlaybackController() : null,
    activeResult: null,
    
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    
    vocalsVolume: 1,
    instrumentalVolume: 1,
    bass: 0,
    mid: 0,
    treble: 0,

    setController: (controller) => set({ controller }),
    
    setActiveResult: (result) => set({ activeResult: result }),
    
    syncPlaybackState: (state) => set((prev) => ({ ...prev, ...state })),

    play: () => {
        const { controller } = get();
        if (controller) {
            controller.play();
            set({ isPlaying: true });
        }
    },
    
    pause: () => {
        const { controller } = get();
        if (controller) {
            controller.pause();
            set({ isPlaying: false });
        }
    },
    
    stop: () => {
        const { controller } = get();
        if (controller) {
            controller.stop();
            set({ isPlaying: false, currentTime: 0 });
        }
    },
    
    seek: (time: number) => {
        const { controller } = get();
        if (controller) {
            controller.setCurrentTime(time);
            set({ currentTime: time });
        }
    },
    
    setVolume: (volume: number, trackIndex?: number) => {
        const { controller } = get();
        if (controller) {
            controller.setVolume(volume, trackIndex);
            
            if (trackIndex === 0) {
                set({ vocalsVolume: volume });
            } else if (trackIndex === 1) {
                set({ instrumentalVolume: volume });
            } else if (trackIndex === undefined) {
                set({ vocalsVolume: volume, instrumentalVolume: volume });
            }
        }
    },
    
    setEQ: (bass: number, mid: number, treble: number) => {
        const { controller } = get();
        if (controller) {
            controller.setEQ(bass, mid, treble);
            set({ bass, mid, treble });
        }
    }
}));
