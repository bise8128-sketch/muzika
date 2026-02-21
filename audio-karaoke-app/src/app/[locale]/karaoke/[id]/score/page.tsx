'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from '@/i18n/routing';
import { useAudio } from '@/context/AudioProvider';
import { GradeDisplay } from '@/components/Karaoke/GradeDisplay';
import { motion } from 'framer-motion';
import { ArrowLeft, RotateCcw, LayoutGrid } from 'lucide-react';
import { AccuracyHeatmap } from '@/components/Karaoke/AccuracyHeatmap';
import { LeaderboardDisplay } from '@/components/Karaoke/LeaderboardDisplay';
import { performanceStorage } from '@/utils/storage/performanceStorage';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { ScoreSubmitForm } from '@/components/Karaoke/ScoreSubmitForm';
import { LeaderboardOverlay } from '@/components/Karaoke/LeaderboardOverlay';
import { Trophy } from 'lucide-react';

export default function PerformanceScorePage() {
    const { id } = useParams();
    const router = useRouter();
    const { performanceScore, setPerformanceScore } = useAudio();
    const t = useTranslations('HomePage');
    const hasSaved = useRef(false);
    const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);

    // Auto-save score on mount
    useEffect(() => {
        if (performanceScore && id && !hasSaved.current) {
            hasSaved.current = true;
            const songId = typeof id === 'string' ? parseInt(id, 10) : parseInt(id[0], 10);
            if (!isNaN(songId)) {
                performanceStorage.saveScore(
                    songId, 
                    'session-' + id, 
                    performanceScore
                ).then(() => {
                    console.log('✅ Performance score persisted to history');
                }).catch(err => {
                    console.error('❌ Failed to persist score:', err);
                });
            }
        }
    }, [performanceScore, id]);

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

                {/* Accuracy Heatmap */}
                <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="mt-12 px-6"
                >
                    <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-8 md:p-12 space-y-12">
                        <AccuracyHeatmap history={performanceScore.history} />
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                            <ScoreSubmitForm 
                                songId={typeof id === 'string' ? id : (id?.[0] || '')} 
                                performanceScore={performanceScore} 
                            />
                            
                            <div className="space-y-8">
                                <LeaderboardDisplay 
                                    songId={id ? (typeof id === 'string' ? parseInt(id, 10) : parseInt(id[0], 10)) : 0} 
                                />
                                
                                <div className="p-8 bg-white/5 border border-white/10 rounded-3xl flex flex-col items-center justify-center gap-4 text-center">
                                    <div className="p-4 bg-yellow-500/20 rounded-full">
                                        <Trophy className="w-8 h-8 text-yellow-500" />
                                    </div>
                                    <h4 className="text-xl font-bold text-white">Global Ranking</h4>
                                    <p className="text-sm text-white/40 max-w-xs">
                                        Check how you rank against other singers worldwide.
                                    </p>
                                    <button 
                                        onClick={() => setIsLeaderboardOpen(true)}
                                        className="w-full py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl transition-all"
                                    >
                                        View All-Time Top
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        <div className="text-center space-y-2 pt-8">
                            <h3 className="text-lg font-bold text-white/80">Performance Insights</h3>
                            <p className="text-xs text-white/30 max-w-md mx-auto">
                                Each segment above represents a portion of the song. Green indicates high accuracy, while red highlights areas for improvement.
                            </p>
                        </div>
                    </div>
                </motion.div>

                <LeaderboardOverlay 
                    isOpen={isLeaderboardOpen} 
                    onClose={() => setIsLeaderboardOpen(false)} 
                    songId={id ? (typeof id === 'string' ? id : id[0]) : ''}
                />

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
