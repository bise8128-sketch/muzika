import { useEffect } from 'react';
import { saveSettings } from '@/utils/storage/settingsStore';
import { PlaybackController } from '@/utils/audio/playbackController';

interface UseKaraokeShortcutsProps {
    playback: {
        isPlaying: boolean;
        play: () => void;
        pause: () => void;
        seek: (time: number) => void;
        currentTime: number;
        duration: number;
        vocalsVolume: number;
        instrumentalVolume: number;
        setVolume: (v: number, i: number) => void;
    };
    showEditor: boolean;
    setIsStageMode: React.Dispatch<React.SetStateAction<boolean>>;
}

export const useKaraokeShortcuts = ({
    playback,
    showEditor,
    setIsStageMode
}: UseKaraokeShortcutsProps) => {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger if user is typing in an input or editor
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || showEditor) return;

            switch (e.key) {
                case ' ':
                    e.preventDefault();
                    if (playback.isPlaying) {
                        playback.pause();
                    } else {
                        playback.play();
                    }
                    break;
                case 'm':
                case 'M':
                    // Toggle Mute (quick way to 0 volume)
                    const isMuted = playback.vocalsVolume === 0 && playback.instrumentalVolume === 0;
                    if (isMuted) {
                        playback.setVolume(0.8, 0); // Restore to reasonable default
                        playback.setVolume(0.8, 1);
                    } else {
                        playback.setVolume(0, 0);
                        playback.setVolume(0, 1);
                    }
                    break;
                case 'f':
                case 'F':
                    setIsStageMode(prev => {
                        const next = !prev;
                        saveSettings({ stageModeEnabled: next });
                        return next;
                    });
                    break;
                case 'ArrowLeft':
                    playback.seek(Math.max(0, playback.currentTime - 5));
                    break;
                case 'ArrowRight':
                    playback.seek(Math.min(playback.duration, playback.currentTime + 5));
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [playback, showEditor, setIsStageMode]);
};
