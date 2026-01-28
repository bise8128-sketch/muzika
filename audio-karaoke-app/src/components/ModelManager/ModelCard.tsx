import React, { useState } from 'react';
import { ModelInfo, ModelDownloadProgress } from '@/types/model';
import { downloadModel } from '@/utils/ml/modelDownloader';
import { deleteModel } from '@/utils/storage/modelStorage';

interface ModelCardProps {
    model: ModelInfo;
    isDownloaded: boolean;
    onDownloadComplete: () => void;
    onDeleteComplete: () => void;
}

export const ModelCard: React.FC<ModelCardProps> = ({
    model,
    isDownloaded,
    onDownloadComplete,
    onDeleteComplete
}) => {
    const [isDownloading, setIsDownloading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const formatSize = (bytes: number) => {
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(1)} MB`;
    };

    const handleDownload = async () => {
        try {
            setIsDownloading(true);
            setError(null);
            setProgress(0);

            await downloadModel(model, (p: ModelDownloadProgress) => {
                setProgress(p.percentage);
            });

            onDownloadComplete();
        } catch (err) {
            console.error('Download failed:', err);
            setError('Download failed. Please try again.');
        } finally {
            setIsDownloading(false);
        }
    };

    const handleDelete = async () => {
        try {
            if (confirm(`Are you sure you want to delete ${model.name}?`)) {
                await deleteModel(model.id);
                onDeleteComplete();
            }
        } catch (err) {
            console.error('Delete failed:', err);
            setError('Delete failed.');
        }
    };

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col gap-3 hover:border-zinc-700 transition-colors">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="font-bold text-lg text-white">{model.name}</h3>
                    <div className="text-xs text-zinc-400 mt-1 flex gap-2">
                        <span className="bg-zinc-800 px-1.5 py-0.5 rounded uppercase">{model.type}</span>
                        <span>v{model.version}</span>
                        <span>~{formatSize(model.size)}</span>
                    </div>
                </div>
                {isDownloaded && (
                    <div className="flex items-center gap-1 text-emerald-500 text-xs font-medium bg-emerald-500/10 px-2 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        INSTALLED
                    </div>
                )}
            </div>

            <p className="text-sm text-zinc-400 leading-relaxed min-h-[40px]">
                {model.description || 'No description available.'}
            </p>

            <div className="mt-auto pt-2">
                {error && (
                    <div className="text-rose-400 text-xs mb-2 bg-rose-500/10 p-2 rounded">
                        {error}
                    </div>
                )}

                {isDownloading ? (
                    <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-zinc-400">
                            <span>Downloading...</span>
                            <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-indigo-500 transition-all duration-300 ease-out"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                ) : isDownloaded ? (
                    <button
                        onClick={handleDelete}
                        className="w-full py-2 px-4 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 rounded-md transition-all"
                    >
                        Delete Model
                    </button>
                ) : (
                    <button
                        onClick={handleDownload}
                        className="w-full py-2 px-4 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-md shadow-lg shadow-indigo-900/20 transition-all flex items-center justify-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download Model
                    </button>
                )}
            </div>
        </div>
    );
};
