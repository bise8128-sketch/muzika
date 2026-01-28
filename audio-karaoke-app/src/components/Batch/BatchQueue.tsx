import React from 'react';
import { QueueItem } from '@/hooks/useBatchSeparation';

interface BatchQueueProps {
    queue: QueueItem[];
    onRemove: (id: string) => void;
    onDownload: (item: QueueItem) => void;
}

export const BatchQueue: React.FC<BatchQueueProps> = ({ queue, onRemove, onDownload }) => {
    if (queue.length === 0) return null;

    return (
        <div className="w-full max-w-2xl mx-auto mt-8 space-y-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Queue ({queue.length})</h3>
            </div>

            <div className="space-y-3">
                {queue.map((item) => (
                    <div
                        key={item.id}
                        className={`
                            relative overflow-hidden rounded-xl border p-4 transition-all
                            ${item.status === 'processing' ? 'bg-white/5 border-primary/50 ring-1 ring-primary/20' : 'bg-card border-white/5'}
                        `}
                    >
                        {/* Progress Background for processing */}
                        {item.status === 'processing' && (
                            <div
                                className="absolute bottom-0 left-0 top-0 bg-primary/5 transition-all duration-300 pointer-events-none"
                                style={{ width: `${item.progress}%` }}
                            />
                        )}

                        <div className="relative flex items-center gap-4">
                            {/* Icon / Status */}
                            <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-white/5">
                                {item.status === 'pending' && (
                                    <span className="text-muted-foreground">⏳</span>
                                )}
                                {item.status === 'processing' && (
                                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                )}
                                {item.status === 'completed' && (
                                    <span className="text-green-500">✓</span>
                                )}
                                {item.status === 'error' && (
                                    <span className="text-red-500">✕</span>
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-grow min-w-0">
                                <div className="font-medium truncate">{item.file.name}</div>
                                <div className="text-xs text-muted-foreground flex items-center gap-2">
                                    <span>{(item.file.size / 1024 / 1024).toFixed(1)} MB</span>
                                    <span>•</span>
                                    <span className={`
                                        ${item.status === 'processing' ? 'text-primary' : ''}
                                        ${item.status === 'error' ? 'text-red-400' : ''}
                                        ${item.status === 'completed' ? 'text-green-400' : ''}
                                    `}>
                                        {item.status === 'processing'
                                            ? `${Math.round(item.progress)}% - ${item.message || 'Processing'}`
                                            : item.status.charAt(0).toUpperCase() + item.status.slice(1)
                                        }
                                        {item.status === 'error' && item.error ? `: ${item.error}` : ''}
                                    </span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2">
                                {item.status === 'completed' && item.result && (
                                    <button
                                        onClick={() => onDownload(item)}
                                        className="p-2 hover:bg-white/10 rounded-lg text-primary transition-colors"
                                        title="Download Results"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                    </button>
                                )}

                                <button
                                    onClick={() => onRemove(item.id)}
                                    className="p-2 hover:bg-white/10 rounded-lg text-muted-foreground hover:text-destructive transition-colors"
                                    title="Remove from queue"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l18 18" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
