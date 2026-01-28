import React, { useEffect, useState } from 'react';
import { useModels } from '@/hooks/useModels';
import { getAllModels } from '@/utils/storage/modelStorage';
import { ModelCard } from './ModelCard';
import { getStorageStats, clearCache, formatSize, StorageStats } from '@/utils/storage/storageStats';
import { ModelInfo } from '@/types/model';

export const ModelManager: React.FC = () => {
    const { models: AVAILABLE_MODELS } = useModels();
    const [downloadedModels, setDownloadedModels] = useState<string[]>([]);
    const [stats, setStats] = useState<StorageStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const refreshData = async () => {
        try {
            // Get downloaded models
            const models = await getAllModels();
            setDownloadedModels(models.map(m => m.id));

            // Get stats
            const s = await getStorageStats();
            setStats(s);
        } catch (err) {
            console.error('Failed to load model data:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        refreshData();
    }, []);

    const handleClearCache = async () => {
        if (confirm('This will delete all processed audio results. Models will be kept. Continue?')) {
            await clearCache();
            await refreshData();
        }
    };

    if (isLoading) {
        return <div className="p-8 text-center text-zinc-500">Loading model information...</div>;
    }

    return (
        <div className="w-full max-w-4xl mx-auto p-6 bg-black/20 rounded-xl border border-white/5 backdrop-blur-sm">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-1">AI Models</h2>
                    <p className="text-zinc-400 text-sm">Manage local AI models for separation.</p>
                </div>

                {stats && (
                    <div className="flex gap-4 text-xs bg-black/40 px-4 py-2 rounded-lg border border-white/5">
                        <div className="flex flex-col">
                            <span className="text-zinc-500 uppercase tracking-wider font-semibold text-[10px]">Model Storage</span>
                            <span className="text-white font-mono">{formatSize(stats.modelSize)}</span>
                        </div>
                        <div className="w-px bg-white/10" />
                        <div className="flex flex-col">
                            <span className="text-zinc-500 uppercase tracking-wider font-semibold text-[10px]">Audio Cache</span>
                            <span className="text-white font-mono">{formatSize(stats.cacheSize)}</span>
                        </div>
                        <div className="w-px bg-white/10" />
                        <button
                            onClick={handleClearCache}
                            className="flex flex-col items-start hover:text-rose-400 transition-colors group"
                            disabled={stats.cacheSize === 0}
                        >
                            <span className="text-zinc-500 group-hover:text-rose-400 uppercase tracking-wider font-semibold text-[10px]">Action</span>
                            <span className="underline decoration-zinc-700 underline-offset-2">Clear Cache</span>
                        </button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {AVAILABLE_MODELS.map(model => (
                    <ModelCard
                        key={model.id}
                        model={model}
                        isDownloaded={downloadedModels.includes(model.id)}
                        onDownloadComplete={refreshData}
                        onDeleteComplete={refreshData}
                    />
                ))}
            </div>

            <div className="mt-8 p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-lg text-sm text-indigo-200">
                <div className="flex gap-3">
                    <svg className="w-5 h-5 flex-shrink-0 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                        <p className="font-semibold mb-1">About Local Processing</p>
                        <p className="opacity-80">
                            Models are downloaded once and run entirely in your browser using WebGPU.
                            No audio data is ever sent to a server. Larger models provide better quality
                            but require more download time and GPU memory.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
