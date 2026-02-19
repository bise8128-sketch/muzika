'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { StorageManager } from '@/utils/storage/StorageManager';
import { motion, AnimatePresence } from 'framer-motion';

interface StorageStats {
    totalSize: number;
    modelsSize: number;
    audioSize: number;
    quota: {
        usage: number;
        quota: number;
        percentage: number;
    };
    cachedAudioCount: number;
    cachedModelsCount: number;
}

interface StorageSettingsModalProps {
    onClose: () => void;
}

export const StorageSettingsModal: React.FC<StorageSettingsModalProps> = ({ onClose }) => {
    const [stats, setStats] = useState<StorageStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [clearing, setClearing] = useState<string | null>(null);

    const loadStats = useCallback(async () => {
        setLoading(true);
        try {
            const data = await StorageManager.getStats();
            setStats(data as any);
        } catch (error) {
            console.error('Failed to load storage stats:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadStats();
    }, [loadStats]);

    const handleClearAudio = async () => {
        if (!confirm('Clear all cached audio stems? You will need to re-process songs to separation them again.')) return;
        setClearing('audio');
        await StorageManager.clearAudioCache();
        await loadStats();
        setClearing(null);
    };

    const handleClearModels = async () => {
        if (!confirm('Remove all downloaded ML models? They will be re-downloaded when needed.')) return;
        setClearing('models');
        await StorageManager.clearModelStorage();
        await loadStats();
        setClearing(null);
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-lg bg-zinc-900/90 border border-white/10 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-xl"
            >
                <div className="p-8">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-2xl font-bold">Storage Settings</h2>
                            <p className="text-muted-foreground text-sm">Manage your local data and cache</p>
                        </div>
                        <button 
                            onClick={onClose}
                            className="p-2 hover:bg-white/10 rounded-full transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            <p className="text-sm text-muted-foreground">Calculating storage...</p>
                        </div>
                    ) : stats ? (
                        <div className="space-y-8">
                            {/* Browser Quota */}
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm font-medium">
                                    <span>Browser Storage Usage</span>
                                    <span className={stats.quota.percentage > 80 ? 'text-red-400' : 'text-primary'}>
                                        {formatSize(stats.quota.usage)} / {formatSize(stats.quota.quota)}
                                    </span>
                                </div>
                                <div className="h-3 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                    <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${stats.quota.percentage}%` }}
                                        className={`h-full ${stats.quota.percentage > 80 ? 'bg-red-500' : 'bg-primary'} shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]`}
                                    />
                                </div>
                            </div>

                            {/* App Specifics */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-1">
                                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Audio Cache</span>
                                    <div className="text-xl font-bold">{formatSize(stats.audioSize)}</div>
                                    <div className="text-xs text-muted-foreground">{stats.cachedAudioCount} items</div>
                                </div>
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-1">
                                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">ML Models</span>
                                    <div className="text-xl font-bold">{formatSize(stats.modelsSize)}</div>
                                    <div className="text-xs text-muted-foreground">{stats.cachedModelsCount} models</div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="space-y-3 border-t border-white/5 pt-6">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">Actions</h3>
                                
                                <button
                                    onClick={handleClearAudio}
                                    disabled={clearing !== null || stats.audioSize === 0}
                                    className="w-full p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-between transition-all group disabled:opacity-50"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                            </svg>
                                        </div>
                                        <div className="text-left">
                                            <div className="font-bold">Clear Audio Cache</div>
                                            <div className="text-xs text-muted-foreground">Remove all separated vocal/instrumental tracks</div>
                                        </div>
                                    </div>
                                    {clearing === 'audio' ? (
                                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    )}
                                </button>

                                <button
                                    onClick={handleClearModels}
                                    disabled={clearing !== null || stats.cachedModelsCount === 0}
                                    className="w-full p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-between transition-all group disabled:opacity-50"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                                            </svg>
                                        </div>
                                        <div className="text-left">
                                            <div className="font-bold">Reset ML Models</div>
                                            <div className="text-xs text-muted-foreground">Force re-download of separation models</div>
                                        </div>
                                    </div>
                                    {clearing === 'models' ? (
                                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-12 text-muted-foreground">
                            Failed to load storage data.
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};
