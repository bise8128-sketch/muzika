'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Medal, History as HistoryIcon } from 'lucide-react';
import { performanceStorage, PerformanceRecord } from '@/utils/storage/performanceStorage';

interface LeaderboardDisplayProps {
    songId: number;
    currentScoreId?: number;
}

export const LeaderboardDisplay: React.FC<LeaderboardDisplayProps> = ({ songId, currentScoreId }) => {
    const [records, setRecords] = useState<PerformanceRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            setIsLoading(true);
            try {
                const data = await performanceStorage.getLeaderboard(songId);
                setRecords(data);
            } catch (err) {
                console.error('Failed to fetch leaderboard:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchLeaderboard();
    }, [songId]);

    if (isLoading) {
        return <div className="h-48 w-full bg-white/5 animate-pulse rounded-3xl" />;
    }

    if (records.length === 0) return null;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Top Performances</span>
                <Trophy className="w-3 h-3 text-amber-400 opacity-50" />
            </div>

            <div className="bg-white/2 border border-white/5 rounded-4xl overflow-hidden">
                <div className="divide-y divide-white/5">
                    {records.map((record, index) => (
                        <motion.div
                            key={record.id}
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.1 * index }}
                            className={`flex items-center justify-between p-4 px-6 ${
                                record.id === currentScoreId ? 'bg-primary/10' : ''
                            }`}
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-6 text-center">
                                    {index === 0 ? (
                                        <Medal className="w-5 h-5 text-amber-400" />
                                    ) : index === 1 ? (
                                        <Medal className="w-5 h-5 text-slate-400" />
                                    ) : index === 2 ? (
                                        <Medal className="w-5 h-5 text-amber-700" />
                                    ) : (
                                        <span className="text-xs font-black text-white/20">{index + 1}</span>
                                    )}
                                </div>
                                
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-lg font-black ${GRADE_COLORS[record.grade]}`}>
                                            {record.grade}
                                        </span>
                                        <span className="text-xs font-bold text-white/60">
                                            {new Date(record.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <div className="text-[10px] text-white/20 uppercase tracking-tighter">
                                        {record.notesHit} / {record.totalNotes} Notes • {record.longestStreak} Streak
                                    </div>
                                </div>
                            </div>

                            <div className="text-right">
                                <div className="text-xl font-black text-white tabular-nums">
                                    {Math.round(record.score)}%
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const GRADE_COLORS: Record<string, string> = {
    'S': 'text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]',
    'A': 'text-emerald-400',
    'B': 'text-blue-400',
    'C': 'text-purple-400',
    'D': 'text-slate-400',
};
