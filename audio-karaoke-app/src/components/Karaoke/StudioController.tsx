'use client';

import React, { useState } from 'react';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { songsStorage } from '@/utils/storage/songsStorage';

type AudioEngineHook = ReturnType<typeof useAudioEngine>;

interface StudioControllerProps {
    engine: AudioEngineHook;
    originalHash?: string;
    fileName?: string;
    vocals?: ArrayBuffer;
    instrumentals?: ArrayBuffer;
    duration?: number;
}

export const StudioController: React.FC<StudioControllerProps> = ({
    engine,
    originalHash,
    fileName,
    vocals,
    instrumentals,
    duration
}) => {
    const { pitch, tempo, setPitch, setTempo } = engine;
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [versionName, setVersionName] = useState('');

    const handleReset = () => {
        setPitch(0);
        setTempo(1);
    };

    const handleSave = async () => {
        if (!versionName.trim()) {
            alert("Please enter a version name");
            return;
        }

        if (!originalHash || !vocals || !instrumentals) {
            alert("Cannot save: Missing original audio data. Make sure separation is complete.");
            return;
        }

        try {
            await songsStorage.saveSongVersion(
                originalHash,
                fileName || 'Unknown Song',
                vocals,
                instrumentals,
                pitch,
                tempo,
                versionName,
                duration
            );
            alert("Version saved to library!");
            setShowSaveModal(false);
            setVersionName('');
        } catch (e) {
            console.error("Failed to save version:", e);
            alert("Failed to save version.");
        }
    };

    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                Studio Controls
            </h3>

            <div className="space-y-6">
                {/* Pitch Control */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm font-medium">
                        <label>Pitch</label>
                        <span className="text-primary">{pitch > 0 ? '+' : ''}{pitch} Semitones</span>
                    </div>
                    <input
                        type="range"
                        min="-6"
                        max="6"
                        step="1"
                        value={pitch}
                        onChange={(e) => setPitch(Number(e.target.value))}
                        className="w-full accent-primary h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>-6</span>
                        <span>0</span>
                        <span>+6</span>
                    </div>
                </div>

                {/* Tempo Control */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm font-medium">
                        <label>Tempo</label>
                        <span className="text-primary">{Math.round(tempo * 100)}%</span>
                    </div>
                    <input
                        type="range"
                        min="0.5"
                        max="1.5"
                        step="0.05"
                        value={tempo}
                        onChange={(e) => setTempo(Number(e.target.value))}
                        className="w-full accent-primary h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>0.5x</span>
                        <span>1.0x</span>
                        <span>1.5x</span>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t border-white/10">
                    <button
                        onClick={handleReset}
                        className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-medium transition-colors"
                    >
                        Reset
                    </button>
                    <button
                        onClick={() => setShowSaveModal(true)}
                        className="flex-1 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-colors shadow-lg shadow-primary/20"
                    >
                        Save Version
                    </button>
                </div>
            </div>

            {/* Save Modal */}
            {showSaveModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm animate-in zoom-in-95 duration-200">
                        <h4 className="text-lg font-bold mb-4">Save Version</h4>
                        <input
                            type="text"
                            placeholder="Version Name (e.g. High Pitch Remix)"
                            value={versionName}
                            onChange={(e) => setVersionName(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 mb-4 focus-ring"
                            autoFocus
                        />
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowSaveModal(false)}
                                className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-white/5 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-colors"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
