'use client';

import React, { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { extractMetadata } from '@/utils/karaoke/metadata';
import { ExtractedMetadata } from '@/types/schema';

interface DirectKaraokeUploadProps {
    onUpload: (files: File[], metadata: ExtractedMetadata[]) => void;
    onCancel: () => void;
}

export const DirectKaraokeUpload: React.FC<DirectKaraokeUploadProps> = ({
    onUpload,
    onCancel
}) => {
    const t = useTranslations('AudioUpload');
    const [isDragging, setIsDragging] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [metadataList, setMetadataList] = useState<ExtractedMetadata[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);

    const processFiles = async (files: File[]) => {
        setIsProcessing(true);
        const newMetadataList: ExtractedMetadata[] = [];

        for (const file of files) {
            const metadata = await extractMetadata(file);
            newMetadataList.push(metadata);
        }

        setSelectedFiles(prev => [...prev, ...files]);
        setMetadataList(prev => [...prev, ...newMetadataList]);
        setIsProcessing(false);
    };

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

        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('audio/'));
        if (files.length > 0) {
            await processFiles(files);
        }
    }, []);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files ? Array.from(e.target.files) : [];
        if (files.length > 0) {
            await processFiles(files);
        }
    };

    const handleConfirmUpload = () => {
        if (selectedFiles.length > 0) {
            onUpload(selectedFiles, metadataList);
        }
    };

    const removeFile = (index: number) => {
        const newFiles = [...selectedFiles];
        const newMetadata = [...metadataList];
        newFiles.splice(index, 1);
        newMetadata.splice(index, 1);
        setSelectedFiles(newFiles);
        setMetadataList(newMetadata);
    };

    return (
        <div className="space-y-6">
            <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${isDragging
                        ? 'border-primary bg-primary/10'
                        : 'border-white/10 hover:border-white/20 bg-black/20'
                    }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <div className="flex flex-col items-center justify-center space-y-4">
                    <div className="p-4 bg-primary/20 rounded-full">
                        <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold mb-1">Upload Karaoke Tracks</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            Drag & drop pre-made karaoke files here
                        </p>
                        <label className="btn-primary cursor-pointer inline-flex items-center space-x-2 px-4 py-2 rounded-lg transition-transform hover:scale-105 active:scale-95">
                            <span>Select Files</span>
                            <input
                                type="file"
                                multiple
                                accept="audio/*"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                        </label>
                    </div>
                    <p className="text-xs text-muted-foreground/60">
                        Supports MP3, WAV, FLAC, M4A
                    </p>
                </div>
            </div>

            {/* File List & Metadata Preview */}
            {selectedFiles.length > 0 && (
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                        Ready to Import ({selectedFiles.length})
                    </h4>

                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                        {selectedFiles.map((file, index) => (
                            <div key={`${file.name}-${index}`} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5 group hover:border-white/10 transition-colors">
                                <div className="flex items-center space-x-3 min-w-0 flex-1">
                                    <div className="w-10 h-10 rounded bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0">
                                        <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                        </svg>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center space-x-2">
                                            <p className="font-medium truncate text-sm text-white">
                                                {metadataList[index]?.title || file.name}
                                            </p>
                                            {metadataList[index]?.artist && (
                                                <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-white/5 rounded">
                                                    {metadataList[index].artist}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center text-xs text-muted-foreground mt-0.5 space-x-2">
                                            <span>{(file.size / (1024 * 1024)).toFixed(1)} MB</span>
                                            {metadataList[index]?.duration && (
                                                <>
                                                    <span>•</span>
                                                    <span>{Math.floor(metadataList[index].duration! / 60)}:{(Math.floor(metadataList[index].duration!) % 60).toString().padStart(2, '0')}</span>
                                                </>
                                            )}
                                            {metadataList[index]?.bpm && (
                                                <>
                                                    <span>•</span>
                                                    <span>{Math.round(metadataList[index].bpm!)} BPM</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => removeFile(index)}
                                    className="p-2 text-muted-foreground hover:text-red-400 hover:bg-red-400/10 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center justify-end space-x-3 pt-2">
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirmUpload}
                            disabled={isProcessing}
                            className="btn-primary px-6 py-2 rounded-lg text-sm font-semibold flex items-center space-x-2"
                        >
                            {isProcessing ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                    <span>Processing...</span>
                                </>
                            ) : (
                                <span>Add to Library</span>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
