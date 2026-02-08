'use client';

import React, { useState, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useModels } from '@/hooks/useModels';
import YouTubeInput from '@/components/YouTubeInput';
import { FileValidator, ValidationConfig } from '@/utils/validation/FileValidator';
import { DirectKaraokeUpload } from './DirectKaraokeUpload';

interface AudioUploadProps {
    onUpload: (files: File[], isKaraokeMode?: boolean) => void;
    isLoading?: boolean;
    autoStartKaraoke?: boolean;
    onAutoStartToggle?: (value: boolean) => void;
    selectedModelId: string;
    onModelChange: (id: string) => void;
    onServerProcessing?: (url: string, config: { model: string, format: string }) => void;
}

export const AudioUpload: React.FC<AudioUploadProps> = ({
    onUpload,
    isLoading,
    autoStartKaraoke = false,
    onAutoStartToggle,
    selectedModelId,
    onModelChange,
    onServerProcessing
}) => {
    const t = useTranslations('AudioUpload');
    const { models } = useModels();
    const [isDragging, setIsDragging] = useState(false);
    const [isKaraokeMode, setIsKaraokeMode] = useState(false);
    const [processingMode, setProcessingMode] = useState<'client' | 'server'>('client');
    const [serverFormat, setServerFormat] = useState('mp3');
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const validateFiles = useCallback(async (files: File[]): Promise<boolean> => {
        const config: ValidationConfig = {
            maxFileSize: 50 * 1024 * 1024, // 50MB
            allowedTypes: ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp3', 'audio/flac', 'audio/ogg', 'audio/m4a'],
            // Optional: minFreeStorage could be added here if we had a way to estimate it reliably in the browser for all users
        };

        const validator = new FileValidator(config);

        // Clear previous errors
        setError(null);

        for (const file of files) {
            const result = await validator.validate(file);

            if (!result.isValid) {
                // Show the first error
                setError(result.errors[0] || t('errorFormat', { name: file.name }));
                return false;
            }

            // Show warnings if any (optional, maybe as toast or console)
            if (result.warnings.length > 0) {
                console.warn(`Validation warnings for ${file.name}:`, result.warnings);
            }
        }

        return true;
    }, [t]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            const isValid = await validateFiles(files);
            if (isValid) {
                onUpload(files, isKaraokeMode);
            }
        }
    }, [onUpload, isKaraokeMode, validateFiles]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files ? Array.from(e.target.files) : [];
        if (files.length > 0) {
            const isValid = await validateFiles(files);
            if (isValid) {
                onUpload(files, isKaraokeMode);
            }
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto">
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        fileInputRef.current?.click();
                    }
                }}
                role="button"
                tabIndex={0}
                aria-label="Upload audio files"
                className={`
                  group relative overflow-hidden rounded-3xl transition-all duration-300 outline-none focus-ring
                  ${!isKaraokeMode
                        ? `border-2 border-dashed ${isDragging
                            ? 'border-primary bg-primary/5 scale-[1.01] shadow-[0_0_40px_-10px_rgba(147,51,234,0.3)]'
                            : 'border-white/10 bg-white/5 hover:border-primary/40 hover:bg-white/10 hover:shadow-xl cursor-pointer'}`
                        : 'border-0'
                    }
                  ${isLoading ? 'pointer-events-none opacity-50' : 'opacity-100'}
                `}
            >
                {isKaraokeMode ? (
                    <div className="p-2">
                        <DirectKaraokeUpload
                            onUpload={(files, metadata) => {
                                // In a real implementation, we would pass metadata up
                                console.log('Karaoke metadata extracted:', metadata);
                                onUpload(files, true);
                            }}
                            onCancel={() => setIsKaraokeMode(false)}
                        />
                    </div>
                ) : (
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                fileInputRef.current?.click();
                            }
                        }}
                        className="w-full h-full"
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            id="audio-upload-input"
                            accept="audio/*"
                            multiple
                            onChange={handleFileChange}
                            className="sr-only"
                        />

                        <div className="relative z-10 p-8 md:p-12 text-center">
                            <div className="mb-6 flex justify-center">
                                <div className={`
                      p-6 rounded-2xl transition-all duration-500
                      ${isDragging ? 'bg-primary text-white scale-110' : 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white'}
                    `}>
                                    <svg
                                        className={`w-10 h-10 md:w-12 md:h-12 transition-transform duration-500 ${isDragging ? 'animate-bounce' : 'group-hover:scale-110'}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                    </svg>
                                </div>
                            </div>

                            <h3 className="text-xl md:text-2xl font-bold mb-2 group-hover:text-gradient transition-all">
                                {isDragging ? t('dropFiles') : t('selectFiles')}
                            </h3>
                            <p className="text-sm md:text-base text-muted-foreground mb-6 max-w-xs mx-auto">
                                {t('dragDrop')}
                            </p>

                            <div className="flex gap-2 md:gap-4 justify-center items-center text-xs font-medium">
                                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-muted-foreground">MP3</span>
                                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-muted-foreground">WAV</span>
                                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-muted-foreground">FLAC</span>
                            </div>
                        </div>

                        {/* Decorative Blobs */}
                        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 bg-primary/10 blur-[60px] rounded-full group-hover:bg-primary/20 transition-all"></div>
                        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-32 h-32 bg-accent/10 blur-[60px] rounded-full group-hover:bg-accent/20 transition-all"></div>
                    </div>
                )}
            </div>

            {/* OR Divider */}
            {!isKaraokeMode && (
                <div className="relative my-10">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-white/10"></div>
                    </div>
                    <div className="relative flex justify-center">
                        <span className="px-4 text-sm font-bold uppercase tracking-widest text-muted-foreground bg-zinc-950">
                            {t('or')}
                        </span>
                    </div>
                </div>
            )}

            {/* YouTube Input */}
            {!isKaraokeMode && (
                <YouTubeInput
                    onAudioExtracted={(file, metadata) => {
                        console.log('YouTube audio extracted:', metadata);
                        onUpload([file], isKaraokeMode);
                    }}
                    mode={processingMode}
                    disabled={isLoading}
                />
            )}

            {/* AI Model Selection & Settings */}
            {!isLoading && (
                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 items-start animate-in fade-in slide-in-from-top-4 duration-700">
                    <div className={`space-y-3 transition-opacity duration-300 ${isKaraokeMode ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                        <label htmlFor="model-select" className="block text-sm font-bold uppercase tracking-wider text-muted-foreground ml-1">
                            AI Separation Engine
                        </label>
                        <select
                            id="model-select"
                            value={selectedModelId}
                            onChange={(e) => onModelChange(e.target.value)}
                            disabled={isKaraokeMode}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-medium focus-ring appearance-none cursor-pointer hover:bg-white/10 transition-colors"
                        >
                            {models.map(m => (
                                <option key={m.id} value={m.id} className="bg-zinc-900 text-white">
                                    {m.name} {m.isGpuSupported ? '(GPU Optimized)' : ''}
                                </option>
                            ))}
                        </select>
                        <p className="text-[11px] text-muted-foreground ml-1">
                            {models.find(m => m.id === selectedModelId)?.description || 'Select an AI model for separation'}
                        </p>
                    </div>

                    <div className="flex flex-col justify-end h-full space-y-4">
                        <div className="flex bg-white/5 rounded-xl p-1 border border-white/10 mb-2">
                            <button
                                onClick={() => setProcessingMode('client')}
                                className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all ${processingMode === 'client' ? 'bg-primary text-white shadow-lg' : 'text-muted-foreground hover:text-white'}`}
                            >
                                CLIENT ENGINE
                            </button>
                            <button
                                onClick={() => setProcessingMode('server')}
                                className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all ${processingMode === 'server' ? 'bg-emerald-500 text-white shadow-lg' : 'text-muted-foreground hover:text-white'}`}
                            >
                                PYTHON SERVER
                            </button>
                        </div>

                        <label className="flex items-center gap-4 cursor-pointer group p-3 rounded-xl hover:bg-white/5 transition-all">
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    checked={isKaraokeMode}
                                    onChange={(e) => setIsKaraokeMode(e.target.checked)}
                                    className="peer sr-only"
                                    aria-label="Direct Karaoke Mode"
                                />
                                <div className="w-11 h-6 bg-white/10 rounded-full border border-white/20 peer-checked:bg-emerald-500 transition-all duration-300"></div>
                                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 peer-checked:left-6"></div>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-foreground group-hover:text-emerald-400 transition-colors">
                                    Direct Karaoke Mode
                                </span>
                                <span className="text-xs text-muted-foreground">Skip separation (File is already instrumental)</span>
                            </div>
                        </label>

                        {!isKaraokeMode && (
                            <label className="flex items-center gap-4 cursor-pointer group p-3 rounded-xl hover:bg-white/5 transition-all">
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        checked={autoStartKaraoke}
                                        onChange={(e) => onAutoStartToggle?.(e.target.checked)}
                                        className="peer sr-only"
                                        aria-label="Auto-start Karaoke Mode"
                                    />
                                    <div className="w-11 h-6 bg-white/10 rounded-full border border-white/20 peer-checked:bg-primary transition-all duration-300"></div>
                                    <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 peer-checked:left-6"></div>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                                        {t('autoStart')}
                                    </span>
                                    <span className="text-xs text-muted-foreground">Skip results and start singing immediately</span>
                                </div>
                            </label>
                        )}
                    </div>
                </div>
            )}

            {error && (
                <div className="mt-4 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {error}
                </div>
            )}

            <div className="mt-12 space-y-4">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider text-center">{t('whyMuzika')}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                        { tag: '🔒', title: 'private', desc: 'privateDesc' },
                        { tag: '⚡', title: 'fast', desc: 'fastDesc' },
                        { tag: '✨', title: 'free', desc: 'freeDesc' }
                    ].map((item, i) => (
                        <div key={i} className="glass-card p-4 rounded-2xl text-center group hover:border-primary/30 transition-all">
                            <div className="text-2xl mb-2">{item.tag}</div>
                            <div className="font-semibold text-sm">{t(item.title as "private" | "fast" | "free")}</div>
                            <div className="text-xs text-muted-foreground">{t(item.desc as "privateDesc" | "fastDesc" | "freeDesc")}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
