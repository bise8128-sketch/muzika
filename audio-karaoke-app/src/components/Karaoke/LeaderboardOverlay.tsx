'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, X, User, Zap, Star } from 'lucide-react';

interface LeaderboardRecord {
    id: string;
    username: string;
    score: number;
    maxCombo: number;
    createdAt: string;
}

interface LeaderboardOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    songId?: string;
}

/**
 * LeaderboardOverlay
 * A premium, glassmorphism-styled component to display top scores.
 */
export const LeaderboardOverlay: React.FC<LeaderboardOverlayProps> = ({ 
    isOpen, 
    onClose, 
    songId 
}) => {
    const [records, setRecords] = useState<LeaderboardRecord[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchLeaderboard();
        }
    }, [isOpen, songId]);

    const fetchLeaderboard = async () => {
        setIsLoading(true);
        try {
            const url = songId ? `/api/leaderboard?songId=${songId}` : '/api/leaderboard';
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                setRecords(data);
            }
        } catch (error) {
            console.error('[LeaderboardOverlay] Error fetching leaderboard:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    {/* Content */}
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-2xl bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl overflow-hidden shadow-2xl"
                    >
                        {/* Header */}
                        <div className="p-8 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-purple-500/10 to-blue-500/10">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-yellow-500/20 rounded-2xl">
                                    <Trophy className="w-8 h-8 text-yellow-500" />
                                </div>
                                <div>
                                    <h2 className="text-3xl font-bold text-white tracking-tight">Hall of Fame</h2>
                                    <p className="text-white/40 text-sm">Top performances of all time</p>
                                </div>
                            </div>
                            <button 
                                onClick={onClose}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <X className="w-6 h-6 text-white" />
                            </button>
                        </div>

                        {/* List */}
                        <div className="p-8 max-h-[60vh] overflow-y-auto">
                            {isLoading ? (
                                <div className="flex items-center justify-center py-20">
                                    <div className="w-12 h-12 border-4 border-white/10 border-t-purple-500 rounded-full animate-spin" />
                                </div>
                            ) : records.length > 0 ? (
                                <div className="space-y-4">
                                    {records.map((record, index) => (
                                        <motion.div 
                                            key={record.id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            className="group relative flex items-center gap-4 p-5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all cursor-default"
                                        >
                                            {/* Rank Number */}
                                            <div className="w-10 text-2xl font-black italic text-white/20 group-hover:text-white/40 transition-colors">
                                                {(index + 1).toString().padStart(2, '0')}
                                            </div>

                                            {/* Avatar/Icon */}
                                            <div className={`p-3 rounded-xl ${
                                                index === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                                                index === 1 ? 'bg-slate-300/20 text-slate-300' :
                                                index === 2 ? 'bg-amber-600/20 text-amber-600' :
                                                'bg-white/5 text-white/40'
                                            }`}>
                                                <User className="w-6 h-6" />
                                            </div>

                                            {/* User Info */}
                                            <div className="flex-1">
                                                <div className="text-xl font-semibold text-white group-hover:text-purple-300 transition-colors flex items-center gap-2">
                                                    {record.username}
                                                    {index < 3 && <Star className="w-4 h-4 fill-current" />}
                                                </div>
                                                <div className="text-white/30 text-sm flex items-center gap-3">
                                                    <span className="flex items-center gap-1">
                                                        <Zap className="w-3 h-3" /> Max Combo: {record.maxCombo}
                                                    </span>
                                                    <span>•</span>
                                                    <span>{new Date(record.createdAt).toLocaleDateString()}</span>
                                                </div>
                                            </div>

                                            {/* Score */}
                                            <div className="text-right">
                                                <div className={`text-3xl font-black ${
                                                    record.score >= 90 ? 'text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500' :
                                                    record.score >= 70 ? 'text-blue-400' : 'text-white'
                                                }`}>
                                                    {Math.round(record.score)}
                                                    <span className="text-sm font-bold ml-1">%</span>
                                                </div>
                                                <div className="text-[10px] font-bold tracking-widest text-white/20 uppercase">Accuracy</div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-20">
                                    <Trophy className="w-16 h-16 text-white/10 mx-auto mb-4" />
                                    <p className="text-white/40 font-medium text-lg">No records found yet.</p>
                                    <p className="text-white/20 text-sm">Be the first to sing this song!</p>
                                </div>
                            )}
                        </div>

                        {/* Footer (Decorative) */}
                        <div className="p-6 bg-white/5 flex items-center justify-center text-white/20 text-xs font-bold tracking-[0.2em] uppercase">
                            Global Sync Results • Web Audio Engine • Antigravity 2026
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
