'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from '@/i18n/routing';
import { useAudio } from '@/context/AudioProvider';
import { GradeDisplay } from '@/components/Karaoke/GradeDisplay';
import { motion } from 'framer-motion';
import { ArrowLeft, RotateCcw, LayoutGrid } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function PerformanceScorePage() {
    const { id } = useParams();
    const router = useRouter();
    const { performanceScore, setPerformanceScore } = useAudio();
    const t = useTranslations('HomePage');

    if (!performanceScore) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
                <div className="p-4 bg-white/5 rounded-full text-white/40">
                    <LayoutGrid className="w-8 h-8" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-white mb-2">No Score Data</h2>
                    <p className="text-white/60 max-w-sm">
                        Complete a karaoke session to see your performance breakdown!
                    </p>
                </div>
                <button 
                    onClick={() => router.push(`/karaoke/${id}`)}
                    className="px-6 py-3 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-all"
                >
                    Back to Studio
                </button>
            </div>
        );
    }

    const handleTryAgain = () => {
        setPerformanceScore(null);
        router.push(`/karaoke/${id}`);
    };

    return (
        <div className="min-h-screen pt-8 pb-24">
            {/* Header Navigation */}
            <div className="flex items-center justify-between mb-8 px-4 max-w-5xl mx-auto">
                <button
                    onClick={() => router.push(`/results/${id}`)}
                    className="flex items-center gap-2 text-white/40 hover:text-white transition-colors group"
                >
                    <div className="p-2 rounded-xl bg-white/5 group-hover:bg-white/10 transition-all">
                        <ArrowLeft className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest">Exit to Lab</span>
                </button>

                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-primary bg-primary/10 px-4 py-1.5 rounded-full border border-primary/20">
                    Session Summary
                </div>
            </div>

            {/* Main Content */}
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="max-w-5xl mx-auto"
            >
                <GradeDisplay score={performanceScore} />

                {/* Additional Insights / Heatmap Placeholder */}
                <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="mt-12 px-6"
                >
                    <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-8 md:p-12 text-center space-y-4">
                        <h3 className="text-xl font-bold text-white">Accuracy Heatmap</h3>
                        <p className="text-sm text-white/40 max-w-md mx-auto">
                            Coming soon: A detailed timeline showing your pitch accuracy throughout every phrase of the song.
                        </p>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: '100%' }}
                                transition={{ duration: 2, delay: 1 }}
                                className="h-full bg-linear-to-r from-red-500 via-amber-500 to-emerald-500 opacity-30"
                            />
                        </div>
                    </div>
                </motion.div>

                {/* Actions */}
                <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 1 }}
                    className="mt-16 flex flex-col md:flex-row items-center justify-center gap-4"
                >
                    <button
                        onClick={handleTryAgain}
                        className="flex items-center gap-3 px-8 py-4 bg-white text-black rounded-3xl font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl"
                    >
                        <RotateCcw className="w-5 h-5" />
                        Try Again
                    </button>
                    
                    <button
                        onClick={() => router.push('/library')}
                        className="flex items-center gap-3 px-8 py-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-3xl font-black uppercase tracking-widest transition-all"
                    >
                        <LayoutGrid className="w-5 h-5" />
                        Next Song
                    </button>
                </motion.div>
            </motion.div>
        </div>
    );
}
