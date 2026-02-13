import React from 'react';
import { saveSettings } from '@/utils/storage/settingsStore';

interface PlayerHeaderProps {
    isStageMode: boolean;
    onExitStageMode: () => void;
}

export const PlayerHeader: React.FC<PlayerHeaderProps> = ({ isStageMode, onExitStageMode }) => {
    if (!isStageMode) return null;

    return (
        <button
            onClick={() => {
                onExitStageMode();
                saveSettings({ stageModeEnabled: false });
            }}
            className="absolute top-4 md:top-8 left-4 md:left-8 z-[110] p-3 md:p-4 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-xl transition-all focus-ring"
            title="Exit Stage Mode (F)"
            aria-label="Exit Stage Mode"
        >
            <svg className="w-6 h-6 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>
    );
};
