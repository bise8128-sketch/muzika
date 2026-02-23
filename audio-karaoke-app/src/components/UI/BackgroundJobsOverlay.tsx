'use client';

import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/utils/storage/audioDatabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';

export const BackgroundJobsOverlay = () => {
    // Watch for active background jobs
    const activeJobs = useLiveQuery(async () => {
        return await db.processingQueue
            .where('status')
            .anyOf('pending', 'processing')
            .toArray();
    }, []);

    if (!activeJobs || activeJobs.length === 0) {
        return null;
    }

    const processingJob = activeJobs.find(j => j.status === 'processing');
    const displayJob = processingJob || activeJobs[0];

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 50, scale: 0.95 }}
                className="fixed bottom-6 right-6 z-[9999] pointer-events-auto"
            >
                <div className="flex items-center gap-4 bg-black/80 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl">
                    <div className="p-2 bg-purple-500/20 rounded-xl border border-purple-500/30">
                        <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                    </div>
                    <div className="flex flex-col pr-4">
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                            <span className="truncate max-w-[150px]">{displayJob.fileName}</span>
                            <span className="text-xs px-2 py-0.5 bg-white/10 rounded-full font-mono text-purple-300">
                                {Math.round(displayJob.progress)}%
                            </span>
                        </h4>
                        <p className="text-xs text-white/50 font-medium">
                            {displayJob.status === 'processing' 
                                ? 'AI Separating Stems...' 
                                : `Queued (${activeJobs.length - 1} pending)`}
                        </p>
                    </div>
                    <div className="w-1 h-8 rounded-full bg-white/10 overflow-hidden relative">
                        <motion.div 
                            className="absolute bottom-0 w-full bg-purple-400"
                            initial={{ height: 0 }}
                            animate={{ height: `${displayJob.progress}%` }}
                            transition={{ duration: 0.3 }}
                        />
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};
