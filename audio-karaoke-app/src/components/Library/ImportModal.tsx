import React, { useState, useRef } from 'react';
import { usePlaybackQueue } from '@/hooks/usePlaybackQueue';
import { SongEntry } from '@/types/storage';
import { md5 } from '@/utils/md5'; // Assuming we need a hash, otherwise create a simple one

interface ImportModalProps {
    onClose: () => void;
    onImport: (song: SongEntry) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({ onClose, onImport }) => {
    const [title, setTitle] = useState('');
    const [artist, setArtist] = useState('');
    const [versionName, setVersionName] = useState('Original');
    const [instrumentalFile, setInstrumentalFile] = useState<File | null>(null);
    const [vocalFile, setVocalFile] = useState<File | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fileToBuffer = (file: File): Promise<ArrayBuffer> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                if (reader.result instanceof ArrayBuffer) {
                    resolve(reader.result);
                } else {
                    reject(new Error("Failed to read file as ArrayBuffer"));
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    };

    const getAudioDuration = (buffer: ArrayBuffer): Promise<number> => {
        return new Promise((resolve, reject) => {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            audioContext.decodeAudioData(buffer.slice(0), (decodedBuffer) => {
                resolve(decodedBuffer.duration);
            }, (err) => {
                reject(err);
            });
        });
    };

    const handleImport = async () => {
        if (!instrumentalFile || !title) {
            setError("Title and Instrumental file are required.");
            return;
        }

        setIsImporting(true);
        setError(null);

        try {
            const instrumentalBuffer = await fileToBuffer(instrumentalFile);
            let vocalBuffer: ArrayBuffer | undefined;
            if (vocalFile) {
                vocalBuffer = await fileToBuffer(vocalFile);
            }

            // Estimate duration from instrumental
            // Note: In a real app we might want to use AudioContext to get exact duration
            // For now, we'll try to get it if possible, or default to 0 and update later?
            // Let's decode properly.
            const duration = await getAudioDuration(instrumentalBuffer);

            // Generate a simple hash for ID
            const originalHash = `local-${Date.now()}-${Math.random().toString(36).substring(7)}`;

            const newSong: SongEntry = {
                type: 'ai_separated',
                title,
                artist,
                versionName,
                instrumentalData: instrumentalBuffer,
                vocalData: vocalBuffer,
                originalHash,
                pitchAdjustment: 0,
                tempoMultiplier: 1,
                duration,
                createdAt: Date.now()
            };

            await onImport(newSong);
            onClose();
        } catch (err) {
            console.error("Import failed", err);
            setError("Failed to import files. Please ensure they are valid audio files.");
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                <h2 className="text-xl font-bold mb-4">Import Local Audio</h2>

                {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Song Title</label>
                        <input
                            type="text"
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. My Awesome Song"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Artist</label>
                        <input
                            type="text"
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
                            value={artist}
                            onChange={(e) => setArtist(e.target.value)}
                            placeholder="e.g. Create Artist"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Version Name</label>
                        <input
                            type="text"
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
                            value={versionName}
                            onChange={(e) => setVersionName(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">
                            Instrumental Track <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="file"
                            accept="audio/*"
                            className="w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                            onChange={(e) => setInstrumentalFile(e.target.files?.[0] || null)}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">
                            Vocal Track (Optional)
                        </label>
                        <input
                            type="file"
                            accept="audio/*"
                            className="w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                            onChange={(e) => setVocalFile(e.target.files?.[0] || null)}
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg hover:bg-white/5 transition-colors text-sm"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleImport}
                        disabled={isImporting || !title || !instrumentalFile}
                        className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isImporting && <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white"></div>}
                        Import
                    </button>
                </div>
            </div>
        </div>
    );
};
