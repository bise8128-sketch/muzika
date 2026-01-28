'use client';

import React, { useState, useRef, useCallback } from 'react';

interface AudioUploadProps {
    onUpload: (files: File[]) => void;
    isLoading?: boolean;
}

export const AudioUpload: React.FC<AudioUploadProps> = ({ onUpload, isLoading }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const validateFiles = (files: File[]): boolean => {
        const validTypes = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp3', 'audio/flac'];
        const maxSize = 50 * 1024 * 1024; // 50MB

        for (const file of files) {
            if (!validTypes.includes(file.type) && !file.name.endsWith('.mp3') && !file.name.endsWith('.wav') && !file.name.endsWith('.flac')) {
                setError(`Unsupported file format: ${file.name}. Please upload MP3, WAV, or FLAC.`);
                return false;
            }
            if (file.size > maxSize) {
                setError(`File ${file.name} is too large. Max size is 50MB.`);
                return false;
            }
        }

        setError(null);
        return true;
    };

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0 && validateFiles(files)) {
            onUpload(files);
        }
    }, [onUpload]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files ? Array.from(e.target.files) : [];
        if (files.length > 0 && validateFiles(files)) {
            onUpload(files);
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto">
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
          group relative overflow-hidden rounded-3xl border-2 border-dashed transition-all duration-300 cursor-pointer
          ${isDragging
                        ? 'border-primary bg-primary/5 scale-[1.02] shadow-[0_0_40px_-10px_rgba(147,51,234,0.3)]'
                        : 'border-white/10 bg-white/5 hover:border-primary/40 hover:bg-white/10 hover:shadow-xl'
                    }
          ${isLoading ? 'pointer-events-none opacity-50' : 'opacity-100'}
        `}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                />

                <div className="relative z-10 p-12 text-center">
                    <div className="mb-6 flex justify-center">
                        <div className={`
              p-6 rounded-2xl transition-all duration-500
              ${isDragging ? 'bg-primary text-white scale-110' : 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white'}
            `}>
                            <svg
                                className={`w-12 h-12 transition-transform duration-500 ${isDragging ? 'animate-bounce' : 'group-hover:scale-110'}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                            </svg>
                        </div>
                    </div>

                    <h3 className="text-2xl font-bold mb-2 group-hover:text-gradient transition-all">
                        {isDragging ? 'Drop them here!' : 'Select Audio Files'}
                    </h3>
                    <p className="text-muted-foreground mb-6 max-w-xs mx-auto">
                        Drag and drop your MP3/WAV files, or click to browse. Secure and local.
                    </p>

                    <div className="flex gap-4 justify-center items-center text-sm font-medium">
                        <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-muted-foreground">MP3</span>
                        <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-muted-foreground">WAV</span>
                        <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-muted-foreground">FLAC</span>
                    </div>
                </div>

                {/* Decorative Blobs */}
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 bg-primary/10 blur-[60px] rounded-full group-hover:bg-primary/20 transition-all"></div>
                <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-32 h-32 bg-accent/10 blur-[60px] rounded-full group-hover:bg-accent/20 transition-all"></div>
            </div>

            {error && (
                <div className="mt-4 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {error}
                </div>
            )}

            <div className="mt-12 space-y-4">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider text-center">Why Muzika?</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                        { tag: '🔒', title: 'Private', desc: 'No servers involved' },
                        { tag: '⚡', title: 'Fast', desc: 'GPU accelerated' },
                        { tag: '✨', title: 'Free', desc: 'Open source' }
                    ].map((item, i) => (
                        <div key={i} className="glass-card p-4 rounded-2xl text-center group hover:border-primary/30 transition-all">
                            <div className="text-2xl mb-2">{item.tag}</div>
                            <div className="font-semibold text-sm">{item.title}</div>
                            <div className="text-xs text-muted-foreground">{item.desc}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
